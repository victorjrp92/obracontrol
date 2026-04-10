import { baseEmailHtml } from "./base";

interface TareaInfo {
  nombre: string;
  proyecto: string;
  ubicacion: string;
  contratista?: string;
  url: string;
}

export function tareaReportadaEmailHtml(t: TareaInfo): string {
  return baseEmailHtml({
    title: `Tarea reportada: ${t.nombre}`,
    preheader: `${t.contratista ?? "Un contratista"} reportó una tarea en ${t.proyecto}`,
    body: `
      <p>Una tarea fue reportada como terminada y está esperando tu revisión.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${t.nombre}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${t.proyecto}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Ubicación:</td>
          <td style="padding:8px 0; color:#0f172a;">${t.ubicacion}</td>
        </tr>
        ${t.contratista ? `
          <tr>
            <td style="padding:8px 0; color:#64748b; font-size:13px;">Reportada por:</td>
            <td style="padding:8px 0; color:#0f172a;">${t.contratista}</td>
          </tr>
        ` : ""}
      </table>
    `,
    ctaText: "Revisar tarea",
    ctaUrl: t.url,
  });
}

export function tareaAprobadaEmailHtml(t: TareaInfo): string {
  return baseEmailHtml({
    title: `Tarea aprobada: ${t.nombre}`,
    preheader: `Tu tarea fue aprobada en ${t.proyecto}`,
    body: `
      <p>Excelente trabajo. Tu tarea fue revisada y aprobada.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${t.nombre}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${t.proyecto}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Ubicación:</td>
          <td style="padding:8px 0; color:#0f172a;">${t.ubicacion}</td>
        </tr>
      </table>
    `,
    ctaText: "Ver tarea",
    ctaUrl: t.url,
  });
}

export function tareaNoAprobadaEmailHtml(t: TareaInfo & { motivo: string }): string {
  return baseEmailHtml({
    title: `Tarea no aprobada: ${t.nombre}`,
    preheader: `Tu tarea requiere correcciones en ${t.proyecto}`,
    body: `
      <p>Tu tarea fue revisada pero <strong>no fue aprobada</strong>. Revisa los comentarios y vuelve a reportarla cuando hayas hecho las correcciones.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${t.nombre}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${t.proyecto}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Ubicación:</td>
          <td style="padding:8px 0; color:#0f172a;">${t.ubicacion}</td>
        </tr>
      </table>
      <div style="margin-top:16px; padding:12px 16px; background:#fef2f2; border-left:3px solid #dc2626; border-radius:6px;">
        <div style="font-size:12px; color:#991b1b; font-weight:600; margin-bottom:4px;">Motivo:</div>
        <div style="font-size:13px; color:#7f1d1d;">${t.motivo}</div>
      </div>
    `,
    ctaText: "Corregir tarea",
    ctaUrl: t.url,
  });
}

export function retrasoRegistradoEmailHtml(
  t: TareaInfo & { tipoRetraso: string; justificacion: string }
): string {
  return baseEmailHtml({
    title: `Retraso registrado: ${t.nombre}`,
    preheader: `Se registró un retraso en ${t.proyecto}`,
    body: `
      <p>Se registró un retraso en una tarea del proyecto.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${t.nombre}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${t.proyecto}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Ubicación:</td>
          <td style="padding:8px 0; color:#0f172a;">${t.ubicacion}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tipo:</td>
          <td style="padding:8px 0; color:#0f172a;">${t.tipoRetraso}</td>
        </tr>
      </table>
      <div style="margin-top:16px; padding:12px 16px; background:#fff7ed; border-left:3px solid #f97316; border-radius:6px;">
        <div style="font-size:12px; color:#9a3412; font-weight:600; margin-bottom:4px;">Justificación:</div>
        <div style="font-size:13px; color:#7c2d12;">${t.justificacion}</div>
      </div>
    `,
    ctaText: "Ver tarea",
    ctaUrl: t.url,
  });
}
