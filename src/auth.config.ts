import type { NextAuthConfig } from "next-auth";

/** Edge-safe part of the Auth.js config (no Prisma / bcrypt) — shared with middleware. */
export const authConfig = {
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 14 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role: "CUSTOMER" | "STAFF" | "ADMIN" }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as "CUSTOMER" | "STAFF" | "ADMIN") ?? "CUSTOMER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
