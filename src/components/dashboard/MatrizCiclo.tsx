"use client";

// ---------------------------------------------------------------------------
// Dias que tarda cada fase en una unidad, cruzados contra la dimension que se
// quiera comparar: torre, piso, tipologia o responsable.
//
// Es la unica de las tres metricas que resuelve sola el problema de "pintar no
// es lo mismo que hacer una columna": compara mamposteria con mamposteria. Y
// se lee sin explicacion porque un residente ya piensa en apartamentos.
//
// La matriz generaliza a cualquier dimension con pocas columnas -es el mismo
// calculo cambiando el agrupador- asi que un solo componente da cuatro
// reportes. Lo que no admite es dimensiones con muchos valores: fase por
// apartamento serian seiscientas celdas y deja de ser legible; para eso esta
// el tope de `MAX_COLUMNAS`.
//
// == EL SESGO QUE HAY QUE ADVERTIR ==========================================
//
// Solo entran unidades que CERRARON la fase entera, asi que una torre a medio
// camino aporta unicamente los apartamentos que alcanzo a terminar -casi
// siempre los mas faciles- y se ve mas rapida de lo que es. Por eso cada celda
// muestra cuantas unidades la respaldan y la nota lo dice en palabras: un
// numero que enganna callado es peor que no tener el numero.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { DIMENSIONES, type Dimension, type MatrizCiclo as Datos } from "@/lib/velocidad";

/**
 * Debajo de esto la celda se atenua. Cinco no es un numero magico: en una
 * torre de veinte apartamentos, cuatro cerrados son el 20% -y los primeros en
 * cerrar casi siempre son los faciles-, asi que ese promedio todavia no
 * describe la torre.
 */
const POCAS_UNIDADES = 5;

function tono(dias: number, min: number, max: number): string {
  if (max <= min) return "#2563EB";
  const t = (dias - min) / (max - min);
  if (t < 0.25) return "#059669";
  if (t < 0.5) return "#2563EB";
  if (t < 0.75) return "#B45309";
  return "#DC2626";
}

export default function MatrizCiclo({
  porDimension,
  inicial = "torre",
}: {
  /** La matriz ya calculada para cada dimension: cambiar de vista no recarga. */
  porDimension: Record<Dimension, Datos>;
  inicial?: Dimension;
}) {
  const [dim, setDim] = useState<Dimension>(inicial);
  const datos = porDimension[dim];

  const disponibles = DIMENSIONES.filter((d) => porDimension[d.clave]?.columnas.length > 1);
  const hayPocas = datos
    ? datos.fases.some((f) =>
        [...datos.celdas.get(f)!.values()].some((c) => c.dias !== null && c.unidades < POCAS_UNIDADES),
      )
    : false;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Comparar por</span>
        <div className="inline-flex bg-slate-50 border border-slate-200 rounded-lg p-0.5 gap-0.5">
          {DIMENSIONES.map((d) => {
            const hay = disponibles.some((x) => x.clave === d.clave);
            return (
              <button
                key={d.clave}
                type="button"
                disabled={!hay}
                onClick={() => setDim(d.clave)}
                aria-pressed={dim === d.clave}
                title={hay ? undefined : "Esta obra no tiene con que comparar en esta dimension"}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
                  dim === d.clave
                    ? "bg-white text-slate-900 shadow-sm"
                    : hay
                      ? "text-slate-500 hover:text-slate-700 cursor-pointer"
                      : "text-slate-300 cursor-not-allowed"
                }`}
              >
                {d.nombre}
              </button>
            );
          })}
        </div>
      </div>

      {!datos || datos.fases.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          Todavia no hay unidades con una fase cerrada completa.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-[3px] min-w-[430px]">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pb-1 w-[150px]">
                    Fase
                  </th>
                  {datos.columnas.map((c) => (
                    <th
                      key={c}
                      className="text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pb-1"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.fases.map((f) => (
                  <tr key={f}>
                    <td className="text-left text-xs font-bold text-slate-600 pr-2">{f}</td>
                    {datos.columnas.map((c) => {
                      const celda = datos.celdas.get(f)!.get(c)!;
                      if (celda.dias === null) {
                        return (
                          <td
                            key={c}
                            className="text-center rounded-md py-2 px-1 bg-slate-100 text-slate-400 text-[10.5px] font-semibold"
                          >
                            sin cerrar
                          </td>
                        );
                      }
                      const pocas = celda.unidades < POCAS_UNIDADES;
                      return (
                        <td
                          key={c}
                          className="text-center rounded-md py-2 px-1 text-[13px] font-extrabold text-white"
                          style={{
                            background: tono(celda.dias, datos.minDias, datos.maxDias),
                            opacity: pocas ? 0.55 : 1,
                          }}
                          title={`${f} en ${c}: ${celda.dias.toFixed(1)} dias, promedio de ${celda.unidades} unidad${celda.unidades === 1 ? "" : "es"}`}
                        >
                          {celda.dias.toFixed(1).replace(".", ",")}
                          <span className="block text-[9px] font-semibold opacity-80">
                            {celda.unidades} u
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-[13px] text-slate-600">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-amber-700 mb-1">
              Como leerla
            </span>
            Dias desde que arranca la fase en una unidad hasta que cierra su ultima tarea. Solo cuentan
            las unidades que <strong className="text-slate-800">terminaron la fase completa</strong>, asi
            que una torre a medio camino puede verse mas rapida de lo que es: aporta solo lo que alcanzo
            a cerrar. El numero pequeno de cada celda son las unidades que la respaldan
            {hayPocas && (
              <>
                {" "}
                —las celdas con menos de {POCAS_UNIDADES} van atenuadas porque su promedio todavia no
                significa mucho
              </>
            )}
            .
          </div>
        </>
      )}
    </div>
  );
}
