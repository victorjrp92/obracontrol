"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import CameraCapture, { CapturedPhoto } from "@/components/evidencia/CameraCapture";
import VideoCapture, { CapturedVideo } from "@/components/evidencia/VideoCapture";

interface ReportarButtonProps {
  tareaId: string;
  proyectoNombre?: string;
  tareaNombre?: string;
}

export default function ReportarButton({ tareaId, proyectoNombre, tareaNombre }: ReportarButtonProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [video, setVideo] = useState<CapturedVideo | null>(null);
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function uploadFile(file: Blob, tipo: "FOTO" | "VIDEO", gps: { lat: number; lng: number } | null, timestamp: Date) {
    const fd = new FormData();
    const ext = tipo === "FOTO" ? "jpg" : "mp4";
    fd.append("file", new File([file], `${Date.now()}.${ext}`, { type: tipo === "FOTO" ? "image/jpeg" : "video/mp4" }));
    fd.append("tarea_id", tareaId);
    fd.append("tipo", tipo);
    if (gps) {
      fd.append("gps_lat", String(gps.lat));
      fd.append("gps_lng", String(gps.lng));
    }
    fd.append("timestamp_captura", timestamp.toISOString());

    const res = await fetch("/api/evidencias", { method: "POST", body: fd });
    if (!res.ok) {
      const text = await res.text();
      let msg = "Error subiendo archivo";
      try {
        const data = JSON.parse(text);
        msg = data.error ?? msg;
      } catch {
        if (res.status === 413) msg = "El archivo es demasiado grande. Intenta con una foto más pequeña.";
        else msg = text || msg;
      }
      throw new Error(msg);
    }
  }

  async function handleSubmit() {
    setError("");
    if (photos.length < 2) {
      setError("Debes tomar al menos 2 fotos antes de reportar");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Subir fotos
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Subiendo foto ${i + 1}/${photos.length}...`);
        await uploadFile(photos[i].blob, "FOTO", photos[i].gps, photos[i].timestamp);
      }

      // 2. Subir video si existe
      if (video) {
        setProgress("Subiendo video...");
        await uploadFile(video.blob, "VIDEO", null, video.timestamp);
      }

      // 3. Marcar tarea como reportada
      setProgress("Reportando tarea...");
      const res = await fetch(`/api/tareas/${tareaId}/reportar`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al reportar");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSubmitting(false);
      setProgress("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="text-sm font-semibold text-slate-700 mb-2 block">
          Fotos de evidencia <span className="text-red-500">*</span>
        </label>
        <CameraCapture
          proyectoNombre={proyectoNombre}
          tareaNombre={tareaNombre}
          maxPhotos={4}
          onChange={setPhotos}
          initialPhotos={photos}
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-700 mb-2 block">
          Video (opcional, máx 30s)
        </label>
        <VideoCapture onChange={setVideo} initialVideo={video} />
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-700 mb-2 block">
          Notas (opcional)
        </label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Observaciones sobre la tarea..."
          rows={3}
          className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || photos.length < 2}
        className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {progress || "Procesando..."}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Reportar como terminada
          </>
        )}
      </button>
    </div>
  );
}
