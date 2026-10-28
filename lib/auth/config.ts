// Framework-agnostic better-auth options, shared by the Next app (lib/auth/server.ts,
// which adds nextCookies()) and the Hono server (server/auth.ts). Nothing here may
// import from "next".
import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          // Invite-only: Google can sign in existing users, never create new ones.
          disableImplicitSignUp: true,
          disableSignUp: true,
        },
      }
    : undefined;

export const googleEnabled = Boolean(google);

export const authOptions = {
  database: prismaAdapter(db as any, { provider: "postgresql", transaction: true }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // accounts are created by invites
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Vertex OS password",
        html: `<p>Hi ${user.name},</p><p><a href="${url}">Choose a new password</a>. The link expires in 1 hour.</p>`,
      });
    },
  },
  socialProviders: google,
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  user: {
    additionalFields: {
      kind: { type: "string", input: false, defaultValue: "STAFF" },
      isOwner: { type: "boolean", input: false, defaultValue: false },
      title: { type: "string", required: false, input: false },
      timezone: { type: "string", input: false, defaultValue: "Asia/Kolkata" },
      weeklyCapacityHours: { type: "number", input: false, defaultValue: 40 },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Cloudflare Workers has no sticky isolate per user: `database` above is the
    // Sheets-backed in-memory mock db (lib/db), which lives in one isolate's memory
    // only. A session row written there at login is invisible to whichever isolate
    // handles the next request, so every post-login request 401'd and bounced back
    // to /login. cookieCache verifies the session from a signed, encrypted cookie
    // (JWT-style) instead of reading it back from that store, so no shared/external
    // session storage is needed — this is better-auth's built-in stateless mode.
    cookieCache: { enabled: true, maxAge: 60 * 60 * 24 * 30 },
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    // "database" calls adapter.incrementOne, which the Sheets-backed mock db (lib/db)
    // never implemented — every rate-limited route (sign-in included) hung forever
    // waiting on it. "memory" is per-isolate, which is fine for login-attempt throttling.
    storage: "memory",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
} satisfies BetterAuthOptions;
