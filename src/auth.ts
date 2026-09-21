import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

class EmailNotVerified extends CredentialsSignin {
  code = "email_not_verified";
}
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

const credentialsSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });

// Compared against when the user does not exist, so response time does not reveal whether an e-mail is registered.
const DUMMY_HASH = bcrypt.hashSync("timing-equalisation", 12);
const MAX_FAILED = 8;
const LOCK_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();
        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

        const [byIp, byEmail] = await Promise.all([
          rateLimit(`login:ip:${ip}`, LIMITS.login.limit * 3, LIMITS.login.windowSec),
          rateLimit(`login:email:${email}`, LIMITS.login.limit, LIMITS.login.windowSec),
        ]);
        if (!byIp.ok || !byEmail.ok) throw new TooManyAttempts();

        const user = await db.user.findUnique({ where: { email } });
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const valid = await bcrypt.compare(parsed.data.password, hash);

        if (!user || !user.passwordHash || !user.isActive) return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new TooManyAttempts();

        if (!valid) {
          const failed = user.failedLogins + 1;
          await db.user.update({
            where: { id: user.id },
            data: { failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
          });
          return null;
        }
        if (env().REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) throw new EmailNotVerified();

        await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name ?? undefined, role: user.role };
      },
    }),
  ],
});
