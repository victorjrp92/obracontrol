"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send, Loader2, CheckCircle, WifiOff } from "lucide-react";
import CameraCapture, {
  CapturedPhoto,
} from "@/components/evidencia/CameraCapture";
import VideoCapture, {
  CapturedVideo,
} from "@/components/evidencia/VideoCapture";
import { enqueueEvidence } from "@/lib/offline-queue";

interface ReportarObreroProps {
  tareaId: string;
  token: string;
  tareaNombre: string;
  fotoReferenciaUrl?: string | null;
}

export default function ReportarObrero({
  tareaId,
  token,
  tareaNombre,
  fotoReferenciaUrl,
}: ReportarObreroProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [video, setVideo] = useState<CapturedVideo | null>(null);
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [enqueuedCount, setEnqueuedCount] = useState(0);

  /**
   * Sube un archivo. Si falla por red (offline / fetch error), lo encola en
   * IndexedDB para reintentar cuando vuelva la conexión. Devuelve `true` si
   * se subió, `false` si quedó encolado (no es error fatal — el reporte
   * sigue en pie).
   */
  async function uploadFile(
    file: Blob,
    tipo: "FOTO" | "VIDEO",
    gps: { lat: number; lng: number } | null,
    timestamp: Date,
  ): Promise<boolean> {
    const ext = tipo === "FOTO" ? "jpg" : "mp4";
    const fileName = `${Date.now()}.${ext}`;
    const fileType = tipo === "FOTO" ? "image/jpeg" : "video/mp4";

    const fd = new FormData();
    fd.append("file", new File([file], fileName, { type: fileType }));
    fd.append("tarea_id", tareaId);
    fd.append("tipo", tipo);
    if (gps) {
      fd.append("gps_lat", String(gps.lat));
      fd.append("gps_lng", String(gps.lng));
    }
    fd.append("timestamp_captura", timestamp.toISOString());

    // Si el navegador YA reporta offline, encolar directo sin gastar batería en fetch
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueEvidence({
        tareaId,
        tipo,
        file,
        fileName,
        fileType,
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
        timestamp: timestamp.getTime(),
      });
      return false;
    }

    try {
      const res = await fetch(`/api/o/${token}/evidencias`, { method: "POST", body: fd });
      if (!res.ok) {
        // Errores 4xx no son recuperables — no encolar
        if (res.status >= 400 && res.status < 500) {
          const text = await res.text();
          let msg = "Error subiendo archivo";
          try {
            msg = JSON.parse(text).error ?? msg;
          } catch {
            if (res.status === 413) msg = "Archivo demasiado grande";
            else msg = text || msg;
          }
          throw new Error(msg);
        }
        // 5xx → encolar para reintentar
        throw new Error("server-error");
      }
      return true;
    } catch (err) {
      // Sin red o 5xx: encolar
      await enqueueEvidence({
        tareaId,
        tipo,
        file,
        fileName,
        fileType,
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
        timestamp: timestamp.getTime(),
      });
      // Re-lanzar solo si fue un error de validación (4xx)
      if (err instanceof Error && err.message !== "server-error" && !err.message.includes("Failed to fetch")) {
        throw err;
      }
      return false;
    }
  }

  async function handleSubmit() {
    setError("");
    if (photos.length < 2) {
      setError("Debes tomar al menos 2 fotos antes de enviar");
      return;
    }

    setSubmitting(true);
    let pendientes = 0;

    try {
      // 1. Subir fotos (las que fallen quedan en cola IndexedDB)
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Subiendo foto ${i + 1}/${photos.length}...`);
        const uploaded = await uploadFile(
          photos[i].blob,
          "FOTO",
          photos[i].gps,
          photos[i].timestamp,
        );
        if (!uploaded) pendientes += 1;
      }

      // 2. Subir video si hay
      if (video) {
        setProgress("Subiendo video...");
        const uploaded = await uploadFile(video.blob, "VIDEO", null, video.timestamp);
        if (!uploaded) pendientes += 1;
      }

      // 3. Marcar tarea como reportada (esto sí requiere conexión)
      setProgress("Enviando...");
      const res = await fetch(`/api/o/${token}/tareas/${tareaId}/reportar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas }),
      });
      if (!res.ok) {
        // Si no hay red para marcar reportado, avisar al obrero
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw new Error("Sin conexión: las fotos quedaron guardadas. Vuelve a intentarlo cuando tengas señal.");
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al reportar");
      }

      setEnqueuedCount(pendientes);
      setSuccess(true);

      // Auto-return to task list after 2.5s
      setTimeout(() => {
        router.push(`/o/${token}`);
        router.refresh();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSubmitting(false);
      setProgress("");
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-green-700 mb-2">Reporte enviado</h2>
        <p className="text-base text-slate-600">
          Tu contratista será notificado.
        </p>
        {enqueuedCount > 0 && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 max-w-sm">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <WifiOff className="w-4 h-4" />
              {enqueuedCount} archivo(s) en cola
            </div>
            Se enviarán automáticamente cuando vuelvas a tener señal.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-base text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Reference photo */}
      {fotoReferenciaUrl && (
        <div>
          <p className="text-sm font-semibold text-slate-600 mb-2">
            Asi debe quedar
          </p>
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <img
              src={fotoReferenciaUrl}
              alt="Referencia"
              className="w-full max-h-48 object-cover"
            />
          </div>
        </div>
      )}

      {/* Photo section */}
      <div>
        <label className="text-base font-bold text-slate-700 mb-3 block">
          Fotos de evidencia <span className="text-red-500">*</span>
        </label>
        <CameraCapture
          tareaNombre={tareaNombre}
          maxPhotos={4}
          onChange={setPhotos}
          initialPhotos={photos}
        />
      </div>

      {/* Video section */}
      <div>
        <label className="text-base font-bold text-slate-700 mb-3 block">
          Video (opcional, max 30s)
        </label>
        <VideoCapture onChange={setVideo} initialVideo={video} />
      </div>

      {/* Notes */}
      <div>
        <label className="text-base font-bold text-slate-700 mb-3 block">
          Notas (opcional)
        </label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Escribe alguna anotación si es necesario"
          rows={3}
          className="w-full p-4 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
        />
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || photos.length < 2}
        className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold px-6 py-4 rounded-xl transition-colors text-lg min-h-14 cursor-pointer w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{progress || "Procesando..."}</span>
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            ENVIAR
          </>
        )}
      </button>
    </div>
  );
}
