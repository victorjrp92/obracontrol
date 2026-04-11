"use client";

import { useState, useRef } from "react";
import { Camera, X, Loader2 } from "lucide-react";

export interface CapturedPhoto {
  blob: Blob;
  preview: string;
  timestamp: Date;
  gps: { lat: number; lng: number } | null;
}

interface CameraCaptureProps {
  proyectoNombre?: string;
  tareaNombre?: string;
  maxPhotos?: number;
  onChange: (photos: CapturedPhoto[]) => void;
  initialPhotos?: CapturedPhoto[];
}

async function getGPS(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

async function drawOverlay(
  file: File,
  timestamp: Date,
  gps: { lat: number; lng: number } | null,
  proyectoNombre?: string,
  tareaNombre?: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas no disponible"));
      ctx.drawImage(img, 0, 0);

      // Overlay box at the bottom
      const padding = Math.round(canvas.width * 0.025);
      const lineHeight = Math.round(canvas.width * 0.035);
      const fontSize = Math.round(canvas.width * 0.028);
      const lines: string[] = [];

      const fechaStr = timestamp.toLocaleDateString("es-CO", {
        day: "numeric", month: "long", year: "numeric",
      });
      const horaStr = timestamp.toLocaleTimeString("es-CO", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
      lines.push(`${fechaStr} · ${horaStr}`);

      if (gps) {
        lines.push(`GPS: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`);
      } else {
        lines.push("GPS: no disponible");
      }

      if (proyectoNombre) lines.push(proyectoNombre);
      if (tareaNombre) lines.push(tareaNombre);

      const boxHeight = lineHeight * lines.length + padding * 2;
      const boxY = canvas.height - boxHeight;

      // Semi-transparent background
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(0, boxY, canvas.width, boxHeight);

      // Text
      ctx.fillStyle = "white";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = "top";
      lines.forEach((line, i) => {
        ctx.fillText(line, padding, boxY + padding + i * lineHeight);
      });

      // Watermark (top-right)
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `bold ${Math.round(fontSize * 0.85)}px sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText("SEIRICON", canvas.width - padding, padding);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Error creando imagen"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => reject(new Error("Error cargando imagen"));
    img.src = URL.createObjectURL(file);
  });
}

export default function CameraCapture({
  proyectoNombre,
  tareaNombre,
  maxPhotos = 4,
  onChange,
  initialPhotos = [],
}: CameraCaptureProps) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>(initialPhotos);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= maxPhotos) return;

    setProcessing(true);
    try {
      const timestamp = new Date();
      const gps = await getGPS();
      const blob = await drawOverlay(file, timestamp, gps, proyectoNombre, tareaNombre);
      const preview = URL.createObjectURL(blob);
      const newPhoto: CapturedPhoto = { blob, preview, timestamp, gps };
      const next = [...photos, newPhoto];
      setPhotos(next);
      onChange(next);
    } catch (err) {
      console.error("Error procesando foto:", err);
      alert("Error procesando la foto. Intenta de nuevo.");
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {photos.map((photo, idx) => (
          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
            <img src={photo.preview} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              className="absolute top-1 right-1 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {photos.length < maxPhotos && (
          <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors">
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
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <>
                <Camera className="w-8 h-8 mb-1" />
                <span className="text-xs font-medium">Tomar foto</span>
              </>
            )}
          </label>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {photos.length}/{maxPhotos} fotos · Mínimo 2 para reportar · Solo cámara, no galería
      </p>
    </div>
  );
}
