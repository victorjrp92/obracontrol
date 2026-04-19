interface InvitationEmailProps {
  nombreInvitado: string;
  nombreConstructora: string;
  rol: string;
  loginUrl: string;
  password: string;
}

import { escapeHtml } from "./escape";

export function invitationEmailHtml({
  nombreInvitado,
  nombreConstructora,
  rol,
  loginUrl,
  password,
}: InvitationEmailProps): string {
  const safeNombre = escapeHtml(nombreInvitado);
  const safeConstructora = escapeHtml(nombreConstructora);
  const safeRol = escapeHtml(rol);
  const safePassword = escapeHtml(password);
  // loginUrl is derived from server env (NEXT_PUBLIC_SITE_URL) so it is trusted,
  // but escape attribute-sensitive characters defensively.
  const safeLoginUrl = escapeHtml(loginUrl);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f1f5f9; padding: 40px 0;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #2563eb; padding: 24px 32px;">
      <h1 style="color: white; font-size: 20px; margin: 0; letter-spacing: 0.5px;">SEIRICON</h1>
      <p style="color: #bfdbfe; font-size: 11px; margin: 2px 0 0;">construyendo en orden</p>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 8px;">Hola ${safeNombre},</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Te han invitado a <strong>${safeConstructora}</strong> en Seiricon como <strong>${safeRol}</strong>.
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Tu contraseña temporal es: <code style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 16px; font-weight: bold;">${safePassword}</code>
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Te recomendamos cambiarla después de tu primer inicio de sesión.
      </p>
      <a href="${safeLoginUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 16px;">
        Ingresar a Seiricon
      </a>
    </div>
    <div style="padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">Este email fue enviado por Seiricon. Si no esperabas esta invitación, puedes ignorarlo.</p>
    </div>
  </div>
</body>
</html>`;
}
