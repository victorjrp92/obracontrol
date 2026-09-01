import { escapeHtml } from "./escape";
import { baseEmailHtml } from "./base";

/**
 * Aviso de que la suscripción está por vencer, o de que ya venció.
 *
 * Existe porque la renovación en este producto es MANUAL por diseño: en
 * Colombia una empresa paga por PSE, y PSE no admite cobro recurrente —
 * cada pago lo autoriza la persona en su banco. Sin un aviso a tiempo, el
 * flujo real es «se vence → no puede crear obras → se enoja → escribe». Con
 * aviso, entra, paga en dos minutos y ni se entera.
 *
 * El tono cambia según falten días o ya haya vencido, pero NUNCA amenaza: al
 * vencer no se pierde nada ni se cierra el acceso, solo se dejan de poder
 * crear obras nuevas. Decirlo así evita el susto de creer que se perdieron
 * los datos, que es la llamada que de verdad cuesta.
 */
export interface VencimientoEmailProps {
  nombre: string;
  nombreCuenta: string;
  nombrePlan: string;
  /** Días que faltan. 0 o negativo = ya venció. */
  diasRestantes: number;
  /** Fecha de vencimiento ya formateada en es-CO. */
  fechaVence: string;
  urlPlan: string;
}

export function vencimientoEmailHtml({
  nombre,
  nombreCuenta,
  nombrePlan,
  diasRestantes,
  fechaVence,
  urlPlan,
}: VencimientoEmailProps): string {
  const seVencio = diasRestantes <= 0;
  const safeNombre = escapeHtml(nombre);
  const safeCuenta = escapeHtml(nombreCuenta);
  const safePlan = escapeHtml(nombrePlan);
  const safeFecha = escapeHtml(fechaVence);
  const safeUrl = escapeHtml(urlPlan);

  const plazo =
    diasRestantes === 1 ? "mañana" : diasRestantes > 1 ? `en ${diasRestantes} días` : "";

  const titulo = seVencio
    ? "Tu plan venció — renuévalo cuando puedas"
    : `Tu plan vence ${plazo}`;

  const encabezado = seVencio
    ? `Hola ${safeNombre}, el plan <strong>${safePlan}</strong> de <strong>${safeCuenta}</strong> venció el ${safeFecha}.`
    : `Hola ${safeNombre}, el plan <strong>${safePlan}</strong> de <strong>${safeCuenta}</strong> vence el ${safeFecha}.`;

  // Lo que más tranquiliza es decir explícitamente qué NO pasa.
  const consecuencia = seVencio
    ? `<p style="margin:0 0 16px; color:#334155; line-height:1.6;">
         <strong>No se perdió nada.</strong> Puedes seguir entrando y consultando todas tus
         obras, tareas, evidencias y reportes. Lo único que no podrás hacer hasta renovar
         es <strong>crear obras nuevas</strong>.
       </p>`
    : `<p style="margin:0 0 16px; color:#334155; line-height:1.6;">
         Si no renuevas, no se pierde nada: podrás seguir entrando y consultando todo lo
         que ya tienes registrado. Lo único que dejarías de poder hacer es
         <strong>crear obras nuevas</strong>.
       </p>`;

  const body = `
    <p style="margin:0 0 16px; color:#334155; line-height:1.6;">${encabezado}</p>
    ${consecuencia}
    <p style="margin:0 0 16px; color:#334155; line-height:1.6;">
      Renovar toma dos minutos y puedes pagar por <strong>PSE</strong> desde la cuenta de
      tu empresa, con tarjeta, Nequi o transferencia.
    </p>
    <p style="margin:0; color:#64748b; font-size:13px; line-height:1.6;">
      ¿Dudas con la factura o el plan? Responde a este correo y te ayudamos.
    </p>
  `;

  return baseEmailHtml({
    title: titulo,
    preheader: seVencio
      ? "Sigues teniendo acceso a todo lo registrado; solo no puedes crear obras nuevas."
      : `Vence el ${safeFecha}. Renovar toma dos minutos.`,
    body,
    ctaText: seVencio ? "Renovar mi plan" : "Renovar ahora",
    ctaUrl: safeUrl,
  });
}
