interface InvitationEmailProps {
  nombreInvitado: string;
  nombreConstructora: string;
  rol: string;
  loginUrl: string;
  password: string;
}

export function invitationEmailHtml({
  nombreInvitado,
  nombreConstructora,
  rol,
  loginUrl,
  password,
}: InvitationEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f1f5f9; padding: 40px 0;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #2563eb; padding: 24px 32px;">
      <h1 style="color: white; font-size: 20px; margin: 0;">ObraControl</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 8px;">Hola ${nombreInvitado},</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Te han invitado a <strong>${nombreConstructora}</strong> en ObraControl como <strong>${rol}</strong>.
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Tu contraseña temporal es: <code style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 16px; font-weight: bold;">${password}</code>
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Te recomendamos cambiarla después de tu primer inicio de sesión.
      </p>
      <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 16px;">
        Ingresar a ObraControl
      </a>
    </div>
    <div style="padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">Este email fue enviado por ObraControl. Si no esperabas esta invitación, puedes ignorarlo.</p>
    </div>
  </div>
</body>
</html>`;
}
