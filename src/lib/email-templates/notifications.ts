import { baseEmailHtml } from "./base";
import { escapeHtml } from "./escape";

interface TareaInfo {
  nombre: string;
  proyecto: string;
  ubicacion: string;
  contratista?: string;
  url: string;
}

export function tareaReportadaEmailHtml(t: TareaInfo): string {
  const nombre = escapeHtml(t.nombre);
  const proyecto = escapeHtml(t.proyecto);
  const ubicacion = escapeHtml(t.ubicacion);
  const contratista = t.contratista ? escapeHtml(t.contratista) : undefined;
  return baseEmailHtml({
    title: `Tarea reportada: ${nombre}`,
    preheader: `${contratista ?? "Un contratista"} reportó una tarea en ${proyecto}`,
    body: `
      <p>Una tarea fue reportada como terminada y está esperando tu revisión.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${nombre}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${proyecto}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Ubicación:</td>
          <td style="padding:8px 0; color:#0f172a;">${ubicacion}</td>
        </tr>
        ${contratista ? `
          <tr>
            <td style="padding:8px 0; color:#64748b; font-size:13px;">Reportada por:</td>
            <td style="padding:8px 0; color:#0f172a;">${contratista}</td>
          </tr>
        ` : ""}
      </table>
    `,
    ctaText: "Revisar tarea",
    ctaUrl: t.url,
  });
}

export function tareaAprobadaEmailHtml(t: TareaInfo): string {
  const nombre = escapeHtml(t.nombre);
  const proyecto = escapeHtml(t.proyecto);
  const ubicacion = escapeHtml(t.ubicacion);
  return baseEmailHtml({
    title: `Tarea aprobada: ${nombre}`,
    preheader: `Tu tarea fue aprobada en ${proyecto}`,
    body: `
      <p>Excelente trabajo. Tu tarea fue revisada y aprobada.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${nombre}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${proyecto}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Ubicación:</td>
          <td style="padding:8px 0; color:#0f172a;">${ubicacion}</td>
        </tr>
      </table>
    `,
    ctaText: "Ver tarea",
    ctaUrl: t.url,
  });
}

export function tareaNoAprobadaEmailHtml(t: TareaInfo & { motivo: string }): string {
  const nombre = escapeHtml(t.nombre);
  const proyecto = escapeHtml(t.proyecto);
  const ubicacion = escapeHtml(t.ubicacion);
  const motivo = escapeHtml(t.motivo);
  return baseEmailHtml({
    title: `Tarea no aprobada: ${nombre}`,
    preheader: `Tu tarea requiere correcciones en ${proyecto}`,
    body: `
      <p>Tu tarea fue revisada pero <strong>no fue aprobada</strong>. Revisa los comentarios y vuelve a reportarla cuando hayas hecho las correcciones.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${nombre}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${proyecto}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Ubicación:</td>
          <td style="padding:8px 0; color:#0f172a;">${ubicacion}</td>
        </tr>
      </table>
      <div style="margin-top:16px; padding:12px 16px; background:#fef2f2; border-left:3px solid #dc2626; border-radius:6px;">
        <div style="font-size:12px; color:#991b1b; font-weight:600; margin-bottom:4px;">Motivo:</div>
        <div style="font-size:13px; color:#7f1d1d;">${motivo}</div>
      </div>
    `,
    ctaText: "Corregir tarea",
    ctaUrl: t.url,
  });
}

export function retrasoRegistradoEmailHtml(
  t: TareaInfo & { tipoRetraso: string; justificacion: string }
): string {
  const nombre = escapeHtml(t.nombre);
  const proyecto = escapeHtml(t.proyecto);
  const ubicacion = escapeHtml(t.ubicacion);
  const tipoRetraso = escapeHtml(t.tipoRetraso);
  const justificacion = escapeHtml(t.justificacion);
  return baseEmailHtml({
    title: `Retraso registrado: ${nombre}`,
    preheader: `Se registró un retraso en ${proyecto}`,
    body: `
      <p>Se registró un retraso en una tarea del proyecto.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${nombre}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${proyecto}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Ubicación:</td>
          <td style="padding:8px 0; color:#0f172a;">${ubicacion}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tipo:</td>
          <td style="padding:8px 0; color:#0f172a;">${tipoRetraso}</td>
        </tr>
      </table>
      <div style="margin-top:16px; padding:12px 16px; background:#fff7ed; border-left:3px solid #f97316; border-radius:6px;">
        <div style="font-size:12px; color:#9a3412; font-weight:600; margin-bottom:4px;">Justificación:</div>
        <div style="font-size:13px; color:#7c2d12;">${justificacion}</div>
      </div>
    `,
    ctaText: "Ver tarea",
    ctaUrl: t.url,
  });
}
