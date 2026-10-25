import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
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

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
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
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  plugins: [nextCookies()],
});
