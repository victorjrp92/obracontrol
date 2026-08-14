/**
 * Copys EXACTOS del veredicto por nivel (spec A.4). Ninguna pantalla los
 * parafrasea: cualquier UI que muestre un resultado usa estas constantes tal
 * cual. Regla de negocio no negociable: en ningún copy de nivel puede
 * aparecer la palabra "seguro" describiendo un resultado — el nivel verde
 * dice "no vemos señales de alarma", nunca "es seguro".
 *
 * Ver docs/specs/2026-08-13-seiricon-alerta-fase1.md, sección A.4.
 */
import type { Elemento, Nivel, Patron } from "./tipos";

export const COPY_NIVEL: Record<Nivel, string> = {
  rojo: "Salí y buscá evaluación urgente.",
  amarillo: "Documentá y que un ingeniero la revise antes de seguir viviendo normal.",
  verde: "No vemos señales de alarma en esta foto",
};

/** Fijo para todo resultado que no sea verde (spec A.4). Verde no muestra esta lista. */
export const QUE_NO_HACER_SI_NO_VERDE: string[] = ["No taparla", "No pintarla", "No cargar el elemento"];

// ─── Fase 2 (triage con visión) — constantes aditivas ──────────────────────
// COPY_NIVEL y QUE_NO_HACER_SI_NO_VERDE de arriba quedan IDÉNTICOS: los 43
// casos de npm run verify:alerta (Fase 1) siguen pasando sin tocar ese
// script. Todo lo de abajo es nuevo, ver docs/specs/2026-08-13-seiricon-alerta-fase2.md.
// Regla dura verificada en scripts/verificar-triage-alerta.ts: ninguna
// constante nueva de este archivo matchea /\bsegur/i.

/** Título corto del badge de nivel (SemaforoNivel.tsx). */
export const TITULO_NIVEL: Record<Nivel, string> = {
  rojo: "Riesgo alto",
  amarillo: "Necesita revisión",
  verde: "Sin señales de alarma",
};

/** Clases Tailwind del badge de nivel, por nivel (SemaforoNivel.tsx). */
export const TONO_NIVEL: Record<Nivel, { bg: string; border: string; text: string; icon: string }> = {
  rojo: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", icon: "text-red-600" },
  amarillo: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", icon: "text-amber-600" },
  verde: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", icon: "text-green-600" },
};

/**
 * Obligatoria en toda pantalla que muestre un resultado verde (spec D8/CA-11):
 * un semáforo verde en UNA foto de UNA grieta no descarta daños en el resto
 * del inmueble. Nunca usa la palabra "seguro".
 */
export const ADVERTENCIA_VERDE =
  "No vemos señales de alarma en esta foto ni en esta grieta. Eso no descarta daños en otras partes " +
  "del inmueble que no se ven en la imagen — si tienes dudas, sigue documentando otras grietas o pide " +
  "que un ingeniero revise el resto.";

/** Banner cuando lo declarado por la persona y lo observado en la foto no coinciden (T1 de triage.ts). */
export const COPY_DISCREPANCIA =
  "Lo que ves en la foto no coincide con lo que marcaste al inicio. Usamos la lectura más conservadora " +
  "entre las dos para no subestimar el resultado.";

/** Se muestra cuando el flujo cae a modo manual (sin IA, key inválida, error, o "prefiero describirla yo"). */
export const COPY_SIN_IA =
  "En este momento no pudimos leer la foto automáticamente. Completa esta grieta con lo que tú observas " +
  "— con tu descripción, el resultado no puede llegar a verde.";

/**
 * Nombres en lenguaje llano de cada `Patron`. Son EXACTAMENTE las etiquetas
 * que ya usaba el menú del modo manual (`DescribirGrietaManual.tsx`), movidas
 * acá sin cambiar una coma para que el paso de confirmación de patrón (R3,
 * `ConfirmarPatron.tsx`) las reuse en vez de inventar un segundo vocabulario
 * para la misma pregunta.
 */
export const LABEL_PATRON: Record<Patron, string> = {
  vertical: "En línea recta, de arriba hacia abajo",
  horizontal: "En línea recta, de lado a lado",
  diagonal: "Inclinada (en diagonal)",
  diagonal_x: "En forma de X",
  escalonada: "En escalones (sigue los bloques o ladrillos)",
  craquelado: "Como telaraña, muchas líneas finas",
  esquina_vano: "Sale de la esquina de una puerta o ventana",
  junta_entre_elementos: "Donde se juntan dos materiales distintos (ej. columna y muro)",
};

/** Orden en el que se listan los patrones en pantalla (el mismo del menú original del modo manual). */
export const ORDEN_PATRON: Patron[] = [
  "vertical",
  "horizontal",
  "diagonal",
  "diagonal_x",
  "escalonada",
  "craquelado",
  "esquina_vano",
  "junta_entre_elementos",
];

/** Banner cuando el patrón que confirmó la persona no coincide con el leído en la foto (R3). */
export const COPY_DISCREPANCIA_PATRON =
  "Nos dijiste que la grieta se ve distinta a como la leímos en la foto. Evaluamos las dos formas y nos " +
  "quedamos con el resultado más conservador.";

/** Nombres en lenguaje llano de cada `Elemento` — usado por ResultadoGrieta.tsx, ResumenInmueble.tsx e InformeGrietasReport.tsx. */
export const LABEL_ELEMENTO: Record<Elemento, string> = {
  columna: "Columna",
  viga: "Viga",
  nudo_viga_columna: "Nudo viga-columna",
  muro_carga: "Muro que sostiene la casa",
  muro_divisorio: "Muro divisorio",
  losa_techo: "Techo o losa",
  piso: "Piso",
  fachada: "Fachada",
  no_determinado: "No determinado",
};
