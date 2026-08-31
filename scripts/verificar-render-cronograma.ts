// ─────────────────────────────────────────────────────────────────────────
// Verificación por RENDERIZADO de la línea de tiempo con eje de calendario.
//
// El build de Next y `tsc` no cazan un identificador roto dentro del JSX de
// una rama que nunca se evalúa, ni una barra colocada en un sitio absurdo.
// Esto monta el componente de verdad con `react-dom/server` y le mira el HTML:
// si el eje, las marcas o las barras no salen, o salen fuera del marco, falla.
//
// CONTROL POSITIVO en cada bloque: se renderiza también un caso donde el
// elemento NO debe aparecer, y se exige que efectivamente no aparezca. Sin eso
// un `includes()` que siempre da true pasaría por verificación.
// ─────────────────────────────────────────────────────────────────────────

import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import LineaTiempoObra from "@/components/personal/LineaTiempoObra";
import type { EspacioEstim } from "@/lib/estimar-duracion";

let total = 0;
let fallos = 0;

function verificar(descripcion: string, condicion: boolean) {
  total++;
  if (condicion) console.log(`  OK   ${descripcion}`);
  else {
    fallos++;
    console.error(`  FAIL ${descripcion}`);
  }
}

const t = (nombre: string, dias: number) => ({ nombre, dias, on: true });

const OBRA: EspacioEstim[] = [
  {
    id: "e1",
    nombre: "Baño principal",
    metraje: 6,
    tareas: [
      t("Demolición de enchape", 3),
      t("Instalación hidrosanitaria", 2),
      t("Repello de muros", 3),
      t("Enchape de piso", 4),
      t("Pintura general", 2),
    ],
  },
  {
    id: "e2",
    nombre: "Cocina",
    metraje: 12,
    tareas: [
      t("Demolición de mesón", 2),
      t("Puntos eléctricos", 2),
      t("Repello de muros", 4),
      t("Enchape de pared", 5),
      t("Muebles de cocina", 6),
    ],
  },
  {
    id: "e3",
    nombre: "Sala",
    metraje: 24,
    tareas: [t("Estuco de muros", 5), t("Pintura general", 4), t("Piso laminado", 6)],
  },
];

function render(props: Record<string, unknown>): string {
  return renderToStaticMarkup(
    React.createElement(LineaTiempoObra, { espacios: OBRA, ...props } as never),
  );
}

/**
 * Geometría de cada elemento posicionado, leída de SU PROPIO atributo `style`.
 *
 * Sacar todos los `left:` por un lado y todos los `width:` por otro y luego
 * emparejarlos por índice está mal: la franja de arranque no lleva `left`
 * (usa la clase `left-0`), así que los arreglos se desfasan y se termina
 * midiendo el ancho de una barra contra la posición de otra.
 */
interface Caja {
  left: number;
  width: number;
  /** La etiqueta completa, para poder distinguir qué es cada caja. */
  tag: string;
}

/**
 * Toda caja posicionada del gráfico, con su etiqueta entera.
 *
 * Se guarda el tag completo y no solo el `style` porque en el mismo overlay
 * conviven cosas distintas: las columnas del EJE (que por definición llegan al
 * 100%: es el marco) y las BARRAS de trabajo (que no deben llegar). Medir el
 * «fin de la obra» sobre la mezcla da siempre 100% y la comprobación deja de
 * medir nada.
 */
function cajas(html: string): Caja[] {
  const out: Caja[] = [];
  const re = /<(?:div|span)\b[^>]*style="([^"]*)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const l = /left:\s*([\d.]+)%/.exec(m[1]);
    const w = /width:\s*([\d.]+)%/.exec(m[1]);
    if (!l && !w) continue;
    out.push({ left: l ? parseFloat(l[1]) : 0, width: w ? parseFloat(w[1]) : 0, tag: m[0] });
  }
  return out;
}

/** Las barras de trabajo: las píldoras, no las columnas del eje. */
const esBarra = (c: Caja) => c.tag.includes("rounded-full");

console.log("Render de la línea de tiempo — verificación\n");

// ─────────────────────────────────────────────────────────────────────────
console.log("1. Obra ya arrancada: sale el eje, sale «hoy», sale la entrega");

const inicioPasado = new Date(Date.now() - 30 * 86_400_000);
const conHoy = render({ proyectoId: "prueba-render", fechaInicio: inicioPasado });

