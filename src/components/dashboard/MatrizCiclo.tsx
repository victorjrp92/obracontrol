"use client";

// ---------------------------------------------------------------------------
// ¿DONDE SE ESTA DEMORANDO LA OBRA? Dias que tarda cada fase en una unidad,
// cruzados contra la dimension que se quiera comparar: torre, piso, tipologia
// o responsable.
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
// == POR QUE CADA CELDA LLEVA DOS LINEAS Y NO UN NUMERO =====================
//
// Antes la celda decia «2,5» y debajo «20 u», y el dueno del producto pregunto
// literalmente «no se que significa ese 2,5 y 20 u». Los dos numeros eran
// correctos y estaban mudos. Un numero sin unidad no es un dato, es una
// adivinanza: ahora la celda dice «2,5 dias» y «20 unidades», que es lo unico
// que la deja leerse sola, sin bajar a ninguna leyenda al pie.
//
// == EL SESGO QUE HAY QUE ADVERTIR ==========================================
//
// Solo entran unidades que CERRARON la fase entera, asi que una torre a medio
// camino aporta unicamente los apartamentos que alcanzo a terminar -casi
// siempre los mas faciles- y se ve mas rapida de lo que es. Por eso cada celda
// muestra cuantas unidades la respaldan: un numero que enganna callado es peor
// que no tener el numero.
//
// Y por eso las celdas con poco respaldo NO llevan color. Antes se atenuaban
// al 55% y el usuario no tenia como saber por que; peor, seguian pintadas de
// verde o de rojo, es decir seguian dando un veredicto que el dato no sostiene.
// Ahora se quedan en blanco con el borde del tono y dicen «solo 3 unidades»,
// que es exactamente el motivo.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { DIMENSIONES, type Dimension, type MatrizCiclo as Datos } from "@/lib/velocidad";

/**
 * Debajo de esto la celda pierde el relleno de color. Cinco no es un numero
 * magico: en una torre de veinte apartamentos, cuatro cerrados son el 20% -y
 * los primeros en cerrar casi siempre son los faciles-, asi que ese promedio
 * todavia no describe la torre.
 */
const POCAS_UNIDADES = 5;

/**
 * Los nombres de dimension para pantalla.
 *
 * `DIMENSIONES` los trae sin tildes ("Tipologia") y esto es texto que lee el
 * usuario, no una clave. El fichero de calculo no es de este agente para
 * corregirlo, asi que la capa de presentacion pone la tilde donde va.
 */
const NOMBRE: Record<Dimension, string> = {
  torre: "Torre",
  piso: "Piso",
  tipologia: "Tipología",
  responsable: "Responsable",
};

/** Para la frase de lectura: «las torres tardan casi lo mismo». */
const PLURAL: Record<Dimension, string> = {
  torre: "las torres",
  piso: "los pisos",
  tipologia: "las tipologías",
  responsable: "los responsables",
};

/**
 * La rampa de calor. El verde se oscurecio de #059669 a #047857 por una razon
 * medible: la celda ya no lleva un numero suelto sino dos lineas de texto, y
 * en blanco sobre #059669 el contraste era 3,8:1 —por debajo de AA—, justo en
 * las celdas que dicen que la obra va bien. Con #047857 son 5,5:1. Los otros
 * tres tonos ya pasaban (azul 5,2:1, ambar 5,0:1, rojo 4,8:1) y no se tocan.
 */
const VERDE = "#047857";
const AZUL = "#2563EB";
const AMBAR = "#B45309";
const ROJO = "#DC2626";

function tono(dias: number, min: number, max: number): string {
  if (max <= min) return AZUL;
  const t = (dias - min) / (max - min);
  if (t < 0.25) return VERDE;
  if (t < 0.5) return AZUL;
  if (t < 0.75) return AMBAR;
  return ROJO;
}

/** Un decimal y coma: asi se escribe un decimal en Colombia. */
const nDias = (d: number) => d.toFixed(1).replace(".", ",");

const nUnidades = (n: number) => `${n} ${n === 1 ? "unidad" : "unidades"}`;

/**
 * Cuanto mas tarda `mayor` que `menor`, EN PALABRAS.
 *
 * Un cociente crudo -«3,76»- no es una lectura. Por debajo del doble se dice
 * en porcentaje, que es como se habla de diferencias pequenas; del doble para
 * arriba, en veces, que es como se habla de las grandes.
 */
function cuantoMas(menor: number, mayor: number): string {
  const r = mayor / menor;
  if (r < 2) return `un ${Math.round((r - 1) * 100)}% más`;
  return `${r.toFixed(1).replace(".", ",")} veces más`;
}

