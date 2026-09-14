// ---------------------------------------------------------------------------
// LA BITACORA DE OBRA, pintada.
//
// Server component a proposito: no hay ni un estado, ni un filtro que se
// resuelva en el navegador. Los filtros viven en la URL (`FiltrosBitacora`) y
// la paginacion son enlaces, asi que esta pantalla puede compartirse pegando el
// enlace y se imprime tal cual. Ademas evita mandar al navegador la lista
// entera de decisiones para no hacer nada con ella.
//
// Lo que esta pantalla NO puede hacer es esconder como mide. El tiempo de
// revision sale de una fecha que el sistema rellena al reportar
// (`Tarea.fecha_inicio`), no de una columna «fecha de reporte» que no existe.
// Por eso el metodo esta escrito en la propia tarjeta, no en una nota al pie ni
// en la documentacion: un numero de rendimiento de personas que no dice de
// donde sale es una acusacion, no un dato.
// ---------------------------------------------------------------------------

import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Info,
  MapPin,
  MessageSquareQuote,
  Undo2,
  Users,
} from "lucide-react";
import {
  formatearDuracionHoras,
  formatearPorcentaje,
  SUCESOS_POR_PAGINA,
  type FilaPersona,
  type SucesoBitacora,
} from "@/lib/bitacora";
import type { DatosBitacora } from "@/lib/data-bitacora";

export interface ParametrosBitacora {
  proyecto: string;
  persona?: string;
  fase?: string;
  torre?: string;
  desde?: string;
  hasta?: string;
}

export default function BitacoraObra({
  datos,
  params,
}: {
  datos: DatosBitacora;
  params: ParametrosBitacora;
}) {
  const { resumen, sucesos, totalSucesos, pagina, paginas } = datos;

  return (
    <div className="space-y-6">
      <ResumenDelPeriodo
        resumen={resumen}
        totalSucesos={totalSucesos}
        truncado={datos.resumenTruncado}
      />
      <TablaPersonas personas={resumen.personas} />
      <LineaDeSucesos
        sucesos={sucesos}
        totalSucesos={totalSucesos}
        pagina={pagina}
        paginas={paginas}
        params={params}
      />
    </div>
  );
}

// ─── Resumen del periodo ─────────────────────────────────────────────────────

