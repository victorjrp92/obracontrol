import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { validateObreroToken, getObreroTareaDetalle } from "@/lib/data-obrero";
import ReportarObrero from "@/components/obrero/ReportarObrero";
import { ArrowLeft, Clock, CheckCircle } from "lucide-react";

export default async function ObreroTareaPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;

  // Validate token
  const obrero = await validateObreroToken(token);
  if (!obrero) return null;

  // Fetch task detail
  const tarea = await getObreroTareaDetalle(id, obrero.contratista_id);
  if (!tarea) {
    return (
      <div className="text-center py-16">
        <p className="text-base text-slate-500">Tarea no encontrada</p>
        <Link
          href={`/o/${token}`}
          className="mt-4 inline-flex items-center gap-2 text-blue-600 font-medium text-base"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a mis tareas
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Back button */}
      <Link
        href={`/o/${token}`}
        className="inline-flex items-center gap-2 text-blue-600 font-medium text-base mb-4 min-h-12"
      >
        <ArrowLeft className="w-5 h-5" />
        Volver
      </Link>

      {/* Task header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 mb-1">
          {tarea.nombre}
        </h1>
        <p className="text-sm text-slate-500">{tarea.ubicacion}</p>
      </div>

      {/* Rejection notice */}
      {tarea.estado === "NO_APROBADA" && tarea.ultimaAprobacion && (
        <div className="mb-6 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <p className="text-sm font-bold text-red-700 mb-1">
            Tarea rechazada
          </p>
          {tarea.ultimaAprobacion.justificacion && (
            <p className="text-sm text-red-600">
              {tarea.ultimaAprobacion.justificacion}
            </p>
          )}
          <p className="text-xs text-red-400 mt-1">
            Vuelve a tomar fotos y envia de nuevo.
          </p>
        </div>
      )}

      {/* PENDIENTE or NO_APROBADA: show report form */}
      {(tarea.estado === "PENDIENTE" || tarea.estado === "NO_APROBADA") && (
        <ReportarObrero
          tareaId={tarea.id}
          token={token}
          tareaNombre={tarea.nombre}
          fotoReferenciaUrl={tarea.fotoReferenciaUrl}
        />
      )}

      {/* REPORTADA: waiting for approval */}
      {tarea.estado === "REPORTADA" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="w-14 h-14 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-amber-700 mb-2">
            Esperando aprobacion
          </h2>
          <p className="text-base text-slate-500">
            Tu contratista esta revisando esta tarea.
          </p>
        </div>
      )}

      {/* APROBADA */}
      {tarea.estado === "APROBADA" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-green-700 mb-2">Aprobada</h2>
          <p className="text-base text-slate-500">
            Esta tarea fue aprobada. Buen trabajo!
          </p>
        </div>
      )}
    </div>
  );
}