/** Diferencia minima para que valga la pena decir que hay diferencia. */
const RAZON_MINIMA = 1.15;

interface Punto {
  fase: string;
  col: string;
  dias: number;
  unidades: number;
}

/** Las celdas con dato y con al menos `minUnidades` detras, aplanadas. */
function puntos(datos: Datos, minUnidades: number): Punto[] {
  const out: Punto[] = [];
  for (const fase of datos.fases) {
    for (const col of datos.columnas) {
      const c = datos.celdas.get(fase)!.get(col)!;
      if (c.dias !== null && c.unidades >= minUnidades) {
        out.push({ fase, col, dias: c.dias, unidades: c.unidades });
      }
    }
  }
  return out;
}

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * LA PRIMERA LECTURA, en una frase, construida con el dato.
 *
 * Una matriz de treinta celdas no se lee: se mira. La frase es lo que hace que
 * alguien entienda sin que le expliquen, y por eso dice el hallazgo -donde se
 * abre mas la diferencia- y no el metodo.
 *
 * La comparacion se hace SIEMPRE dentro de una misma fase: mamposteria contra
 * mamposteria. Enfrentar mamposteria con aseo no dice nada de la obra, solo
 * que una fase es mas larga que otra, que ya se sabia.
 *
 * Y se construye sobre las celdas con respaldo. Una frase sacada de un
 * promedio de dos apartamentos afirma en prosa algo que el dato no sostiene,
 * que es peor que no decir nada.
 */