function ResumenDelPeriodo({
  resumen,
  totalSucesos,
  truncado,
}: {
  resumen: DatosBitacora["resumen"];
  totalSucesos: number;
  truncado: boolean;
}) {
  const activas = resumen.personas.filter((p) => p.total > 0).length;
  const ausentes = resumen.personas.filter((p) => p.total === 0).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
      <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-blue-600" /> Decisiones del periodo
      </h2>
      <p className="text-xs text-slate-500 mt-1">
        Cada fila de abajo es una decision firmada: alguien aprobo o devolvio una tarea reportada.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <Dato etiqueta="Decisiones" valor={resumen.decisiones.toLocaleString("es-CO")} />
        <Dato
          etiqueta="Devoluciones"
          valor={resumen.devoluciones.toLocaleString("es-CO")}
          pie={
            resumen.decisiones > 0
              ? `${formatearPorcentaje(resumen.pctDevoluciones)} del total`
              : undefined
          }
          acento={resumen.devoluciones > 0 ? "ambar" : "neutro"}
        />
        <Dato etiqueta="Personas que firmaron" valor={String(activas)} />
        <Dato
          etiqueta="Sin firmar nada"
          valor={String(ausentes)}
          pie={ausentes > 0 ? "pueden aprobar y no lo hicieron" : undefined}
          acento={ausentes > 0 ? "ambar" : "neutro"}
        />
      </div>

      {truncado && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-4">
          El periodo tiene mas decisiones de las que entran en un resumen. Los numeros de arriba
          cubren solo las mas antiguas: acota el rango de fechas para que sean exactos.
        </p>
      )}

      {totalSucesos === 0 && (
        <p className="text-sm text-slate-400 mt-4">
          Con estos filtros no hay ninguna decision. Prueba a ampliar el rango de fechas.
        </p>
      )}
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  pie,
  acento = "neutro",
}: {
  etiqueta: string;
  valor: string;
  pie?: string;
  acento?: "neutro" | "ambar";
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        {etiqueta}
      </p>
      <p
        className={`text-xl font-bold mt-0.5 ${
          acento === "ambar" ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {valor}
      </p>
      {pie && <p className="text-[11px] text-slate-400 mt-0.5">{pie}</p>}
    </div>
  );
}

// ─── Una fila por persona ────────────────────────────────────────────────────

function TablaPersonas({ personas }: { personas: FilaPersona[] }) {
  if (personas.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-5 sm:px-6 pt-5 sm:pt-6">
        <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" /> Quien revisa, y cuanto tarda
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Los que pueden aprobar en esta obra, hayan firmado o no. El que aparece con cero no es un
          hueco en los datos: es alguien que no reviso nada en el periodo.
        </p>
        <p className="text-[11px] text-slate-400 mt-3 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          <span>
            El tiempo de revision se mide desde que la tarea quedo reportada hasta la firma. No
            existe una columna «fecha de reporte»: se usa <code>fecha_inicio</code>, que el sistema
            rellena al reportar y no vuelve a tocar. Por eso solo se mide la PRIMERA decision de
            cada tarea — en un segundo intento esa marca ya incluye lo que tardo el contratista en
            rehacer el trabajo, que no es tiempo de nadie que revise.
          </span>
        </p>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/60 text-left">
              <Th>Persona</Th>
              <Th alineada>Aprobo</Th>
              <Th alineada>Devolvio</Th>
              <Th alineada>% devuelto</Th>
              <Th alineada>Tarda en revisar</Th>
              <Th alineada>Medido sobre</Th>
            </tr>
          </thead>
          <tbody>
            {personas.map((p) => (
              <tr key={p.aprobadorId} className="border-b border-slate-50 last:border-0">
                <td className="px-4 sm:px-6 py-3">
                  <span className="font-medium text-slate-800">{p.nombre}</span>
                  {p.total === 0 && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                      sin decisiones
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{p.aprobadas}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{p.devueltas}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                  {p.total > 0 ? formatearPorcentaje(p.pctDevueltas) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {formatearDuracionHoras(p.horasMediana)}
                  </span>
                  {p.horasMedia !== null && (
                    <span className="block text-[11px] text-slate-400 tabular-nums">
                      media {formatearDuracionHoras(p.horasMedia)}
                    </span>
                  )}
                </td>
                <td className="px-4 sm:px-6 py-3 text-right tabular-nums text-slate-400 text-xs">
                  {p.medibles} de {p.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 px-5 sm:px-6 py-3 border-t border-slate-50">
        La columna grande es la MEDIANA y la pequena la media. Cuando la media es mucho mayor, no es
        ruido: hay tareas olvidadas en la bandeja tirando del promedio.
      </p>
    </div>
  );
}

function Th({ children, alineada = false }: { children: React.ReactNode; alineada?: boolean }) {
  return (
    <th
      className={`px-4 first:pl-4 sm:first:pl-6 last:pr-4 sm:last:pr-6 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 ${
        alineada ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

// ─── La linea de sucesos ─────────────────────────────────────────────────────

function LineaDeSucesos({
  sucesos,
  totalSucesos,
  pagina,
  paginas,
  params,
}: {
  sucesos: SucesoBitacora[];
  totalSucesos: number;
  pagina: number;
  paginas: number;
  params: ParametrosBitacora;
}) {
  if (sucesos.length === 0) return null;

  // El primer indice sale del TAMANO de pagina, no de cuantos elementos trajo
  // esta: la ultima viene corta y con `sucesos.length` el rango se desplazaria
  // hacia atras justo en la pagina final.
  const desde = (pagina - 1) * SUCESOS_POR_PAGINA + 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-900 text-base">Bitacora</h2>
        <span className="text-xs text-slate-400 tabular-nums">
          {desde}–{desde + sucesos.length - 1} de {totalSucesos.toLocaleString("es-CO")}
        </span>
      </div>

      <ul className="divide-y divide-slate-50">
        {sucesos.map((s) => (
          <FilaSuceso key={s.decisionId} suceso={s} />
        ))}
      </ul>

      <Paginacion pagina={pagina} paginas={paginas} params={params} />
    </div>
  );
}

function FilaSuceso({ suceso: s }: { suceso: SucesoBitacora }) {
  const devuelta = s.estado === "NO_APROBADA";

  return (
    <li className="px-5 sm:px-6 py-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
            devuelta ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {devuelta ? <Undo2 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        </span>

        <div className="min-w-0 flex-1">
          {/* QUE: la tarea y donde esta */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-slate-900 text-sm">{s.tareaNombre}</span>
            {s.numeroRegistro && (
              <span className="text-[10px] font-mono text-slate-400">{s.numeroRegistro}</span>
            )}
            {s.intentosTotales > 1 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
                intento {s.intento} de {s.intentosTotales}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <MapPin className="w-3 h-3 flex-shrink-0 text-slate-300" />
            <span>
              {s.torre} · Piso {s.piso} · {s.unidad} · {s.espacio}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">{s.fase}</span>
          </p>

          {/* QUIEN reporto y CUANDO */}
          <p className="text-xs text-slate-600 mt-2">
            <span className="text-slate-400">Reporto</span>{" "}
            <span className="font-medium text-slate-700">{s.reportadoPor ?? "sin registrar"}</span>
            {s.reportadoPorFuente === "asignado" && (
              <span className="text-slate-400"> (responsable de la tarea)</span>
            )}
            {s.fechaReporte && (
              <>
                <span className="text-slate-400"> el </span>
                {fechaHora(s.fechaReporte)}
              </>
            )}
          </p>

          {/* QUIEN decidio, CUANDO y en cuanto tiempo */}
          <p className="text-xs text-slate-600 mt-1">
            <span className={devuelta ? "text-red-600 font-medium" : "text-emerald-700 font-medium"}>
              {devuelta ? "Devolvio" : "Aprobo"}
            </span>{" "}
            <span className="font-medium text-slate-700">{s.aprobador}</span>
            <span className="text-slate-400"> el </span>
            {fechaHora(s.fechaDecision)}
            {s.horasRevision !== null && (
              <span className="text-slate-400">
                {" "}
                · reviso en {formatearDuracionHoras(s.horasRevision)}
              </span>
            )}
          </p>

          {devuelta && (
            <p className="text-xs mt-2 rounded-lg bg-red-50/70 border border-red-100 px-3 py-2 text-red-800">
              <span className="font-semibold">Motivo: </span>
              {s.motivo ?? (
                <span className="italic text-red-500">devuelta sin motivo escrito</span>
              )}
            </p>
          )}

          {s.notaReporte && (
            <p className="text-xs mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-slate-600 flex items-start gap-1.5">
              <MessageSquareQuote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-300" />
              <span>
                <span className="font-semibold text-slate-500">Nota del reporte: </span>
                {s.notaReporte}
              </span>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── Paginacion ──────────────────────────────────────────────────────────────

function Paginacion({
  pagina,
  paginas,
  params,
}: {
  pagina: number;
  paginas: number;
  params: ParametrosBitacora;
}) {
  if (paginas <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 border-t border-slate-100">
      <EnlacePagina params={params} destino={pagina - 1} activa={pagina > 1}>
        <ChevronLeft className="w-3.5 h-3.5" /> Anteriores
      </EnlacePagina>
      <span className="text-xs text-slate-400 tabular-nums">
        Pagina {pagina} de {paginas}
      </span>
      <EnlacePagina params={params} destino={pagina + 1} activa={pagina < paginas}>
        Siguientes <ChevronRight className="w-3.5 h-3.5" />
      </EnlacePagina>
    </div>
  );
}

function EnlacePagina({
  params,
  destino,
  activa,
  children,
}: {
  params: ParametrosBitacora;
  destino: number;
  activa: boolean;
  children: React.ReactNode;
}) {
  const clases =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors";

  if (!activa) {
    return (
      <span className={`${clases} border-slate-100 text-slate-300 cursor-default`}>{children}</span>
    );
  }

  return (
    <Link
      href={construirHref(params, destino)}
      className={`${clases} border-slate-200 text-slate-600 hover:border-slate-300`}
    >
      {children}
    </Link>
  );
}

/** La URL de otra pagina conservando los filtros: perderlos al pasar de pagina es perder el sitio. */
export function construirHref(params: ParametrosBitacora, pagina: number): string {
  const sp = new URLSearchParams();
  sp.set("proyecto", params.proyecto);
  if (params.persona) sp.set("persona", params.persona);
  if (params.fase) sp.set("fase", params.fase);
  if (params.torre) sp.set("torre", params.torre);
  if (params.desde) sp.set("desde", params.desde);
  if (params.hasta) sp.set("hasta", params.hasta);
  if (pagina > 1) sp.set("pagina", String(pagina));
  return `/dashboard/reportes/bitacora?${sp.toString()}`;
}

/** Fecha y hora en el formato corto que ya usa el resto del dashboard. */
function fechaHora(d: Date) {
  return (
    <span className="text-slate-700 tabular-nums">
      {d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
      <span className="text-slate-400">
        {" "}
        {d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </span>
  );
}
