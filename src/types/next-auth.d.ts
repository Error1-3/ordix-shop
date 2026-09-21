import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "CUSTOMER" | "STAFF" | "ADMIN";
  }
  interface Session {
    user: { id: string; role: "CUSTOMER" | "STAFF" | "ADMIN" } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "CUSTOMER" | "STAFF" | "ADMIN";
  }
}
