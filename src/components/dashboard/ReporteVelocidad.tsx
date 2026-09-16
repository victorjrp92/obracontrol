"use client";

// ---------------------------------------------------------------------------
// El bloque de VELOCIDAD dentro de Reportes: contesta "mi equipo esta rindiendo
// igual o mejor que el periodo pasado".
//
// Junta las tres medidas porque separadas enganan. El porcentaje a tiempo dice
// cuantas tareas incumplieron; los dias de mas dicen por cuanto; la matriz dice
// donde. Las dos primeras comparten el selector de periodo porque son la misma
// serie vista de dos maneras, y la tercera no tiene periodo: es un promedio
// sobre toda la obra.
//
// El periodo se resuelve en el CLIENTE sobre las tareas ya cargadas. Cambiar de
// mes a semana no puede costar un viaje al servidor: es la misma lista
// reagrupada, y la espera haria que nadie explore.
//
// == LOS TITULOS SON PREGUNTAS, A PROPOSITO =================================
//
// «Dias que toma cada fase en una unidad» describe el CALCULO. Lo que el
// usuario trae a esta pantalla es una pregunta -«¿donde se esta demorando la
// obra?»- y el titulo que contesta esa pregunta es el que hace que la mire.
// Los tres bloques van en el mismo registro: pregunta arriba, que se esta
// midiendo en el subtitulo, y debajo de la grafica una frase construida con el
// dato, que es lo unico que se lee sin que nadie explique nada.
//
// == Y CADA CIFRA LLEVA SU UNIDAD ===========================================
//
// Los tres indicadores de arriba decian «+0,07» y «−2 pts» sin decir de que.
// Ahora dicen «+0,07 días» y «−2 puntos», y debajo contra que se comparan
// («28 de 34 tareas cerradas en ago», «de 84% en jul a 82% en ago»). Una cifra
// sin unidad y sin referencia no informa: obliga a adivinar, y se adivina mal.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { TrendingUp, CalendarClock } from "lucide-react";
import {
  serieVelocidad,
  matrizCiclo,
  periodosDisponibles,
  PERIODOS,
  type Dimension,
  type Periodo,
  type PuntoVelocidad,
  type TareaVelocidad,
} from "@/lib/velocidad";
import GraficaATiempo from "./GraficaATiempo";
import GraficaDiasDeMas from "./GraficaDiasDeMas";
import MatrizCiclo from "./MatrizCiclo";

/** Minimo de periodos para que una serie cuente algo. Con uno no hay tendencia. */
const MINIMO_PUNTOS = 2;

/**
 * El plural de cada periodo, para la frase de lectura: «de los 7 meses». El
 * modulo de calculo solo trae el singular y esto es prosa, no una clave.
 */
const PLURAL_PERIODO: Record<Periodo, string> = {
  sem: "semanas",
  qui: "quincenas",
  mes: "meses",
  tri: "trimestres",
  sms: "semestres",
  ano: "años",
};

/** Dos decimales y coma, igual que las etiquetas de la grafica de dias. */
const nDias = (v: number) => Math.abs(v).toFixed(2).replace(".", ",");

/** Por debajo de esto, el promedio es cero a efectos de leerlo en voz alta. */
const CERO = 0.005;

/**
 * Como quedo una tarea contra su plazo, en palabras.
 *
 * El signo de `diasDeMas` es facil de leer al reves: lo BUENO es el numero
 * negativo. Escrito en prosa -«cerró 0,30 días antes»- no hay signo que
 * interpretar.
 */
function contraPlazo(v: number): string {
  if (Math.abs(v) < CERO) return "cerró justo en su plazo";
  return v > 0 ? `se pasó ${nDias(v)} días de su plazo` : `cerró ${nDias(v)} días antes de su plazo`;
}

/**
 * Lo mismo, en forma corta, para la SEGUNDA mitad de la frase: con el verbo
 * repetido -«se pasó X de su plazo... se pasó Y de su plazo»- el contraste
 * entre el peor periodo y el mejor se pierde en la repeticion.
 */
function contraPlazoCorto(v: number): string {
  if (Math.abs(v) < CERO) return "justo en su plazo";
  return v > 0 ? `${nDias(v)} días de más` : `${nDias(v)} días de menos`;
}

/** Las clases de la frase de primera lectura, iguales en los tres bloques. */
const LECTURA = "mt-3 border-l-2 border-blue-600 pl-3 text-[13.5px] leading-snug text-slate-700";

