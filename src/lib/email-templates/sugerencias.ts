import { baseEmailHtml } from "./base";
import { escapeHtml } from "./escape";

export function sugerenciaNuevaEmailHtml({
  contratistaNombre,
  tareaName,
  proyectoName,
  url,
}: {
  contratistaNombre: string;
  tareaName: string;
  proyectoName: string;
  url: string;
}): string {
  const safeContratista = escapeHtml(contratistaNombre);
  const safeTarea = escapeHtml(tareaName);
  const safeProyecto = escapeHtml(proyectoName);
  return baseEmailHtml({
    title: `Nueva sugerencia de tarea: ${safeTarea}`,
    preheader: `${safeContratista} sugirió una tarea en ${safeProyecto}`,
    body: `
      <p>${safeContratista} ha sugerido una nueva tarea para el proyecto. Revísala y decide si aprobarla o rechazarla.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea sugerida:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${safeTarea}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${safeProyecto}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Sugerida por:</td>
          <td style="padding:8px 0; color:#0f172a;">${safeContratista}</td>
        </tr>
      </table>
    `,
    ctaText: "Revisar sugerencia",
    ctaUrl: url,
  });
}

export function sugerenciaAprobadaEmailHtml({
  tareaName,
  proyectoName,
  url,
}: {
  tareaName: string;
  proyectoName: string;
  url: string;
}): string {
  const safeTarea = escapeHtml(tareaName);
  const safeProyecto = escapeHtml(proyectoName);
  return baseEmailHtml({
    title: `Sugerencia aprobada: ${safeTarea}`,
    preheader: `Tu sugerencia fue aprobada en ${safeProyecto}`,
    body: `
      <p>Tu sugerencia de tarea fue revisada y <strong>aprobada</strong>. Las tareas han sido creadas en el sistema y te han sido asignadas.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${safeTarea}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${safeProyecto}</td>
        </tr>
      </table>
    `,
    ctaText: "Ver mis tareas",
    ctaUrl: url,
  });
}

export function sugerenciaRechazadaEmailHtml({
  tareaName,
  proyectoName,
  motivo,
  url,
}: {
  tareaName: string;
  proyectoName: string;
  motivo: string;
  url: string;
}): string {
  const safeTarea = escapeHtml(tareaName);
  const safeProyecto = escapeHtml(proyectoName);
  const safeMotivo = escapeHtml(motivo);
  return baseEmailHtml({
    title: `Sugerencia rechazada: ${safeTarea}`,
    preheader: `Tu sugerencia no fue aprobada en ${safeProyecto}`,
    body: `
      <p>Tu sugerencia de tarea fue revisada pero <strong>no fue aprobada</strong>. Revisa el motivo a continuación.</p>
      <table style="width:100%; margin-top:16px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Tarea:</td>
          <td style="padding:8px 0; color:#0f172a; font-weight:600;">${safeTarea}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b; font-size:13px;">Proyecto:</td>
          <td style="padding:8px 0; color:#0f172a;">${safeProyecto}</td>
        </tr>
      </table>
      <div style="margin-top:16px; padding:12px 16px; background:#fef2f2; border-left:3px solid #dc2626; border-radius:6px;">
        <div style="font-size:12px; color:#991b1b; font-weight:600; margin-bottom:4px;">Motivo:</div>
        <div style="font-size:13px; color:#7f1d1d;">${safeMotivo}</div>
      </div>
    `,
    ctaText: "Ver mis sugerencias",
    ctaUrl: url,
  });
}
