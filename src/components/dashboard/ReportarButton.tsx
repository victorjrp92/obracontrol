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

  // Subida pequeña (fotos comprimidas <2MB) — vía API route normal.
  async function uploadFotoViaApi(file: Blob, gps: { lat: number; lng: number } | null, timestamp: Date) {
    const fd = new FormData();
    fd.append("file", new File([file], `${Date.now()}.jpg`, { type: "image/jpeg" }));
    fd.append("tarea_id", tareaId);
    fd.append("tipo", "FOTO");
    if (gps) {
      fd.append("gps_lat", String(gps.lat));
      fd.append("gps_lng", String(gps.lng));
    }
    fd.append("timestamp_captura", timestamp.toISOString());

    const res = await fetch("/api/evidencias", { method: "POST", body: fd });
    if (!res.ok) {
      const text = await res.text();
      let msg = "Error subiendo foto";
      try {
        const data = JSON.parse(text);
        msg = data.error ?? msg;
      } catch {
        if (res.status === 413) msg = "La foto es demasiado grande. Intenta con una más pequeña.";
        else msg = text || msg;
      }
      throw new Error(msg);
    }
  }

  // Subida grande (video) — directo a Supabase Storage vía signed URL, así
  // bypassamos el límite de body de 4.5 MB que Vercel impone a las API routes.
  async function uploadVideoDirect(file: Blob, timestamp: Date) {
    const ext = (file.type.split("/")[1] ?? "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 4) || "mp4";

    // 1. Pedir signed URL al servidor.
    const urlRes = await fetch("/api/evidencias/direct-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tarea_id: tareaId, tipo: "VIDEO", ext }),
    });
    if (!urlRes.ok) {
      const data = await urlRes.json().catch(() => ({}));
      throw new Error(data.error ?? "No se pudo iniciar la subida del video");
    }
    const { path, signedUrl } = await urlRes.json() as { path: string; signedUrl: string };

    // 2. Subir el blob directamente a Supabase Storage.
    const upRes = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "video/mp4" },
      body: file,
    });
    if (!upRes.ok) {
      throw new Error(`Error subiendo video (${upRes.status}). Intenta con un video más corto.`);
    }

    // 3. Confirmar en la DB.
    const confirmRes = await fetch("/api/evidencias/direct-upload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tarea_id: tareaId,
        tipo: "VIDEO",
        path,
        timestamp_captura: timestamp.toISOString(),
      }),
    });
    if (!confirmRes.ok) {
      const data = await confirmRes.json().catch(() => ({}));
      throw new Error(data.error ?? "Error confirmando el video");
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
      // 0. Limpiar evidencias previas (de intentos fallidos) para que el cap
      //    de 4 fotos no acumule sobras y la subida sea idempotente.
      setProgress("Preparando...");
      const clearRes = await fetch(`/api/evidencias?tarea_id=${tareaId}`, { method: "DELETE" });
      if (!clearRes.ok && clearRes.status !== 404) {
        const data = await clearRes.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudieron limpiar evidencias previas");
      }

      // 1. Subir fotos vía API route normal (ya están comprimidas <2MB).
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Subiendo foto ${i + 1}/${photos.length}...`);
        await uploadFotoViaApi(photos[i].blob, photos[i].gps, photos[i].timestamp);
      }

      // 2. Subir video (si existe) directo a Storage para bypassar Vercel 4.5MB.
      if (video) {
        setProgress("Subiendo video...");
        await uploadVideoDirect(video.blob, video.timestamp);
      }

      // 3. Marcar tarea como reportada (incluye la nota del contratista).
      setProgress("Reportando tarea...");
      const res = await fetch(`/api/tareas/${tareaId}/reportar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota_reporte: notas.trim() || null }),
      });
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