interface Cruda extends Omit<TareaVelocidad, "fecha_inicio" | "fecha_fin_real"> {
  fecha_inicio: string | null;
  fecha_fin_real: string | null;
}

export default function ReporteVelocidad({
  tareas,
  diasHabilesSemana,
  meta = 80,
}: {
  /** Fechas en ISO: un server component no puede pasar `Date` sin serializar. */
  tareas: Cruda[];
  /**
   * Jornada de la obra (`Proyecto.dias_habiles_semana`). OBLIGATORIA a
   * proposito: con un valor por defecto, una pantalla que se olvidara de
   * pasarla mediria con la jornada de otra obra y nadie lo notaria — el numero
   * sale igual de plausible.
   */
  diasHabilesSemana: number;
  meta?: number;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  /**
   * Periodo resaltado, por `orden`, compartido por las DOS graficas de arriba.
   *
   * Vive aqui y no en cada grafica porque el resaltado cruzado es justamente lo
   * que ensena que las dos hablan del mismo mes: una mide cuantas tareas
   * incumplieron y la otra por cuanto, y sin verlas senalar el mismo punto se
   * leen como dos reportes sueltos. La matriz de ciclo no entra: no tiene
   * periodo, es un promedio sobre toda la obra.
   */
  const [resaltado, setResaltado] = useState<number | null>(null);

  const datos = useMemo<TareaVelocidad[]>(
    () =>
      tareas.map((t) => ({
        ...t,
        fecha_inicio: t.fecha_inicio ? new Date(t.fecha_inicio) : null,
        fecha_fin_real: t.fecha_fin_real ? new Date(t.fecha_fin_real) : null,
      })),
    [tareas],
  );

  const disponibles = useMemo(() => periodosDisponibles(datos), [datos]);

  /**
   * El periodo que de verdad se dibuja.
   *
   * El elegido puede no tener datos suficientes: al abrir una obra joven, o al
   * cambiar a otra con menos historia. Se DERIVA en vez de corregir el estado,
   * por dos razones. Corrigiendo estado -en un efecto o durante el render- el
   * arreglo no corre en el PRIMER render, que es justo cuando una obra nueva
   * abre en "mes" sin tener tres meses; y ademas deriva en el error de lint
   * `set-state-in-effect`. Derivado no hay nada que sincronizar: si el elegido
   * sirve se usa, y si no se cae al de grano mas grueso que si tenga datos.
   */
  const periodoEfectivo = useMemo<Periodo>(() => {
    if (disponibles.has(periodo)) return periodo;
    const validos = PERIODOS.filter((p) => disponibles.has(p.clave));
    return validos.length > 0 ? validos[validos.length - 1].clave : periodo;
  }, [disponibles, periodo]);

  const serie = useMemo(
    () => serieVelocidad(datos, periodoEfectivo, diasHabilesSemana),
    [datos, periodoEfectivo, diasHabilesSemana],
  );

  // Las cuatro matrices se calculan de una: cambiar de dimension es instantaneo
  // y son recorridos baratos sobre la misma lista.
  const porDimension = useMemo(() => {
    const dims: Dimension[] = ["torre", "piso", "tipologia", "responsable"];
    return Object.fromEntries(
      dims.map((d) => [d, matrizCiclo(datos, d, diasHabilesSemana)]),
    ) as Record<Dimension, ReturnType<typeof matrizCiclo>>;
  }, [datos, diasHabilesSemana]);

  const ultimo = serie.length >= MINIMO_PUNTOS ? serie[serie.length - 1] : null;
  const previo = serie.length >= MINIMO_PUNTOS + 1 ? serie[serie.length - 2] : null;

  if (serie.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 mb-6">
        <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" /> Velocidad del equipo
        </h2>
        <p className="text-sm text-slate-400 mt-3">
          Todavía no hay tareas cerradas con fecha de inicio y de fin. En cuanto se aprueben las
          primeras, aquí aparece si el equipo va más rápido o más lento que el periodo pasado.
        </p>
      </div>
    );
  }

  const nombrePeriodo = PERIODOS.find((p) => p.clave === periodoEfectivo)!.nombre.toLowerCase();
  const pluralPeriodo = PLURAL_PERIODO[periodoEfectivo];

  // ── Las dos frases de primera lectura ────────────────────────────────────
  //
  // Describen la SERIE -el mejor y el peor periodo-, no el ultimo. El ultimo ya
  // lo dicen los tres indicadores de arriba, y repetirlo debajo de la grafica
  // gastaria el unico renglon que alguien va a leer en algo que ya sabe.
  const mejorPct = serie.reduce((a, b) => (b.pctATiempo > a.pctATiempo ? b : a));
  const peorPct = serie.reduce((a, b) => (b.pctATiempo < a.pctATiempo ? b : a));
  const enMeta = serie.filter((p) => p.pctATiempo >= meta).length;
  const cuantosMeta =
    enMeta === 0 ? "ninguno llegó" : enMeta === 1 ? "solo 1 llegó" : `${enMeta} llegaron`;

  const soloUno = serie.length < 2 || mejorPct.orden === peorPct.orden;
  const unico: PuntoVelocidad = serie[serie.length - 1];

  const lecturaATiempo = soloUno
    ? `En ${unico.etiqueta} cerraron ${unico.cerradas} ${
        unico.cerradas === 1 ? "tarea" : "tareas"
      } y ${unico.aTiempo} llegaron dentro de su plazo: ${unico.pctATiempo}%, contra una meta de ${meta}%.`
    : `El mejor ${nombrePeriodo} fue ${mejorPct.etiqueta}, con ${mejorPct.pctATiempo}% de las tareas dentro del plazo, y el peor ${peorPct.etiqueta}, con ${peorPct.pctATiempo}%. De ${serie.length} ${pluralPeriodo} con tareas cerradas, ${cuantosMeta} a la meta de ${meta}%.`;

  const masLento = serie.reduce((a, b) => (b.diasDeMas > a.diasDeMas ? b : a));
  const masRapido = serie.reduce((a, b) => (b.diasDeMas < a.diasDeMas ? b : a));

  const lecturaDias =
    serie.length < 2 || masLento.orden === masRapido.orden
      ? `En ${unico.etiqueta}, en promedio, cada tarea ${contraPlazo(unico.diasDeMas)}.`
      : `El peor ${nombrePeriodo} fue ${masLento.etiqueta}: en promedio, cada tarea ${contraPlazo(
          masLento.diasDeMas,
        )}. El mejor fue ${masRapido.etiqueta}, con ${contraPlazoCorto(masRapido.diasDeMas)}.`;

  const puntos = previo ? ultimo!.pctATiempo - previo.pctATiempo : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" /> Velocidad del equipo
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-[70ch] leading-relaxed">
            ¿El equipo está cerrando las tareas en el plazo que se le puso? Aquí se compara lo que
            tardó cada tarea contra lo que se acordó que tardara. Todos los días de esta pantalla son{" "}
            <strong className="font-semibold text-slate-600">días hábiles</strong>: esta obra trabaja{" "}
            {diasHabilesSemana} días a la semana, así que los domingos y los festivos no cuentan.
          </p>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Período</span>
          <select
            value={periodoEfectivo}
            onChange={(e) => {
              // `orden` numera los cubos del periodo actual: en semanas el 7 es
              // otra cosa que en meses. Soltarlo aqui evita resaltar un cubo
              // que ya no es el que el usuario habia senalado.
              setResaltado(null);
              setPeriodo(e.target.value as Periodo);
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer"
          >
            {PERIODOS.map((p) => (
              <option key={p.clave} value={p.clave} disabled={!disponibles.has(p.clave)}>
                {disponibles.has(p.clave) ? p.nombre : `${p.nombre} (sin datos suficientes)`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ultimo && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="text-[11px] font-semibold text-slate-500">Cerraron dentro del plazo</div>
            <div className="text-2xl font-extrabold tabular-nums text-slate-900 mt-1">
              {ultimo.pctATiempo}
              <span className="text-lg font-bold">%</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              {ultimo.aTiempo} de {ultimo.cerradas}{" "}
              {ultimo.cerradas === 1 ? "tarea cerrada" : "tareas cerradas"} en {ultimo.etiqueta}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="text-[11px] font-semibold text-slate-500">
              {Math.abs(ultimo.diasDeMas) < CERO
                ? "Cerraron justo en el plazo"
                : ultimo.diasDeMas > 0
                  ? "Se pasaron del plazo"
                  : "Cerraron antes del plazo"}
            </div>
            <div
              className={`text-2xl font-extrabold tabular-nums mt-1 ${
                Math.abs(ultimo.diasDeMas) < CERO
                  ? "text-slate-900"
                  : ultimo.diasDeMas > 0
                    ? "text-red-600"
                    : "text-green-600"
              }`}
            >
              {/* Sin signo, a proposito: el rotulo de arriba ya dice la
                  direccion. «Cerraron antes del plazo −5,00 dias» obliga a
                  leer dos veces para decidir si el menos suma o resta a lo que
                  acaba de decir la palabra. En el tercer indicador el signo SI
                  se queda, porque alli «Contra el mes anterior» no dice hacia
                  donde. */}
              {nDias(ultimo.diasDeMas)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              {/* «habiles» no es un adorno: la metrica descuenta domingos y los
                  18 festivos colombianos, y decir solo «dias» invita a que
                  alguien compare este numero contra el almanaque. */}
              días <b className="font-semibold">hábiles</b> por tarea, en promedio · {ultimo.etiqueta}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold text-slate-500">Contra el {nombrePeriodo} anterior</div>
            {previo ? (
              <>
                <div
                  className={`text-2xl font-extrabold tabular-nums mt-1 ${
                    puntos === 0 ? "text-slate-900" : puntos > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {puntos === 0 ? (
                    "Igual"
                  ) : (
                    <>
                      {puntos > 0 ? "+" : "−"}
                      {Math.abs(puntos)}
                      <span className="text-base font-bold ml-1">
                        {Math.abs(puntos) === 1 ? "punto" : "puntos"}
                      </span>
                    </>
                  )}
                </div>
                <div className="text-[11px] font-semibold text-slate-400">
                  de {previo.pctATiempo}% en {previo.etiqueta} a {ultimo.pctATiempo}% en{" "}
                  {ultimo.etiqueta}
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 mt-2">
                Sin {nombrePeriodo} anterior con el que comparar
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-[13px] font-bold text-slate-700">¿Cuántas tareas cerraron a tiempo?</span>
        <span className="text-[11px] text-slate-400">
          Señala un {nombrePeriodo} —con el dedo, el ratón o las flechas— y se resalta en las dos gráficas
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3 max-w-[70ch]">
        De cada {nombrePeriodo}, qué porcentaje de las tareas que se cerraron no se pasó de su plazo.
        La raya punteada es la meta de la obra: {meta}%.
      </p>
      {/* Mas alla de unos 1000px las columnas se separan tanto que dejan de
          compararse de un vistazo: no es un limite estetico, es donde el ojo
          pierde la fila. */}
      <div className="max-w-[1000px]">
        <GraficaATiempo serie={serie} meta={meta} resaltado={resaltado} onResaltar={setResaltado} />
      </div>
      <p className={LECTURA}>{lecturaATiempo}</p>

      <div className="mt-7 mb-2 text-[13px] font-bold text-slate-700">
        ¿Por cuánto se pasaron del plazo?
      </div>
      <p className="text-xs text-slate-500 mb-3 max-w-[70ch]">
        Días hábiles que tardó cada tarea de más —o de menos— frente al plazo acordado, en
        promedio. Un <b>−</b> quiere decir que terminaron <b>antes</b>; un <b>+</b>, que se
        pasaron. En el dibujo eso se lee por altura: <b>cuanto más arriba, mejor</b>. La gráfica
        de arriba dice cuántas incumplieron; ésta dice por cuánto.
      </p>
      {/* Mismo limite que la grafica de arriba, y por la misma razon. */}
      <div className="max-w-[1000px]">
        <GraficaDiasDeMas serie={serie} resaltado={resaltado} onResaltar={setResaltado} />
      </div>
      <p className={LECTURA}>{lecturaDias}</p>

      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          <span className="text-[13px] font-bold text-slate-700">¿Dónde se está demorando la obra?</span>
        </div>
        <p className="text-xs text-slate-500 mb-4 max-w-[70ch] leading-relaxed">
          Días hábiles que tarda cada fase en una unidad —un apartamento, un local, una casa—, desde
          que arranca su primera tarea hasta que se aprueba la última. Aquí se compara el mismo
          trabajo consigo mismo: mampostería contra mampostería. Es la única de las tres que no se
          distorsiona porque una fase sea más pesada que otra.
        </p>
        <MatrizCiclo porDimension={porDimension} />
      </div>

      <p className="mt-6 text-[11px] text-slate-400 leading-relaxed max-w-[80ch]">
        El reloj de una tarea arranca en su fecha de inicio registrada y para cuando se aprueba, así
        que incluye lo que esperó a que alguien la revisara. Sirve para comparar unos periodos con
        otros —el sesgo es el mismo en todos— pero no para afirmar cuántos días de mano de obra costó
        una tarea.
      </p>
    </div>
  );
}
