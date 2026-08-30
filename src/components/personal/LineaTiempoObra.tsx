"use client";

// ─────────────────────────────────────────────────────────────────────────
// LÍNEA DE BALANCE de la obra (B2C). Mobile-first.
//
// Cada fila es una fase y cada barrita dentro de la fila es un ESPACIO: verlas
// escalonadas es exactamente la línea de balance —mientras el estuco del baño
// 1 fragua, la cuadrilla estuca el baño 2 y el 1 ya puede recibir pintura—.
// La RUTA CRÍTICA va marcada: son las tareas que, si se retrasan un día,
// retrasan la entrega un día. Y se pinta el OVERHEAD (movilización, compras,
// replanteo, entrega), porque el total lo incluye y si no las barras no darían
// la cifra de arriba.
//
// ══ DE «~62 DÍAS HÁBILES» A UNA FECHA ══════════════════════════════════════
//
// La cabecera decía «esto suele tomar ~62 días hábiles (entre 37 y 85)». Ese
// paréntesis eran dos escenarios comonotónicos —todas las tareas mal a la vez—
// y NO percentiles: no se podía decir con ellos «80% de probabilidad». Y el
// «días hábiles» obligaba al usuario a una conversión de calendario que no
// tiene por qué saber hacer. Ahora la cabecera dice una FECHA y con qué
// frecuencia se cumple, y las franjas de cada fase se rotulan con días del
// calendario en vez de con «día 12 → día 30».
//
// Cuando el componente sabe a qué PROYECTO pertenece, la distribución sale del
// MONTE CARLO sembrado con su id (misma obra, misma fecha, siempre) en vez de
// la forma cerrada: es la que mide el sesgo de fusión, y en una obra con
// varios frentes abiertos ese sesgo vale hasta un 5% del plazo.
// ─────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { ChevronDown, CalendarClock, GitBranch, Zap } from "lucide-react";
import { addWorkingDays, DIAS_HABILES_SEMANA_DEFECTO } from "@/lib/calendario-colombia";
import {
  estimarDuracion,
  fechaCorta,
  fechaLarga,
  fechaUTCDesde,
  pronosticoFechas,
  type EspacioEstim,
  type FaseDuracion,
  type TareaDuracion,
} from "@/lib/estimar-duracion";

/** Redondeo amable a días enteros (mínimo 1) para las etiquetas de trabajo. */
function dias(n: number): number {
  return Math.max(1, Math.round(n));
}

function plural(n: number): string {
  return n === 1 ? "día" : "días";
}

/** Un tramo dibujable: un espacio dentro de una fase. */
interface Tramo {
  espacio: string;
  inicio: number;
  fin: number;
  critico: boolean;
}

/** Agrupa las tareas de una fase por espacio y devuelve su franja de tiempo. */
function tramosDeFase(tareas: TareaDuracion[]): Tramo[] {
  const porEspacio = new Map<string, Tramo>();
  for (const t of tareas) {
    const previo = porEspacio.get(t.espacio);
    if (previo) {
      previo.inicio = Math.min(previo.inicio, t.inicioDias);
      previo.fin = Math.max(previo.fin, t.finDias);
      previo.critico = previo.critico || t.critico;
    } else {
      porEspacio.set(t.espacio, {
        espacio: t.espacio,
        inicio: t.inicioDias,
        fin: t.finDias,
        critico: t.critico,
      });
    }
  }
  return [...porEspacio.values()].sort((a, b) => a.inicio - b.inicio);
}

