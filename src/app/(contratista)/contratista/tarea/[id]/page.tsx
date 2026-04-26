import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Calendar, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { getUsuarioActual } from "@/lib/data";
import { getTareaDetalle } from "@/lib/data-detail";
import { extractMotivo } from "@/lib/aprobaciones";
import Topbar from "@/components/dashboard/Topbar";
import EvidenceGallery from "@/components/evidencia/EvidenceGallery";
import AprobarButtons from "@/components/dashboard/AprobarButtons";

const estadoLabels: Record<string, { text: string; cls: string }> = {
  PENDIENTE: { text: "Pendiente", cls: "bg-slate-50 text-slate-600 border-slate-200" },
  REPORTADA: { text: "Reportada · esperando revisión", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  APROBADA: { text: "Aprobada", cls: "bg-green-50 text-green-700 border-green-200" },
  NO_APROBADA: { text: "No aprobada", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default async function ContratistaTareaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { id } = await params;
  const tarea = await getTareaDetalle(id);
  if (!tarea) notFound();

  if (tarea.proyecto.constructora_id !== usuario.constructora_id) notFound();
  if (tarea.asignado_a !== usuario.id) redirect("/contratista");

  const evidenciasView = tarea.evidencias.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    url_storage: e.url_storage,
    gps_lat: e.gps_lat,
    gps_lng: e.gps_lng,
    timestamp_captura:
      e.timestamp_captura instanceof Date
        ? e.timestamp_captura.toISOString()
        : String(e.timestamp_captura),
  }));
  const fotos = evidenciasView.filter((e) => e.tipo === "FOTO");
  const videos = evidenciasView.filter((e) => e.tipo === "VIDEO");
  const enoughPhotos = fotos.length >= 2;
  const isReportada = tarea.estado === "REPORTADA";
  const ultimaAprobacion = tarea.aprobaciones?.[0] ?? null;
  const motivoAnterior = ultimaAprobacion?.estado === "NO_APROBADA"
    ? extractMotivo(ultimaAprobacion.justificacion_por_item)
    : null;

  const estadoCfg = estadoLabels[tarea.estado] ?? estadoLabels.PENDIENTE;

  return (
    <>
      <Topbar title={tarea.nombre} subtitle={tarea.proyecto.nombre} />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        <Link
          href="/contratista"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-4 h-4" /> Volver a mis tareas
        </Link>

        {/* Estado + ubicación */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${estadoCfg.cls}`}
            >
              {estadoCfg.text}
            </span>
            <span className="text-xs text-slate-500 inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {tarea.diasRestantes < 0
                ? `${Math.abs(tarea.diasRestantes)} días de atraso`
                : tarea.diasRestantes === 0
                  ? "Vence hoy"
                  : `${tarea.diasRestantes} días restantes`}
            </span>
          </div>
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Ubicación</div>
          <div className="text-sm text-slate-700 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {tarea.ubicacion}
          </div>
        </div>

        {/* Foto de referencia (si la hay) */}
        {tarea.fotoReferenciaSignedUrl && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Foto de referencia</h3>
            <img
              src={tarea.fotoReferenciaSignedUrl}
              alt="Foto de referencia"
              className="rounded-xl max-w-md w-full border border-slate-200"
            />
          </div>
        )}

        {/* Motivo del rechazo anterior */}
        {motivoAnterior && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-semibold text-amber-700 uppercase mb-1">
                  Última nota de revisión
                </div>
                <div className="text-sm text-amber-800">{motivoAnterior}</div>
                {ultimaAprobacion?.aprobador?.nombre && (
                  <div className="text-xs text-amber-700/70 mt-1">
                    Por {ultimaAprobacion.aprobador.nombre}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Evidencias enviadas por el obrero */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Evidencias del obrero</h3>
            <span className="text-xs text-slate-500">
              {fotos.length} foto{fotos.length === 1 ? "" : "s"} · {videos.length} video
              {videos.length === 1 ? "" : "s"}
            </span>
          </div>
          <EvidenceGallery evidencias={evidenciasView} />
        </div>

        {/* Acciones aprobar/rechazar (solo cuando está REPORTADA) */}
        {isReportada && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Revisión</h3>
            <p className="text-xs text-slate-500 mb-3">
              Verifica las evidencias y aprueba si el trabajo cumple con lo acordado. Si las pruebas
              no son contundentes, rechaza con un comentario explicando qué falta — el obrero podrá
              re-reportar la misma tarea.
            </p>
            {!enoughPhotos && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                Solo hay {fotos.length} foto{fotos.length === 1 ? "" : "s"}. Se requieren al menos 2 para aprobar.
                Puedes rechazar para que el obrero envíe más evidencias.
              </div>
            )}
            <AprobarButtons tareaId={tarea.id} canApprove={enoughPhotos} />
          </div>
        )}

        {tarea.estado === "APROBADA" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-sm text-green-800">
            ✓ Tarea aprobada. Suma al puntaje de completado.
          </div>
        )}

        {/* Historial de revisiones (trazabilidad completa) */}
        {tarea.aprobaciones.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Historial de revisiones
            </h3>
            <ol className="flex flex-col gap-3">
              {tarea.aprobaciones.map((a, idx) => {
                const isAprobada = a.estado === "APROBADA";
                const intentoNumero = tarea.aprobaciones.length - idx;
                const motivo = !isAprobada ? extractMotivo(a.justificacion_por_item) : null;
                return (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isAprobada ? "bg-green-100" : "bg-red-100"
                      }`}
                    >
                      {isAprobada ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800">
                          {isAprobada ? "Aprobada" : "Rechazada"}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          Revisión #{intentoNumero}
                        </span>
                        {a.aprobador?.nombre && (
                          <span className="text-xs text-slate-500">
                            por {a.aprobador.nombre}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(a.fecha).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {motivo && (
                        <div className="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg">
                          {motivo}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </main>
    </>
  );
}
