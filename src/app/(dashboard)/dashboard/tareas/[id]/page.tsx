import { redirect, notFound } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { getTareaDetalle } from "@/lib/data-detail";
import Topbar from "@/components/dashboard/Topbar";
import ReportarButton from "@/components/dashboard/ReportarButton";
import AprobarButtons from "@/components/dashboard/AprobarButtons";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  XCircle,
  AlertTriangle,
  Layers,
} from "lucide-react";

type SemaforoLevel = "verde-intenso" | "verde" | "amarillo" | "rojo" | "vinotinto";

const semaforoConfig: Record<SemaforoLevel, { dot: string; label: string; bg: string; text: string }> = {
  "verde-intenso": { dot: "bg-green-700", label: "Adelantado", bg: "bg-green-50", text: "text-green-700" },
  verde: { dot: "bg-green-500", label: "A tiempo", bg: "bg-green-50", text: "text-green-600" },
  amarillo: { dot: "bg-yellow-400", label: "Alerta", bg: "bg-yellow-50", text: "text-yellow-600" },
  rojo: { dot: "bg-red-500", label: "Retraso", bg: "bg-red-50", text: "text-red-600" },
  vinotinto: { dot: "bg-red-900", label: "Crítico", bg: "bg-red-50", text: "text-red-900" },
};

const estadoConfig: Record<string, { icon: typeof Clock; label: string; class: string }> = {
  PENDIENTE: { icon: Clock, label: "Pendiente", class: "text-slate-600 bg-slate-50 border-slate-200" },
  REPORTADA: { icon: AlertTriangle, label: "Reportada", class: "text-blue-600 bg-blue-50 border-blue-200" },
  APROBADA: { icon: CheckCircle2, label: "Aprobada", class: "text-green-600 bg-green-50 border-green-200" },
  NO_APROBADA: { icon: XCircle, label: "No aprobada", class: "text-red-600 bg-red-50 border-red-200" },
};

export default async function TareaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  const { id } = await params;
  const tarea = await getTareaDetalle(id);
  if (!tarea) notFound();

  const sem = semaforoConfig[tarea.semaforo as SemaforoLevel] ?? semaforoConfig.verde;
  const est = estadoConfig[tarea.estado] ?? estadoConfig.PENDIENTE;
  const EstadoIcon = est.icon;

  const puedeReportar = tarea.estado === "PENDIENTE" || tarea.estado === "NO_APROBADA";
  const puedeAprobar = tarea.estado === "REPORTADA";

  return (
    <>
      <Topbar title="Detalle de tarea" subtitle={tarea.nombre} />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Back link */}
        <Link
          href="/dashboard/tareas"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a tareas
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Header card */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">{tarea.nombre}</h2>
                  {tarea.codigo_referencia && (
                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">
                      {tarea.codigo_referencia}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${sem.bg} ${sem.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sem.dot}`} />
                    {sem.label}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${est.class}`}>
                    <EstadoIcon className="w-3.5 h-3.5" />
                    {est.label}
                  </span>
                </div>
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{tarea.ubicacion}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>{tarea.fase.nombre}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{tarea.tiempo_acordado_dias} días acordados</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>
                    {tarea.diasRestantes >= 0
                      ? `${tarea.diasRestantes}d restantes`
                      : `${Math.abs(tarea.diasRestantes)}d de atraso`}
                  </span>
                </div>
              </div>

              {/* Extra details */}
              {(tarea.marca_linea || tarea.componentes) && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                  {tarea.marca_linea && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                      Marca: {tarea.marca_linea}
                    </span>
                  )}
                  {tarea.componentes && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                      {tarea.componentes}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {(puedeReportar || puedeAprobar) && (
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Acciones</h3>
                {puedeReportar && <ReportarButton tareaId={tarea.id} />}
                {puedeAprobar && <AprobarButtons tareaId={tarea.id} />}
              </div>
            )}

            {/* Approval history */}
            {tarea.aprobaciones.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Historial de aprobaciones</h3>
                <div className="flex flex-col gap-3">
                  {tarea.aprobaciones.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 text-sm">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${a.estado === "APROBADA" ? "bg-green-100" : "bg-red-100"}`}>
                        {a.estado === "APROBADA" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">
                          {a.estado === "APROBADA" ? "Aprobada" : "No aprobada"}
                        </span>
                        <span className="text-slate-500"> por {a.aprobador.nombre}</span>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {new Date(a.fecha).toLocaleDateString("es-CO", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {a.justificacion_por_item && (
                          <div className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            {typeof a.justificacion_por_item === "object"
                              ? (a.justificacion_por_item as Record<string, string>).motivo ?? JSON.stringify(a.justificacion_por_item)
                              : String(a.justificacion_por_item)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Contractor */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-bold text-slate-800 mb-3">Contratista asignado</h3>
              {tarea.asignado_usuario ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
                    {tarea.asignado_usuario.nombre
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{tarea.asignado_usuario.nombre}</div>
                    <div className="text-xs text-slate-500">{tarea.asignado_usuario.rol.replace(/_/g, " ").toLowerCase()}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin contratista asignado</p>
              )}
            </div>

            {/* Project info */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-bold text-slate-800 mb-3">Proyecto</h3>
              <Link
                href={`/dashboard/proyectos/${tarea.proyecto.id}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {tarea.proyecto.nombre} →
              </Link>
            </div>

            {/* Dates */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-bold text-slate-800 mb-3">Fechas</h3>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Inicio</span>
                  <span className="font-medium text-slate-800">
                    {tarea.fecha_inicio
                      ? new Date(tarea.fecha_inicio).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
                      : "Sin iniciar"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fin real</span>
                  <span className="font-medium text-slate-800">
                    {tarea.fecha_fin_real
                      ? new Date(tarea.fecha_fin_real).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Días transcurridos</span>
                  <span className="font-medium text-slate-800">{tarea.diasTranscurridos}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