function FilaFase({
  fase,
  esRama,
  escala,
  enFecha,
}: {
  fase: FaseDuracion;
  esRama: boolean;
  escala: number;
  /** Día de obra (hábil) → etiqueta de calendario. */
  enFecha: (dia: number) => string;
}) {
  const tramos = tramosDeFase(fase.tareas);
  const pct = (x: number) => (escala > 0 ? Math.min(100, Math.max(0, (x / escala) * 100)) : 0);

  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="font-semibold text-slate-800 text-sm">{fase.fase}</p>
        <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
          ~{dias(fase.dias)} {plural(dias(fase.dias))} de trabajo
        </span>
      </div>

      {/* La franja de tiempo: una barrita por espacio, escalonadas. */}
      <div className="relative mt-1.5 h-3 rounded-full bg-slate-100 overflow-hidden">
        {tramos.map((tr) => (
          <span
            key={`${fase.fase}-${tr.espacio}`}
            title={`${tr.espacio}: ${enFecha(tr.inicio)} a ${enFecha(tr.fin)}${tr.critico ? " (ruta crítica)" : ""}`}
            className={`absolute inset-y-0 rounded-full border ${
              tr.critico
                ? "bg-amber-400 border-amber-500"
                : esRama
                  ? "bg-violet-400 border-violet-500"
                  : "bg-blue-500 border-blue-600"
            }`}
            style={{
              left: `${pct(tr.inicio)}%`,
              width: `${Math.max(1.2, pct(tr.fin) - pct(tr.inicio))}%`,
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-1">
        <span className="text-[11px] text-slate-400">
          {enFecha(fase.inicioDias)} → {enFecha(fase.finDias)}
          {tramos.length > 1 ? ` · ${tramos.length} espacios` : ""}
        </span>
        {esRama && (
          <span className="text-[11px] text-violet-600 font-medium inline-flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> otro oficio, en paralelo
          </span>
        )}
        {fase.esperaDias >= 1 && (
          <span className="text-[11px] text-slate-400">
            + {dias(fase.esperaDias)} {plural(dias(fase.esperaDias))} de secado
            {fase.esperaEfectivaDias < 0.5
              ? " (se aprovechan en otros espacios)"
              : ` (${dias(fase.esperaEfectivaDias)} ${plural(dias(fase.esperaEfectivaDias))} de espera real)`}
          </span>
        )}
      </div>
    </li>
  );
}

export default function LineaTiempoObra({
  espacios,
  areaTotal,
  colapsable = false,
  defaultAbierto = true,
  titulo = "Cómo avanzaría tu obra en el tiempo",
  proyectoId,
  fechaInicio,
  diasHabilesSemana = DIAS_HABILES_SEMANA_DEFECTO,
}: {
  espacios: EspacioEstim[];
  areaTotal?: number;
  /** Muestra encabezado plegable (para el detalle del proyecto). */
  colapsable?: boolean;
  defaultAbierto?: boolean;
  titulo?: string;
  /**
   * Id del proyecto. Enciende el Monte Carlo y es su SEMILLA: la misma obra
   * da siempre la misma fecha, en el servidor y en el navegador.
   */
  proyectoId?: string;
  /** Arranque de la obra. Sin él se ancla en hoy («si arrancas hoy…»). */
  fechaInicio?: string | Date | null;
  diasHabilesSemana?: number;
}) {
  const [abierto, setAbierto] = useState(defaultAbierto);
  const [hoy] = useState(() => new Date());

  // `diasHabilesSemana` va al MOTOR además de al calendario: es el ρ que
  // convierte las esperas de secado (días calendario) en días de obra. Sin
  // pasarlo, la barra se dibujaba con la jornada por defecto (6) y las fechas
  // con la del proyecto — la línea de tiempo no cuadraba con su propia fecha
  // de fin en cuanto `Proyecto.dias_habiles_semana` no era 6.
  const resultado = useMemo(
    () =>
      estimarDuracion(espacios, {
        cuadrillas: 1,
        diasHabilesSemana,
        ...(areaTotal ? { areaTotal } : {}),
        ...(proyectoId ? { montecarlo: { semilla: proyectoId } } : {}),
      }),
    [espacios, areaTotal, proyectoId, diasHabilesSemana],
  );

  // En orden de CALENDARIO, no de lista constructiva: es lo que hace que se
  // vea el escalonamiento. A igual arranque manda el orden constructivo.
  const orden = useMemo(() => {
    const indice = new Map(resultado.fases.map((f, i) => [f.fase, i]));
    return [...resultado.fases].sort(
      (a, b) =>
        a.inicioDias - b.inicioDias || (indice.get(a.fase) ?? 0) - (indice.get(b.fase) ?? 0),
    );
  }, [resultado.fases]);

  if (resultado.fases.length === 0) return null;

  const dist = resultado.probabilidad;
  const inicio = fechaUTCDesde(fechaInicio) ?? fechaUTCDesde(hoy)!;
  const arrancaHoy = fechaUTCDesde(fechaInicio) === null;
  const pron = pronosticoFechas(dist, { inicio, diasHabilesSemana });
  /** Día de obra (en días hábiles desde el arranque) → «18 sep». */
  const enFecha = (dia: number): string =>
    fechaCorta(addWorkingDays(inicio, Math.max(0, Math.round(dia)), diasHabilesSemana));

  const escala = Math.max(dist.p50, ...resultado.fases.map((f) => f.finDias));
  // La segunda fase de cada pareja paralela se dibuja como rama (violeta).
  const ramas = new Set<string>();
  for (const f of resultado.fases) {
    const par = f.enParaleloCon[0];
    if (par && !ramas.has(f.fase)) ramas.add(par);
  }
  // Se cuentan las tareas SIN HOLGURA, que es exactamente lo que se pinta en
  // ámbar. `cronograma.rutaCritica` es solo UNA cadena de esas, así que usarla
  // aquí diría un número menor del que el usuario ve marcado.
  const criticas = resultado.fases.reduce(
    (n, f) => n + f.tareas.filter((t) => t.critico).length,
    0,
  );

  const cuerpo = (
    <div className="mt-1">
      <div className="rounded-xl bg-blue-50/60 border border-blue-100 px-3.5 py-2.5 mb-3 text-sm text-slate-700">
        {arrancaHoy ? "Si arrancas hoy, lo" : "Lo"} más probable es que termines el{" "}
        <strong className="text-slate-900">{fechaLarga(pron.fechaP50, inicio)}</strong>. En 8 de
        cada 10 obras parecidas, se termina antes del{" "}
        <strong className="text-slate-900">{fechaLarga(pron.fechaP80, inicio)}</strong>.
      </div>

      {/* El overhead: la franja que abre y cierra la obra. Se dibuja porque el
          total la incluye — si no, las barras no darían la cifra de arriba. */}
      {resultado.overheadDias > 0 && (
        <div className="mb-1.5">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="font-semibold text-slate-600 text-sm">Arranque y entrega</p>
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              ~{dias(resultado.overheadDias)} {plural(dias(resultado.overheadDias))}
            </span>
          </div>
          <div className="relative mt-1.5 h-3 rounded-full bg-slate-100 overflow-hidden">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-slate-400 border border-slate-500"
              style={{
                width: `${escala > 0 ? Math.max(1.2, (resultado.overheadDias / escala) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Movilización, compras, replanteo y entrega final. No es trabajo de ninguna fase.
          </p>
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {orden.map((f) => (
          <FilaFase
            key={f.fase}
            fase={f}
            esRama={ramas.has(f.fase)}
            escala={escala}
            enFecha={enFecha}
          />
        ))}
      </ul>

      <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-amber-50/70 border border-amber-100 px-3 py-2">
        <Zap className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Lo marcado en <span className="font-semibold text-amber-700">ámbar</span> es la ruta
          crítica: {criticas} {criticas === 1 ? "tarea que no tiene" : "tareas que no tienen"}{" "}
          holgura, así que un día de retraso ahí es un día de retraso en la entrega. Las demás
          pueden moverse sin mover la fecha.
        </p>
      </div>

      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
        Si quieres ir sobre seguro, la fecha que casi nunca se pasa es el{" "}
        {fechaLarga(pron.fechaP95, inicio)}.
        {dist.cobertura < 0.5
          ? " Es un estimado de referencia; se afina a medida que registras el avance real de la obra."
          : ""}
      </p>
    </div>
  );

  if (!colapsable) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600" /> {titulo}
        </p>
        {cuerpo}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600" /> {titulo}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {fechaLarga(pron.fechaP50, inicio)}
          <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
        </span>
      </button>
      {abierto && <div className="px-4 pb-4">{cuerpo}</div>}
    </div>
  );
}
