"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { comprimirParaAnalisis, obtenerGPS, quemarOverlay, type GPSCoords } from "@/lib/media/overlay";
import type { Elemento } from "@/lib/alerta/tipos";
import type { RespuestaPasante } from "@/lib/alerta/triage";
import GuiaFoto from "./GuiaFoto";

export interface CapturedPhotoGrieta {
  /** SIN overlay, para el modelo de visión (D5). Se descarta apenas vuelve la respuesta. */
  blobAnalisis: Blob;
  /** CON overlay (fecha/hora/GPS), la evidencia real — va al PDF (D5). */
  blobEvidencia: Blob;
  preview: string;
  timestamp: Date;
  gps: GPSCoords | null;
}

interface GrietaCameraCaptureProps {
  /** Elemento declarado en el Paso 1 — decide si se pregunta por "grieta pasante" (T3). */
  elementoDeclarado: Elemento;
  onCompletar: (resultado: { fotoCerca: CapturedPhotoGrieta; fotoLejos: CapturedPhotoGrieta; pasante: RespuestaPasante }) => void;
}

type Etapa = "guia_cerca" | "confirmar_cerca" | "guia_lejos" | "confirmar_lejos" | "pasante";

/** Muros y "no sé" — donde tiene sentido preguntar si la grieta atraviesa la pared (spec sección 3). */
const ELEMENTOS_QUE_PIDEN_PASANTE: Elemento[] = ["muro_carga", "muro_divisorio", "no_determinado"];

/**
 * Paso 2 del triage: dos capturas obligatorias (acercamiento con moneda +
 * elemento completo), cada una produce blobAnalisis + blobEvidencia (D5),
 * con confirmación post-captura (D6) y la pregunta de "pasante" cuando
 * aplica (T3). Envoltorio hermano de ActaCameraCapture.tsx, mismo mecanismo
 * de captura (`<input capture="environment">`), overlay PARALELO (D5).
 */
export default function GrietaCameraCapture({ elementoDeclarado, onCompletar }: GrietaCameraCaptureProps) {
  const [etapa, setEtapa] = useState<Etapa>("guia_cerca");
  const [procesando, setProcesando] = useState(false);
  const [fotoCerca, setFotoCerca] = useState<CapturedPhotoGrieta | null>(null);
  const [fotoLejos, setFotoLejos] = useState<CapturedPhotoGrieta | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pidePasante = ELEMENTOS_QUE_PIDEN_PASANTE.includes(elementoDeclarado);

  async function procesarArchivo(file: File, etiqueta: string): Promise<CapturedPhotoGrieta> {
    const timestamp = new Date();
    const gps = await obtenerGPS();
    const [blobAnalisis, blobEvidencia] = await Promise.all([
      comprimirParaAnalisis(file),
      quemarOverlay(file, timestamp, gps, etiqueta),
    ]);
    const preview = URL.createObjectURL(blobEvidencia);
    return { blobAnalisis, blobEvidencia, preview, timestamp, gps };
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const esCerca = etapa === "guia_cerca";

    setProcesando(true);
    try {
      const foto = await procesarArchivo(file, esCerca ? "Grieta — acercamiento" : "Grieta — elemento completo");
      if (esCerca) {
        setFotoCerca(foto);
        setEtapa("confirmar_cerca");
      } else {
        setFotoLejos(foto);
        setEtapa("confirmar_lejos");
      }
    } catch (err) {
      console.error("Error procesando foto de la grieta:", err);
      alert("No se pudo procesar la foto. Vuelve a intentarlo.");
    } finally {
      setProcesando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function repetirCerca() {
    if (fotoCerca) URL.revokeObjectURL(fotoCerca.preview);
    setFotoCerca(null);
    setEtapa("guia_cerca");
  }

  function repetirLejos() {
    if (fotoLejos) URL.revokeObjectURL(fotoLejos.preview);
    setFotoLejos(null);
    setEtapa("guia_lejos");
  }

  function confirmarCerca() {
    setEtapa("guia_lejos");
  }

  function confirmarLejos() {
    if (pidePasante) {
      setEtapa("pasante");
      return;
    }
    if (fotoCerca && fotoLejos) onCompletar({ fotoCerca, fotoLejos, pasante: "no_se" });
  }

  function responderPasante(pasante: RespuestaPasante) {
    if (fotoCerca && fotoLejos) onCompletar({ fotoCerca, fotoLejos, pasante });
  }

  return (
    <div className="flex flex-col gap-4">
      {(etapa === "guia_cerca" || etapa === "guia_lejos") && (
        <>
          <GuiaFoto tipo={etapa === "guia_cerca" ? "cerca" : "lejos"} />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-blue-700">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              disabled={procesando}
              className="hidden"
            />
            {procesando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {procesando ? "Procesando foto..." : "Tomar foto"}
          </label>
        </>
      )}

      {etapa === "confirmar_cerca" && fotoCerca && (
        <ConfirmarFoto foto={fotoCerca} onRepetir={repetirCerca} onContinuar={confirmarCerca} />
      )}
      {etapa === "confirmar_lejos" && fotoLejos && (
        <ConfirmarFoto foto={fotoLejos} onRepetir={repetirLejos} onContinuar={confirmarLejos} />
      )}

      {etapa === "pasante" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">¿Se ve la misma grieta del otro lado de la pared?</h3>
          <p className="mt-1 text-xs text-slate-500">
            Si puedes, revisa el otro lado del muro (por ejemplo, desde el cuarto de al lado) antes de responder.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => responderPasante("si")}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => responderPasante("no")}
              className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => responderPasante("no_se")}
              className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
            >
              No pude revisar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Confirmación post-captura (D6): "¿se ve la moneda completa? ¿la grieta se ve nítida?" → repetir o continuar. */
function ConfirmarFoto({
  foto,
  onRepetir,
  onContinuar,
}: {
  foto: CapturedPhotoGrieta;
  onRepetir: () => void;
  onContinuar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      {/* Preview de la foto ya con overlay (blobEvidencia) — misma foto que verá el PDF. */}
      <img src={foto.preview} alt="Foto capturada" className="w-full rounded-xl object-cover" style={{ maxHeight: 320 }} />
      <p className="text-sm font-medium text-slate-700">
        ¿Se ve nítida, con buena luz, y completa (la moneda o el elemento entero)? Revisa antes de continuar.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRepetir}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" /> Repetir foto
        </button>
        <button
          type="button"
          onClick={onContinuar}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
        >
          <Check className="h-4 w-4" /> Continuar
        </button>
      </div>
    </div>
  );
}
