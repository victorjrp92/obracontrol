"use client";

// ─────────────────────────────────────────────────────────────────────────
// Las dos VERTICALES que contestan solas: «¿dónde estamos?» y «¿cuándo se
// entrega?». Van encima de las barras —al revés que la rejilla de meses—
// porque son la referencia contra la que se lee todo lo demás.
//
// La de ENTREGA es la P80: la fecha con la que uno se compromete, no la
// mediana. El eje llega hasta la P95, así que a la derecha de esa línea queda
// dibujada la cola de riesgo, y el hueco entre la última barra y la línea es
// el colchón. Verlos es la mitad del valor de la vista.
//
// ══ POR QUÉ LOS RÓTULOS VAN ABAJO Y CON TRANSFORM ══════════════════════════
//
// Primera versión: rótulo arriba, dentro del mismo div que la línea, alineado
// con `left-1` o `right-1`. Se veía mal por dos razones que solo aparecen al
// renderizar. Arriba compiten con los nombres de mes del eje y con el otro
// rótulo —«HOY» y «ENTREGA 12 SEP» quedaban uno encima del otro—. Y `right-1`
// sobre un div de ancho cero no mete nada hacia adentro: el rótulo se salía
// igual del marco. Ahora cada rótulo es un elemento suelto del overlay, con su
// propio `left` y un `translateX` que lo centra en medio del eje y lo pega por
// dentro en los bordes.
// ─────────────────────────────────────────────────────────────────────────

/** A partir de aquí el rótulo se ancla por su borde derecho para no salirse. */
const BORDE_DERECHO = 85;
/** Por debajo de aquí se ancla por el izquierdo. */
const BORDE_IZQUIERDO = 12;

function anclaje(pct: number): string {
  if (pct >= BORDE_DERECHO) return "translateX(-100%)";
  if (pct <= BORDE_IZQUIERDO) return "translateX(0)";
  return "translateX(-50%)";
}

export default function MarcasCronograma({
  hoyPct,
  entregaPct,
  etiquetaEntrega,
}: {
  /** Posición 0–100 de hoy, o `null` si la obra aún no arranca. */
  hoyPct: number | null;
  /** Posición 0–100 de la fecha de entrega comprometida. */
  entregaPct: number | null;
  etiquetaEntrega: string;
}) {
  if (hoyPct === null && entregaPct === null) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
      {hoyPct !== null && (
        <>
          <span
            className="absolute top-0 bottom-4 w-px bg-slate-400"
            style={{ left: `${hoyPct}%` }}
          />
          <span
            className="absolute bottom-0 text-[9px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap"
            style={{ left: `${hoyPct}%`, transform: anclaje(hoyPct) }}
          >
            hoy
          </span>
        </>
      )}

      {entregaPct !== null && (
        <>
          <span
            className="absolute top-0 bottom-4 border-l-2 border-dashed border-blue-400"
            style={{ left: `${entregaPct}%` }}
          />
          <span
            className="absolute bottom-0 text-[9px] font-bold uppercase tracking-wider text-blue-600 whitespace-nowrap"
            style={{ left: `${entregaPct}%`, transform: anclaje(entregaPct) }}
          >
            {etiquetaEntrega}
          </span>
        </>
      )}
    </div>
  );
}
