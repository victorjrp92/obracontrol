"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { comprimirParaAnalisis, obtenerGPS, quemarOverlay, type GPSCoords } from "@/lib/media/overlay";
import type { Elemento } from "@/lib/alerta/tipos";
import type { RespuestaPasante } from "@/lib/alerta/triage";
import GuiaFotoJuntos from "./GuiaFotoJuntos";

export interface CapturedPhotoGrieta {
  /** SIN overlay, para el modelo de visión (D5). Se descarta apenas vuelve la respuesta. */
  blobAnalisis: Blob;
  /** CON overlay (fecha/hora/GPS), la evidencia real — va al PDF (D5). */
  blobEvidencia: Blob;
  preview: string;
  timestamp: Date;
  gps: GPSCoords | null;
}

interface GrietaCameraCaptureJuntosProps {
  /** Elemento declarado en el Paso 1 — decide si se pregunta por "grieta pasante" (T3). */
  elementoDeclarado: Elemento;
  onCompletar: (resultado: { fotoCerca: CapturedPhotoGrieta; fotoLejos: CapturedPhotoGrieta; pasante: RespuestaPasante }) => void;
}

type Etapa = "guia_cerca" | "confirmar_cerca" | "guia_lejos" | "confirmar_lejos" | "pasante";

/** Muros y "no sé" — donde tiene sentido preguntar si la grieta atraviesa la pared (T3). */
const ELEMENTOS_QUE_PIDEN_PASANTE: Elemento[] = ["muro_carga", "muro_divisorio", "no_determinado"];

/**
 * Paso 2 del wizard de grietas — adaptado de GrietaCameraCapture de Karen
 * (misma máquina de etapas y doble blob D5, que están bien): dos capturas
 * obligatorias (acercamiento con moneda + elemento completo) con
 * confirmación post-captura y pregunta de "pasante" cuando aplica.
 * Correcciones Juntos: error inline en vez de alert(), targets ≥44px,
 * guía con la animación de la moneda.
 */
export default function GrietaCameraCaptureJuntos({ elementoDeclarado, onCompletar }: GrietaCameraCaptureJuntosProps) {
  const [etapa, setEtapa] = useState<Etapa>("guia_cerca");
  const [procesando, setProcesando] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
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

    setErrorFoto(null);
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
    } catch {
      // Error inline, nunca alert() (corrección obligatoria del spec). Sin
      // console: la foto no debe tocar ningún log.
      setErrorFoto("No pudimos procesar la foto. Revisa que sea una imagen e intenta de nuevo.");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {(etapa === "guia_cerca" || etapa === "guia_lejos") && (
        <>
          <GuiaFotoJuntos tipo={etapa === "guia_cerca" ? "cerca" : "lejos"} />
          {errorFoto && <p className="error-inline">{errorFoto}</p>}
          <div className="cta-abajo">
            <label className="btn btn-azul" style={{ cursor: "pointer" }}>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                disabled={procesando}
                style={{ display: "none" }}
              />
              {procesando ? <Loader2 className="ic" style={{ animation: "ljt-girar 1s linear infinite" }} /> : <Camera className="ic" aria-hidden="true" />}
              {procesando ? "Procesando foto..." : "Tomar foto"}
            </label>
          </div>
        </>
      )}

      {etapa === "confirmar_cerca" && fotoCerca && (
        <ConfirmarFoto foto={fotoCerca} onRepetir={repetirCerca} onContinuar={confirmarCerca} />
      )}
      {etapa === "confirmar_lejos" && fotoLejos && (
        <ConfirmarFoto foto={fotoLejos} onRepetir={repetirLejos} onContinuar={confirmarLejos} />
      )}

      {etapa === "pasante" && (
        <div className="panel">
          <div>
            <h2 style={{ fontSize: 17 }}>¿Se ve la misma grieta del otro lado de la pared?</h2>
            <p className="desc">
              Si puedes, revisa el otro lado del muro (por ejemplo, desde el cuarto de al lado) antes de responder.
            </p>
          </div>
          <div className="par-sino" style={{ flexWrap: "wrap" }}>
            <button type="button" onClick={() => responderPasante("si")} className="btn-sino si-sel">
              Sí
            </button>
            <button type="button" onClick={() => responderPasante("no")} className="btn-sino">
              No
            </button>
            <button type="button" onClick={() => responderPasante("no_se")} className="btn-sino">
              No pude revisar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Confirmación post-captura: ¿nítida, con buena luz y completa? → repetir o continuar. */
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
    <div className="panel">
      {/* Preview de la foto ya con overlay (blobEvidencia) — la misma que verá el PDF. */}
      <img src={foto.preview} alt="Foto capturada de la grieta, con fecha y ubicación" className="foto-preview" />
      <p className="desc" style={{ marginTop: 0 }}>
        ¿Se ve nítida, con buena luz, y completa (la moneda o el elemento entero)? Revisa antes de continuar.
      </p>
      <div className="par-sino">
        <button type="button" onClick={onRepetir} className="btn-sino">
          <RotateCcw className="ic" style={{ verticalAlign: -3, marginRight: 6 }} aria-hidden="true" />
          Repetir foto
        </button>
        <button type="button" onClick={onContinuar} className="btn-sino no-sel">
          <Check className="ic" style={{ verticalAlign: -3, marginRight: 6 }} aria-hidden="true" />
          Continuar
        </button>
      </div>
    </div>
  );
}
