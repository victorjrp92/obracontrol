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

interface ActaCameraCaptureJuntosProps {
  /** Nombre del espacio, quemado en la foto. */
  espacioNombre: string;
  maxPhotos: number;
  /** true cuando el acta completa llegó al tope global de fotos/peso (lo calcula ActaWizardJuntos). */
  disabled?: boolean;
  onChange: (photos: CapturedPhotoActa[]) => void;
}

/**
 * Captura de fotos del acta — adaptada de ActaCameraCapture de Karen (overlay
 * paralelo de src/lib/media/overlay.ts, tope global vía `disabled`).
 * Correcciones Juntos: error inline en vez de alert(), targets táctiles
 * ≥44px (el botón de quitar foto ya lo era; el resto lo garantiza el CSS).
 */
export default function ActaCameraCaptureJuntos({
  espacioNombre,
  maxPhotos,
  disabled = false,
  onChange,
}: ActaCameraCaptureJuntosProps) {
  const [photos, setPhotos] = useState<CapturedPhotoActa[]>([]);
  const [processing, setProcessing] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const puedeCapturar = !disabled && photos.length < maxPhotos;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!puedeCapturar) return;

    setErrorFoto(null);
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
    } catch {
      // Error inline, nunca alert() (corrección obligatoria del spec).
      setErrorFoto("No pudimos procesar la foto. Revisa que sea una imagen e intenta de nuevo.");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="fotos-grid">
        {photos.map((photo, idx) => (
          <div key={idx} className="foto-mini">
            <img src={photo.preview} alt={`Foto ${idx + 1} de ${espacioNombre}`} />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              aria-label={`Eliminar foto ${idx + 1}`}
              className="foto-quitar"
            >
              <X style={{ width: 20, height: 20 }} aria-hidden="true" />
            </button>
          </div>
        ))}

        {puedeCapturar && (
          <label className="foto-tomar">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              disabled={processing}
              style={{ display: "none" }}
            />
            {processing ? (
              <Loader2 style={{ width: 26, height: 26, animation: "ljt-girar 1s linear infinite" }} />
            ) : (
              <>
                <Camera style={{ width: 28, height: 28 }} aria-hidden="true" />
                Tomar foto
              </>
            )}
          </label>
        )}
      </div>

      {errorFoto && <p className="error-inline">{errorFoto}</p>}
      {disabled && (
        <p className="micro" style={{ marginTop: 0 }}>
          Llegaste al máximo de fotos del acta. Elimina alguna para agregar otra.
        </p>
      )}
    </div>
  );
}
