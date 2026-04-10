interface BaseEmailProps {
  title: string;
  preheader?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function baseEmailHtml({ title, preheader = "", body, ctaText, ctaUrl }: BaseEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; font-family: 'Helvetica Neue', Arial, sans-serif; background:#f1f5f9;">
  ${preheader ? `<div style="display:none; max-height:0; overflow:hidden;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px; background:white; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#2563eb; padding:20px 32px;">
              <h1 style="color:white; font-size:18px; margin:0; font-weight:700;">ObraControl</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="color:#0f172a; font-size:20px; margin:0 0 16px; font-weight:700;">${title}</h2>
              <div style="color:#475569; font-size:14px; line-height:1.6;">
                ${body}
              </div>
              ${ctaText && ctaUrl ? `
                <div style="margin-top:24px;">
                  <a href="${ctaUrl}" style="display:inline-block; background:#2563eb; color:white; text-decoration:none; padding:12px 24px; border-radius:10px; font-size:14px; font-weight:600;">
                    ${ctaText}
                  </a>
                </div>
              ` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px; border-top:1px solid #e2e8f0; background:#f8fafc;">
              <p style="color:#94a3b8; font-size:11px; margin:0; line-height:1.5;">
                Este email fue enviado automáticamente por ObraControl. No respondas a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