verificar("el componente renderiza algo", conHoy.length > 500);
verificar("no quedó ningún `undefined` impreso en el HTML", !conHoy.includes("undefined"));
verificar("no quedó ningún `NaN` impreso ni en estilos ni en texto", !conHoy.includes("NaN"));

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesesVistos = MESES.filter((m) => conHoy.includes(`>${m}<`));
verificar(
  `el eje rotula ${mesesVistos.length} meses distintos (${mesesVistos.join(" ")})`,
  mesesVistos.length >= 2,
);
verificar("sale la marca de «hoy»", conHoy.includes(">hoy<"));
verificar("sale la línea de entrega con su fecha", /entrega \d/.test(conHoy));
verificar("sale la leyenda de colores", conHoy.includes("sin holgura: retrasa la entrega"));
verificar(
  "la leyenda explica el color con holgura",
  conHoy.includes("se puede mover sin mover la fecha"),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n2. Geometría: nada se sale del marco");

const cajasHoy = cajas(conHoy);
const barras = cajasHoy.filter(esBarra);
verificar(`hay ${cajasHoy.length} cajas posicionadas, ${barras.length} de ellas barras`,
  cajasHoy.length > 10 && barras.length >= 5);
verificar(
  `ninguna caja arranca fuera de 0–100 (min ${Math.min(...cajasHoy.map((c) => c.left)).toFixed(1)}, ` +
    `max ${Math.max(...cajasHoy.map((c) => c.left)).toFixed(1)})`,
  cajasHoy.every((c) => c.left >= 0 && c.left <= 100),
);
verificar(`ningún ancho es negativo`, cajasHoy.every((c) => c.width >= 0));

// El desborde tolerado es EXACTAMENTE el ancho mínimo de barra (1.2%): una
// tarea de medio día pegada al final se dibuja con ese mínimo para que se vea,
// y la pista la recorta con `overflow-hidden`. Más que eso es un cálculo malo.
const MINIMO_BARRA = 1.2;
verificar(
  `ninguna caja desborda más allá del mínimo de dibujo ` +
    `(la más larga llega a ${Math.max(...cajasHoy.map((c) => c.left + c.width)).toFixed(1)}%)`,
  cajasHoy.every((c) => c.left + c.width <= 100 + MINIMO_BARRA),
);

// La entrega (P80) va DENTRO del marco y DESPUÉS de la última barra: a su
// izquierda el trabajo, a su derecha la cola de riesgo hasta la P95. Si
// coincidiera con el borde derecho la línea no diría nada, que es justo lo que
// pasaba cuando la escala llegaba solo hasta la P80.
{
  const entrega = /border-dashed[^>]*style="left:\s*([\d.]+)%/.exec(conHoy);
  const pct = entrega ? parseFloat(entrega[1]) : NaN;
  const finObra = Math.max(...barras.map((c) => c.left + c.width));
  verificar(
    `la entrega está en ${pct.toFixed(1)}%, después del fin del trabajo (${finObra.toFixed(1)}%)`,
    Number.isFinite(pct) && pct >= finObra - MINIMO_BARRA,
  );
  verificar(
    `la entrega NO se pega al borde: queda cola de riesgo a su derecha (${(100 - pct).toFixed(1)}%)`,
    Number.isFinite(pct) && pct < 97,
  );
  verificar(
    `las barras de trabajo terminan antes del borde del eje (${finObra.toFixed(1)}%)`,
    finObra < 100,
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. CONTROL POSITIVO: obra que arranca hoy NO lleva marca de «hoy»");

const arrancaHoy = render({ proyectoId: "prueba-render" });
verificar("renderiza sin fecha de inicio", arrancaHoy.length > 500);
verificar("NO sale la marca de «hoy» (caería sobre el 0%)", !arrancaHoy.includes(">hoy<"));
verificar("pero SÍ sale el eje de meses", MESES.some((m) => arrancaHoy.includes(`>${m}<`)));
verificar("y SÍ sale la línea de entrega", /entrega \d/.test(arrancaHoy));

// ─────────────────────────────────────────────────────────────────────────
console.log("\n4. CONTROL POSITIVO: sin tareas no se renderiza nada");

const vacio = renderToStaticMarkup(
  React.createElement(LineaTiempoObra, { espacios: [] } as never),
);
verificar("una obra sin espacios devuelve HTML vacío", vacio === "");

// ─────────────────────────────────────────────────────────────────────────
console.log("\n5. La leyenda solo anuncia colores que están en pantalla");

verificar(
  "con obra sin overhead ni ramas, la leyenda no inventa series",
  (conHoy.match(/arranque y entrega/gi) ?? []).length <=
    (conHoy.includes("Movilización, compras") ? 2 : 0),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n6. Jornada de 5 días mueve el eje (no está cableado a 6)");

const j5 = render({ proyectoId: "prueba-render", fechaInicio: inicioPasado, diasHabilesSemana: 5 });
const mes5 = MESES.filter((m) => j5.includes(`>${m}<`));
verificar(
  `con jornada de 5 días el eje abarca ${mes5.length} meses vs ${mesesVistos.length} con 6`,
  mes5.length >= mesesVistos.length,
);
verificar("el HTML de 5 días es distinto al de 6 días", j5 !== conHoy);

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Línea de tiempo renderizada y verificada sin errores.");