function lectura(datos: Datos, dim: Dimension): string | null {
  const conRespaldo = puntos(datos, POCAS_UNIDADES);
  const flojo = conRespaldo.length === 0;
  const base = flojo ? puntos(datos, 1) : conRespaldo;
  if (base.length === 0) return null;

  let elegida: { fase: string; min: Punto; max: Punto } | null = null;
  let mayorRazon = 0;
  for (const fase of datos.fases) {
    const cs = base.filter((p) => p.fase === fase);
    if (cs.length < 2) continue;
    const min = cs.reduce((a, b) => (b.dias < a.dias ? b : a));
    const max = cs.reduce((a, b) => (b.dias > a.dias ? b : a));
    if (max.dias / min.dias > mayorRazon) {
      mayorRazon = max.dias / min.dias;
      elegida = { fase, min, max };
    }
  }

  // Si ni una sola celda llega al minimo, la frase se dice igual -callarse
  // deja la tabla muda- pero avisando de que esta parada sobre poco.
  const aviso = flojo
    ? ` Tómalo con pinzas: todavía no hay ninguna celda con ${POCAS_UNIDADES} unidades cerradas.`
    : "";

  if (elegida && mayorRazon >= RAZON_MINIMA) {
    const { fase, min, max } = elegida;
    return (
      `${fase} es la fase donde más se separan ${PLURAL[dim]}: ` +
      `${min.col} la cierra en ${nDias(min.dias)} días por unidad y ${max.col} tarda ` +
      `${nDias(max.dias)} — ${cuantoMas(min.dias, max.dias)}.${aviso}`
    );
  }

  const lenta = base.reduce((a, b) => (b.dias > a.dias ? b : a));

  if (elegida) {
    return (
      `${mayus(PLURAL[dim])} tardan casi lo mismo en cada fase. ` +
      `La más lenta es ${lenta.fase}, con ${nDias(lenta.dias)} días por unidad.${aviso}`
    );
  }

  // Sin dos columnas que comparar, la lectura util es cual es la fase mas
  // lenta. Se dice «X la cierra en» y no «en X» porque la columna puede ser
  // una persona: «en Juan Pérez» no es castellano.
  return (
    `La fase más lenta es ${lenta.fase}: ${lenta.col} la cierra en ` +
    `${nDias(lenta.dias)} días por unidad, promediados sobre ${nUnidades(lenta.unidades)}.${aviso}`
  );
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

  const frase = datos ? lectura(datos, dim) : null;

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
                title={hay ? undefined : "Esta obra no tiene con qué comparar en esta dimensión"}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
                  dim === d.clave
                    ? "bg-white text-slate-900 shadow-sm"
                    : hay
                      ? "text-slate-500 hover:text-slate-700 cursor-pointer"
                      : "text-slate-300 cursor-not-allowed"
                }`}
              >
                {NOMBRE[d.clave]}
              </button>
            );
          })}
        </div>
      </div>

      {!datos || datos.fases.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          Todavía ninguna unidad ha cerrado una fase completa, así que no hay días que promediar.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            {/* El ancho minimo se calcula con las columnas que hay: ahora cada
                celda lleva «17,6 días» y «20 unidades» debajo, y con el ancho
                fijo de antes esas palabras se partian en tres renglones. */}
            <table
              className="w-full border-separate border-spacing-[3px]"
              style={{ minWidth: 150 + datos.columnas.length * 82 }}
            >
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pb-1 w-[150px]"
                  >
                    Fase
                  </th>
                  {datos.columnas.map((c) => (
                    <th
                      key={c}
                      scope="col"
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
                    <th
                      scope="row"
                      className="text-left text-xs font-bold text-slate-600 pr-2 align-middle"
                    >
                      {f}
                    </th>
                    {datos.columnas.map((c) => {
                      const celda = datos.celdas.get(f)!.get(c)!;

                      if (celda.dias === null) {
                        return (
                          <td
                            key={c}
                            className="text-center align-top"
                            title={`Ninguna unidad de ${c} ha cerrado todavía todas las tareas de ${f}, así que no hay ciclo que medir.`}
                          >
                            <div className="rounded-md py-1.5 px-1 bg-slate-100 text-slate-400 text-[11px] font-semibold">
                              sin cerrar
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 pt-1">
                              0 unidades
                            </div>
                          </td>
                        );
                      }

                      const color = tono(celda.dias, datos.minDias, datos.maxDias);
                      const pocas = celda.unidades < POCAS_UNIDADES;

                      return (
                        <td
                          key={c}
                          className="text-center align-top"
                          title={
                            pocas
                              ? `${f} en ${c}: ${nDias(celda.dias)} días hábiles por unidad, promedio de solo ${nUnidades(celda.unidades)}. Con menos de ${POCAS_UNIDADES} el promedio todavía puede cambiar mucho, por eso la celda va sin color.`
                              : `${f} en ${c}: ${nDias(celda.dias)} días hábiles por unidad, promedio de ${nUnidades(celda.unidades)} que cerraron la fase completa.`
                          }
                        >
                          {/* Sin respaldo suficiente la celda va hueca: el
                              relleno de color es un veredicto -rapido, lento- y
                              con tres unidades ese veredicto no esta ganado. */}
                          <div
                            className="rounded-md py-1.5 px-1 leading-tight"
                            style={
                              pocas
                                ? { background: "#fff", border: `1.5px solid ${color}`, color }
                                : { background: color, color: "#fff" }
                            }
                          >
                            <span className="text-[13px] font-extrabold tabular-nums">
                              {nDias(celda.dias)}
                            </span>
                            <span className="text-[10px] font-bold opacity-90"> días</span>
                          </div>
                          <div
                            className={`text-[10px] pt-1 ${
                              pocas ? "font-bold text-slate-500" : "font-semibold text-slate-400"
                            }`}
                          >
                            {pocas ? `solo ${nUnidades(celda.unidades)}` : nUnidades(celda.unidades)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* LA PRIMERA LECTURA. Va pegada a la tabla y antes de la nota: es la
              frase que contesta la pregunta del titulo, no la letra pequena. */}
          {frase && (
            <p className="mt-4 border-l-2 border-blue-600 pl-3 text-[13.5px] leading-snug text-slate-700">
              {frase}
            </p>
          )}

          {/* La nota va en gris y no en ambar: en este producto el ambar ya
              significa ESPERANDO y gastarlo de adorno le quita el significado
              justo donde hace falta. Superficie de datos: plana, linea fina. */}
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-[12.5px] leading-relaxed text-slate-600">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Cómo leer la tabla
            </span>
            Cada celda dice cuántos <strong className="text-slate-800">días hábiles</strong> tarda esa
            fase en una unidad —desde que arranca su primera tarea hasta que se aprueba la última— y
            sobre <strong className="text-slate-800">cuántas unidades</strong> está sacado ese promedio.
            Solo cuentan las que terminaron la fase{" "}
            <strong className="text-slate-800">completa</strong>, así que una torre a medio camino
            puede verse más rápida de lo que es: aporta nada más lo que alcanzó a cerrar, que casi
            siempre es lo fácil.
            {hayPocas && (
              <>
                {" "}
                Las celdas huecas —las que dicen «solo N unidades»— tienen menos de {POCAS_UNIDADES}{" "}
                unidades cerradas: con tan pocas el promedio todavía puede cambiar mucho, y por eso no
                se pintan.
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
