import { Resend } from "resend";

export type Email = {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.EMAIL_FROM ?? "Vertex OS <notifications@vertexmediahouse.com>";

/** Sends through Resend; without RESEND_API_KEY it prints the email instead (local dev). */
export async function sendEmail(email: Email): Promise<void> {
  if (!resend) {
    console.info(`[email] to=${[email.to].flat().join(", ")} subject="${email.subject}"\n${email.html}`);
    return;
  }
  const { error } = await resend.emails.send({ from, ...email });
  if (error) throw new Error(`Email failed: ${error.message}`);
}
