import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Calendar, HardHat, Layers, MapPin, XCircle } from "lucide-react";
import { getUsuarioActual } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import EvidenceGallery from "@/components/evidencia/EvidenceGallery";
import EstadoTareaBadge from "../../../../EstadoTareaBadge";
import ReportarCampo from "../../../../ReportarCampo";
import { getTareaCampo, MAX_FOTOS_POR_TAREA } from "../../../../tarea-campo";

export const dynamic = "force-dynamic";

/**
 * Una tarea, para REPORTARLA. Es el final del recorrido de esta zona: la obra
 * lleva a la fase, la fase al espacio y el espacio aquí, que es donde el
 * residente hace lo único que el rol existe para hacer.
 *
 * ══ QUÉ NO HAY EN ESTA PANTALLA ════════════════════════════════════════════
 *
 * No hay aprobar ni rechazar (no es suyo: `canApproveTasks` lo deja fuera y
 * las rutas de aprobación devuelven 403), no hay precio ni presupuesto
 * (`canManageTaskPrice` también lo deja fuera, y `tarea-campo.ts` ni los
 * consulta), y no hay reasignar ni editar. Una sola acción, un solo botón.
 */
export default async function TareaCampoPage({
  params,
}: {
  // Next 16: los params de ruta son Promise.
  params: Promise<{ proyectoId: string; id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { proyectoId, id } = await params;

  const tarea = await getTareaCampo(
    {
      usuarioId: usuario.id,
      constructoraId: usuario.constructora_id,
      nivelAcceso: usuario.rol_ref.nivel_acceso,
    },
    proyectoId,
    id,
  );
  // «No existe», «no es de esta obra» y «esta obra no es tuya» se contestan
  // igual: un 404 no confirma que la tarea exista.
  if (!tarea) notFound();

  const puedeReportar = tarea.estado === "PENDIENTE" || tarea.estado === "NO_APROBADA";
  // El tope de 4 fotos por tarea lo cuenta el servidor sobre TODA la vida de
  // la tarea, no por intento: una tarea devuelta que ya gastó 3 fotos deja
  // sitio para 1, y con una sola no se puede reportar. Se avisa antes de abrir
  // la cámara en vez de fallar con el pulgar en el obturador.
  const fotosDisponibles = Math.max(0, MAX_FOTOS_POR_TAREA - tarea.fotosAcumuladas);

  return (
    <>
      <Topbar title={tarea.nombre} subtitle={tarea.proyectoNombre} />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Link
          href={`/campo/${tarea.proyectoId}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a la obra
        </Link>

        <div className="flex flex-col gap-4 sm:gap-6 max-w-3xl">
          {/* Qué es y dónde queda */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900 min-w-0 break-words">
                {tarea.nombre}
              </h2>
              <EstadoTareaBadge estado={tarea.estado} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600 min-w-0">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="truncate">{tarea.ubicacion}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 min-w-0">
                <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="truncate">
                  {tarea.faseNombre}
                  {tarea.subfase ? ` · ${tarea.subfase}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 min-w-0">
                <HardHat className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="truncate">{tarea.asignadoNombre ?? "Sin asignar"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 min-w-0">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>
                  {tarea.tiempoAcordadoDias} día{tarea.tiempoAcordadoDias === 1 ? "" : "s"}{" "}
                  acordados
                </span>
              </div>
            </div>
          </div>

          {/* Por qué la devolvieron: lo primero que hay que leer antes de rehacerla */}
          {tarea.estado === "NO_APROBADA" && tarea.motivoRechazo && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-bold text-red-700 mb-1">Motivo de la devolución</h3>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{tarea.motivoRechazo}</p>
                </div>
              </div>
            </div>
          )}

          {tarea.fotoReferenciaUrl && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-bold text-slate-800 mb-3">Así debe quedar</h3>
              <div className="rounded-xl overflow-hidden border border-slate-200">
                {/* `<img>` y no `next/image`: la URL viene firmada y expira, así
                    que el optimizador no tiene nada que cachear. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tarea.fotoReferenciaUrl}
                  alt="Foto de referencia"
                  className="w-full max-h-64 object-cover"
                />
              </div>
            </div>
          )}

          {puedeReportar ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-bold text-slate-800 mb-4">Reportar avance</h3>
              {fotosDisponibles >= 2 ? (
                <ReportarCampo
                  tareaId={tarea.id}
                  tareaNombre={tarea.nombre}
                  proyectoNombre={tarea.proyectoNombre}
                  maxFotos={fotosDisponibles}
                />
              ) : (
                <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  Esta tarea ya tiene {tarea.fotosAcumuladas} de las{" "}
                  {MAX_FOTOS_POR_TAREA} fotos que admite, de un intento anterior. Pídele a un
                  supervisor que limpie la evidencia vieja para poder volver a reportarla.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-bold text-slate-800 mb-4">Evidencia enviada</h3>
              {tarea.evidencias.length === 0 ? (
                <p className="text-sm text-slate-500">Esta tarea no tiene evidencia cargada.</p>
              ) : (
                <EvidenceGallery
                  evidencias={tarea.evidencias.map((e) => ({
                    id: e.id,
                    tipo: e.tipo,
                    url_storage: e.url,
                    gps_lat: e.gpsLat,
                    gps_lng: e.gpsLng,
                    timestamp_captura: e.timestampCaptura,
                  }))}
                />
              )}
              {tarea.notaReporte && (
                <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    Nota del reporte
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{tarea.notaReporte}</p>
                </div>
              )}
            </div>
          )}

          {/* La evidencia del intento en curso, cuando todavía se puede reportar:
              saber que ya hay fotos subidas evita repetir el envío entero. */}
          {puedeReportar && tarea.evidencias.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-bold text-slate-800 mb-4">Evidencia ya subida</h3>
              <EvidenceGallery
                evidencias={tarea.evidencias.map((e) => ({
                  id: e.id,
                  tipo: e.tipo,
                  url_storage: e.url,
                  gps_lat: e.gpsLat,
                  gps_lng: e.gpsLng,
                  timestamp_captura: e.timestampCaptura,
                }))}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
