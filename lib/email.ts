import nodemailer from "nodemailer";

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendEmailResult = {
  messageId: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export async function sendEmail({ to, subject, html, text }: SendEmailArgs): Promise<SendEmailResult> {
  const transport = (process.env.EMAIL_TRANSPORT || "smtp").toLowerCase();

  if (transport === "console") {
    console.log("[email:console]", { to, subject });
    return { messageId: "console" };
  }

  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) {
    throw new Error(
      "Email is not configured. Set EMAIL_TRANSPORT=console for local testing, or configure SMTP_HOST and SMTP_FROM."
    );
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined
  });

  const result = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text
  });

  return { messageId: String(result.messageId || "") || "unknown" };
}
