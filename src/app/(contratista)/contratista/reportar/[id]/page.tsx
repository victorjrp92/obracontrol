import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { getTareaDetalle } from "@/lib/data-detail";
import Topbar from "@/components/dashboard/Topbar";
import ReportarButton from "@/components/dashboard/ReportarButton";
import EvidenceGallery from "@/components/evidencia/EvidenceGallery";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  XCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

const estadoConfig: Record<string, { Icon: typeof Clock; label: string; class: string }> = {
  PENDIENTE: { Icon: Clock, label: "Pendiente", class: "text-slate-600 bg-slate-50 border-slate-200" },
  REPORTADA: { Icon: AlertTriangle, label: "Reportada", class: "text-blue-600 bg-blue-50 border-blue-200" },
  APROBADA: { Icon: CheckCircle2, label: "Aprobada", class: "text-green-600 bg-green-50 border-green-200" },
  NO_APROBADA: { Icon: XCircle, label: "Rechazada", class: "text-red-600 bg-red-50 border-red-200" },
};

export default async function ReportarTareaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  const { id } = await params;
  const tarea = await getTareaDetalle(id);
  if (!tarea) notFound();

  if (tarea.asignado_a !== usuario.id) {
    redirect("/contratista/reportar");
  }
  if (tarea.proyecto.constructora_id !== usuario.constructora_id) {
    notFound();
  }

  const est = estadoConfig[tarea.estado] ?? estadoConfig.PENDIENTE;
  const EstIcon = est.Icon;
  const puedeReportar = tarea.estado === "PENDIENTE" || tarea.estado === "NO_APROBADA";

  const ultimoRechazo = tarea.aprobaciones.find((a) => a.estado === "NO_APROBADA");
  const motivoRechazo =
    ultimoRechazo && typeof ultimoRechazo.justificacion_por_item === "object" && ultimoRechazo.justificacion_por_item !== null
      ? (ultimoRechazo.justificacion_por_item as Record<string, string>).motivo ?? null
      : null;

  return (
    <>
      <Topbar title="Detalle de tarea" subtitle={tarea.nombre} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Link
          href="/contratista/reportar"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Reportar tareas
        </Link>

        <div className="flex flex-col gap-4 sm:gap-6 max-w-3xl">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div className="min-w-0">
                {tarea.numero_registro && (
                  <span className="block font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded mb-1 w-fit">
                    {tarea.numero_registro}
                  </span>
                )}
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 break-words">{tarea.nombre}</h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${est.class}`}
              >
                <EstIcon className="w-3.5 h-3.5" />
                {est.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
                <span>
                  Fecha límite:{" "}
                  {tarea.fecha_inicio
                    ? new Date(
                        tarea.fecha_inicio.getTime() + tarea.tiempo_acordado_dias * 86400000,
                      ).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
                    : `${tarea.tiempo_acordado_dias} días desde el inicio`}
                </span>
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
          </div>

          {tarea.estado === "NO_APROBADA" && motivoRechazo && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-red-700 mb-1">Motivo del rechazo</h3>
                  <p className="text-sm text-red-700">{motivoRechazo}</p>
                </div>
              </div>
            </div>
          )}

          {tarea.fotoReferenciaSignedUrl && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
              <h3 className="font-bold text-slate-800 mb-4">Foto de referencia</h3>
              <div className="rounded-xl overflow-hidden border border-slate-200">
                <img
                  src={tarea.fotoReferenciaSignedUrl}
                  alt="Foto de referencia"
                  className="w-full max-h-64 object-cover"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">Así debe quedar la tarea al completarse</p>
            </div>
          )}

          {puedeReportar ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
              <h3 className="font-bold text-slate-800 mb-4">Reportar avance</h3>
              <ReportarButton
                tareaId={tarea.id}
                proyectoNombre={tarea.proyecto.nombre}
                tareaNombre={tarea.nombre}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
              <h3 className="font-bold text-slate-800 mb-4">Evidencia enviada</h3>
              <EvidenceGallery
                evidencias={tarea.evidencias.map((e) => ({
                  id: e.id,
                  tipo: e.tipo,
                  url_storage: e.url_storage,
                  gps_lat: e.gps_lat,
                  gps_lng: e.gps_lng,
                  timestamp_captura: e.timestamp_captura.toISOString(),
                }))}
              />
              {tarea.nota_reporte && (
                <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    Nota del reporte
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{tarea.nota_reporte}</p>
                </div>
              )}
            </div>
          )}

          {puedeReportar && tarea.evidencias.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
              <h3 className="font-bold text-slate-800 mb-4">Evidencia previa</h3>
              <EvidenceGallery
                evidencias={tarea.evidencias.map((e) => ({
                  id: e.id,
                  tipo: e.tipo,
                  url_storage: e.url_storage,
                  gps_lat: e.gps_lat,
                  gps_lng: e.gps_lng,
                  timestamp_captura: e.timestamp_captura.toISOString(),
                }))}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
