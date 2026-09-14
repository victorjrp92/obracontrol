"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import CameraCapture, { type CapturedPhoto } from "@/components/evidencia/CameraCapture";

/**
 * Reportar avance desde la obra. Es LA función del rol: el residente camina el
 * espacio, toma la foto y la manda; aprobar es de otro.
 *
 * ══ POR QUÉ REUSA `CameraCapture` ══════════════════════════════════════════
 *
 * La evidencia de este producto no es «una foto»: lleva el GPS y la hora de
 * captura quemados en el pixel, el nombre de la obra y la tarea, y va
 * comprimida a <1MB para que salga con media barra de señal. Todo eso ya está
 * resuelto ahí y es exactamente lo que sube el maestro desde /o/[token]. Una
 * captura propia sería una segunda forma de que la evidencia salga distinta
 * según quién la tomó — justo lo que el producto promete que no pasa.
 *
 * ══ POR QUÉ NO HAY VIDEO ═══════════════════════════════════════════════════
 *
 * El video no sube por `/api/evidencias` sino por
 * `/api/evidencias/direct-upload` (Vercel corta los cuerpos en 4.5MB), y ese
 * endpoint exige hoy `asignado_a` o `canApproveTasks`: el personal de campo no
 * es ninguno de los dos y se llevaría un 403 a mitad del envío. Se deja fuera
 * hasta que ese endpoint reconozca el rol. La foto —que es la evidencia que la
 * aprobación exige— sí sube.
 */

/** La aprobación exige mínimo 2 fotos, así que reportar con menos es reportar para que te devuelvan. */
const MIN_FOTOS = 2;

interface ReportarCampoProps {
  tareaId: string;
  tareaNombre: string;
  proyectoNombre: string;
  /** Cuántas fotos más admite el servidor en esta tarea (tope de 4 por tarea). */
  maxFotos: number;
}

export default function ReportarCampo({
  tareaId,
  tareaNombre,
  proyectoNombre,
  maxFotos,
}: ReportarCampoProps) {
  const router = useRouter();
  const [fotos, setFotos] = useState<CapturedPhoto[]>([]);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [paso, setPaso] = useState("");
  const [error, setError] = useState("");

  async function subirFoto(foto: CapturedPhoto) {
    const fd = new FormData();
    fd.append("file", new File([foto.blob], `${Date.now()}.jpg`, { type: "image/jpeg" }));
    fd.append("tarea_id", tareaId);
    fd.append("tipo", "FOTO");
    if (foto.gps) {
      fd.append("gps_lat", String(foto.gps.lat));
      fd.append("gps_lng", String(foto.gps.lng));
    }
    // La hora de la CAPTURA, no la de la subida: con señal mala pueden
    // separarse horas, y lo que prueba la evidencia es cuándo se tomó.
    fd.append("timestamp_captura", foto.timestamp.toISOString());

    const res = await fetch("/api/evidencias", { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "No se pudo subir la foto");
    }
  }

  async function enviar() {
    setError("");
    if (fotos.length < MIN_FOTOS) {
      setError(`Toma al menos ${MIN_FOTOS} fotos antes de enviar`);
      return;
    }

    setEnviando(true);
    try {
      for (let i = 0; i < fotos.length; i++) {
        setPaso(`Subiendo foto ${i + 1} de ${fotos.length}...`);
        await subirFoto(fotos[i]);
      }

      // El reporte va DESPUÉS de las fotos a propósito: el servidor rechaza
      // reportar sin evidencia del intento actual, así que si una subida falla
      // la tarea se queda PENDIENTE y se puede reintentar, en vez de quedar
      // «Reportada sin fotos».
      setPaso("Enviando reporte...");
      const res = await fetch(`/api/tareas/${tareaId}/reportar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota_reporte: nota.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo reportar la tarea");
      }

      // La pantalla se pinta en el servidor: al refrescar, la tarea ya sale
      // REPORTADA y este formulario deja de existir. No se baja `enviando`
      // para que nadie mande el mismo reporte dos veces mientras llega.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setEnviando(false);
      setPaso("");
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
          maxPhotos={maxFotos}
          onChange={setFotos}
          initialPhotos={fotos}
        />
        <p className="text-xs text-slate-400 mt-2">
          Mínimo {MIN_FOTOS}. Cada foto sale con la fecha, la hora y el GPS marcados encima.
        </p>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-700 mb-2 block">
          Nota (opcional)
        </label>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Lo que quien revise necesita saber y no se ve en la foto"
          rows={3}
          className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
        />
      </div>

      <button
        onClick={enviar}
        disabled={enviando || fotos.length < MIN_FOTOS}
        className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer min-h-12"
      >
        {enviando ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {paso || "Procesando..."}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Reportar avance
          </>
        )}
      </button>
    </div>
  );
}
