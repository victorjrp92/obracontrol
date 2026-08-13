"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { obtenerGPS, quemarOverlay, type GPSCoords } from "@/lib/media/overlay";

export interface CapturedPhotoActa {
  blob: Blob;
  preview: string;
  timestamp: Date;
  gps: GPSCoords | null;
}

interface ActaCameraCaptureProps {
  /** Nombre del espacio, quemado en la foto en vez de proyecto/tarea. */
  espacioNombre: string;
  maxPhotos: number;
  /** true cuando el acta completa llegó al tope global de fotos/peso (lo calcula ActaWizard). */
  disabled?: boolean;
  onChange: (photos: CapturedPhotoActa[]) => void;
  initialPhotos?: CapturedPhotoActa[];
}

/**
 * Envoltorio delgado de captura de fotos para el Acta de daños. Usa la
 * lógica de overlay PARALELA de `src/lib/media/overlay.ts` (no la de
 * `CameraCapture.tsx` — ver docs/specs/2026-08-13-seiricon-alerta-fase1.md,
 * addendum R2) y una etiqueta de espacio en vez de proyecto/tarea. El tope
 * global de fotos/peso lo decide `ActaWizard.tsx` vía la prop `disabled`.
 */
export default function ActaCameraCapture({
  espacioNombre,
  maxPhotos,
  disabled = false,
  onChange,
  initialPhotos = [],
}: ActaCameraCaptureProps) {
  const [photos, setPhotos] = useState<CapturedPhotoActa[]>(initialPhotos);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const puedeCapturar = !disabled && photos.length < maxPhotos;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!puedeCapturar) return;

    setProcessing(true);
    try {
      const timestamp = new Date();
      const gps = await obtenerGPS();
      const blob = await quemarOverlay(file, timestamp, gps, espacioNombre);
      const preview = URL.createObjectURL(blob);
      const nueva: CapturedPhotoActa = { blob, preview, timestamp, gps };
      const next = [...photos, nueva];
      setPhotos(next);
      onChange(next);
    } catch (err) {
      console.error("Error procesando foto del acta:", err);
      alert("No se pudo procesar la foto. Vuelve a intentarlo.");
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].preview);
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo, idx) => (
          <div key={idx} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200">
            <img src={photo.preview} alt={`Foto ${idx + 1} de ${espacioNombre}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              aria-label={`Eliminar foto ${idx + 1}`}
              className="absolute top-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-md ring-2 ring-white transition-transform active:scale-95 active:bg-red-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ))}

        {puedeCapturar && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-600">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              disabled={processing}
              className="hidden"
            />
            {processing ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <>
                <Camera className="mb-1 h-8 w-8" />
                <span className="text-xs font-medium">Tomar foto</span>
              </>
            )}
          </label>
        )}
      </div>

      {disabled && (
        <p className="text-xs text-amber-600">Llegaste al máximo de fotos del acta. Elimina alguna para agregar otra.</p>
      )}
    </div>
  );
}
