import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Opcional. Aditivo: si no se pasa, el envío se comporta exactamente igual que antes (usado por Seiricon Alerta para el PDF del acta de daños). */
  attachments?: EmailAttachment[];
}

export async function sendEmail({ to, subject, html, attachments }: SendEmailOptions) {
  const { error } = await getResend().emails.send({
    from: "Seiricon <notificaciones@seiricon.com>",
    to,
    subject,
    html,
    ...(attachments ? { attachments } : {}),
  });
  if (error) {
    console.error("Error sending email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
