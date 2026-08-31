"use client";

// ─────────────────────────────────────────────────────────────────────────
// La LEYENDA de la línea de tiempo.
//
// Existe porque el gráfico usaba hasta cuatro colores y su explicación estaba
// en una nota al pie, DESPUÉS del gráfico: para cuando el usuario la leía ya
// había interpretado mal las barras. Una leyenda solo sirve arriba.
//
// Se muestran únicamente las series que la obra realmente tiene. Una leyenda
// que anuncia un color que no aparece en pantalla manda a buscar algo que no
// está, y eso es peor que no explicar nada.
// ─────────────────────────────────────────────────────────────────────────

export default function LeyendaCronograma({
  hayRamas,
  hayOverhead,
}: {
  /** Hay fases de otro oficio corriendo en paralelo (violeta). */
  hayRamas: boolean;
  /** Se dibuja la franja de arranque y entrega (gris). */
  hayOverhead: boolean;
}) {
  const series: { color: string; texto: string }[] = [
    { color: "bg-amber-400 border-amber-500", texto: "sin holgura: retrasa la entrega" },
    { color: "bg-blue-500 border-blue-600", texto: "se puede mover sin mover la fecha" },
  ];
  if (hayRamas) {
    series.push({ color: "bg-violet-400 border-violet-500", texto: "otro oficio, en paralelo" });
  }
  if (hayOverhead) {
    series.push({ color: "bg-slate-400 border-slate-500", texto: "arranque y entrega" });
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
      {series.map((s) => (
        <li key={s.texto} className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className={`w-3 h-2 rounded-full border flex-shrink-0 ${s.color}`} />
          {s.texto}
        </li>
      ))}
    </ul>
  );
}
