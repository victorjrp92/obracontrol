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
  type TareaVelocidad,
} from "@/lib/velocidad";
import GraficaATiempo from "./GraficaATiempo";
import GraficaDiasDeMas from "./GraficaDiasDeMas";
import MatrizCiclo from "./MatrizCiclo";

/** Minimo de periodos para que una serie cuente algo. Con uno no hay tendencia. */
const MINIMO_PUNTOS = 2;

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
          Todavia no hay tareas cerradas con fecha de inicio y de fin. En cuanto se aprueben las
          primeras, aqui aparece si el equipo va mas rapido o mas lento que el periodo pasado.
        </p>
      </div>
    );
  }

  const nombrePeriodo = PERIODOS.find((p) => p.clave === periodoEfectivo)!.nombre.toLowerCase();

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" /> Velocidad del equipo
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-[64ch]">
            Que tan rapido cerraron las tareas contra el plazo que se habia acordado para cada una.
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
            <div className="text-[11px] font-semibold text-slate-500">Ultimo {nombrePeriodo} cerrado</div>
            <div className="text-2xl font-extrabold tabular-nums text-slate-900 mt-1">
              {ultimo.pctATiempo}%
            </div>
            <div className="text-[11px] font-semibold text-slate-400">a tiempo</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="text-[11px] font-semibold text-slate-500">Se pasaron</div>
            <div
              className={`text-2xl font-extrabold tabular-nums mt-1 ${
                ultimo.diasDeMas > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {ultimo.diasDeMas > 0 ? "+" : "−"}
              {Math.abs(ultimo.diasDeMas).toFixed(2).replace(".", ",")}
            </div>
            <div className="text-[11px] font-semibold text-slate-400">dias en promedio</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold text-slate-500">Contra el {nombrePeriodo} anterior</div>
            {previo ? (
              <>
                <div
                  className={`text-2xl font-extrabold tabular-nums mt-1 ${
                    ultimo.pctATiempo >= previo.pctATiempo ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {ultimo.pctATiempo >= previo.pctATiempo ? "+" : "−"}
                  {Math.abs(ultimo.pctATiempo - previo.pctATiempo)} pts
                </div>
                <div className="text-[11px] font-semibold text-slate-400">
                  venia en {previo.pctATiempo}%
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 mt-2">Sin periodo anterior para comparar</div>
            )}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-[13px] font-bold text-slate-700">Tareas que cerraron a tiempo</span>
        <span className="text-[11px] text-slate-400">
          Señala un {nombrePeriodo} —con el dedo, el ratón o las flechas— y se resalta en las dos gráficas
        </span>
      </div>
      {/* Mas alla de unos 1000px las columnas se separan tanto que dejan de
          compararse de un vistazo: no es un limite estetico, es donde el ojo
          pierde la fila. */}
      <div className="max-w-[1000px]">
        <GraficaATiempo serie={serie} meta={meta} resaltado={resaltado} onResaltar={setResaltado} />
      </div>

      <div className="mt-7 mb-2 text-[13px] font-bold text-slate-700">
        Cuanto se pasaron del plazo, en dias
      </div>
      {/* Mismo limite que la grafica de arriba, y por la misma razon. */}
      <div className="max-w-[1000px]">
        <GraficaDiasDeMas serie={serie} resaltado={resaltado} onResaltar={setResaltado} />
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          <span className="text-[13px] font-bold text-slate-700">Dias que toma cada fase en una unidad</span>
        </div>
        <p className="text-xs text-slate-500 mb-4 max-w-[64ch]">
          Aqui se compara el mismo trabajo consigo mismo: mamposteria contra mamposteria. Es la unica
          de las tres que no se distorsiona porque una fase sea mas pesada que otra.
        </p>
        <MatrizCiclo porDimension={porDimension} />
      </div>

      <p className="mt-6 text-[11px] text-slate-400 leading-relaxed">
        El tiempo de una tarea se mide desde su fecha de inicio registrada hasta que se aprueba, asi que
        incluye la espera de revision. Sirve para comparar periodos entre si —el sesgo es el mismo en
        todos— pero no para afirmar cuantos dias de mano de obra costo una tarea.
      </p>
    </div>
  );
}
