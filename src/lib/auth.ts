import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Demo authentication: credential pairs come from the DEMO_USERS env var
 * ("email:password,email:password"). For production replace with a real user
 * store (hashed passwords) or SSO — see README "Security" section.
 */
function demoUsers(): Map<string, string> {
  const raw = process.env.DEMO_USERS ?? "demo@bb-circulars.app:demo1234";
  const users = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const sep = pair.indexOf(":");
    if (sep > 0) users.set(pair.slice(0, sep).trim().toLowerCase(), pair.slice(sep + 1).trim());
  }
  return users;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase();
        const password = String(credentials?.password ?? "");
        const expected = demoUsers().get(email);
        if (!expected || expected !== password) return null;
        return { id: email, email, name: email.split("@")[0] };
      },
    }),
  ],
});
