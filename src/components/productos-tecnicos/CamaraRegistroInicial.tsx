"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, MapPin, Video } from "lucide-react";
import { obtenerGPS, quemarOverlay, type GPSCoords } from "@/lib/media/overlay";

/**
 * La cámara del registro fotográfico inicial.
 *
 * AQUÍ ESTÁ LA REGLA DEL LEAF, y está en la forma del componente, no en un aviso
 * de pantalla: **no existe ningún `<input type="file">`**. Los píxeles salen de
 * un `MediaStream` de `getUserMedia()` dibujado sobre un `canvas`; no hay ningún
 * punto del recorrido en el que el usuario escoja un archivo, porque no hay
 * ningún control que lo permita. Una foto de galería no se rechaza: no se puede
 * ni ofrecer.
 *
 * Por qué no vale el `<input type="file" capture>` que usa la cámara de Juntos:
 * `capture` es una PISTA. En un móvil abre la cámara, pero en un navegador de
 * escritorio —y en varios móviles cuando el sistema no tiene cámara disponible—
 * el atributo se ignora y se abre el selector de archivos. Un registro de estado
 * previo cuya única razón de existir es probar la fecha no puede depender de una
 * pista que el navegador puede ignorar.
 *
 * El overlay se quema con `quemarOverlay()` de `src/lib/media/overlay.ts`, el
 * mismo que usa Juntos, con su mismo perfil de compresión. No se escribe otro.
 *
 * LA UBICACIÓN ES OBLIGATORIA. Si el navegador no da coordenadas, la foto no se
 * toma. Una foto fechada pero sin sitio deja abierta la respuesta más fácil de
 * la contraparte —«esa foto no es de mi inmueble»— y entonces el registro vuelve
 * a no probar nada. Es preferible una foto menos a una foto que no sirve.
 */

export interface CapturaRegistro {
  /** JPEG con la fecha, la hora y las coordenadas ya quemadas dentro. */
  imagen: Blob;
  capturadaEn: Date;
  gps: GPSCoords;
}

type Fase = "cerrada" | "abriendo" | "lista" | "capturando";

/** Calidad del fotograma antes de que `quemarOverlay` lo recomprima. */
const CALIDAD_FOTOGRAMA = 0.92;

/** Marca de agua de la esquina. La de Juntos («SEIRICON ALERTA») no va aquí. */
const WORDMARK_REGISTRO_INICIAL = "SEIRICON";

export default function CamaraRegistroInicial({
  etiquetaUbicacion,
  disabled = false,
  onCapturada,
}: {
  /** Se quema en la imagen: «Cocina · Apto 501 · Piso 5 · Torre A». */
  etiquetaUbicacion: string;
  disabled?: boolean;
  onCapturada: (captura: CapturaRegistro) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [fase, setFase] = useState<Fase>("cerrada");
  const [error, setError] = useState<string | null>(null);
  const [avisoGps, setAvisoGps] = useState<string | null>(null);

  const cerrar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setFase("cerrada");
  }, []);

  // Apagar la cámara al desmontar no es cosmética: un `MediaStream` vivo deja el
  // indicador del dispositivo encendido y consume batería hasta que se cierra
  // la pestaña.
  useEffect(() => cerrar, [cerrar]);

  async function abrir() {
    setError(null);
    setAvisoGps(null);
    setFase("abriendo");

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setFase("cerrada");
      setError(
        "Este navegador no permite usar la cámara desde la web, o la página no se está sirviendo por " +
          "HTTPS. Abre el registro desde el teléfono, en la dirección segura de la app.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setFase("lista");
    } catch {
      setFase("cerrada");
      setError(
        "No pudimos abrir la cámara. Revisa que le hayas dado permiso a la app y que ninguna otra " +
          "aplicación la esté usando.",
      );
      return;
    }

    // Se pide la ubicación en cuanto se abre la cámara, no al disparar: si el
    // permiso está denegado conviene saberlo ANTES de encuadrar la foto, no
    // después de tomarla.
    const gps = await obtenerGPS();
    if (!gps) {
      setAvisoGps(
        "Todavía no tenemos tu ubicación. El registro la necesita: permite el acceso a la ubicación " +
          "en el navegador antes de tomar la foto.",
      );
    }
  }

  async function capturar() {
    const video = videoRef.current;
    if (!video || fase !== "lista") return;

    setError(null);
    setAvisoGps(null);
    setFase("capturando");

    try {
      // 1 — El fotograma primero. El instante que se quema es el de la captura,
      //     no el de cuando termine de responder el GPS unos segundos después.
      const capturadaEn = new Date();
      const ancho = video.videoWidth;
      const alto = video.videoHeight;
      if (!ancho || !alto) {
        setError("La cámara todavía no está lista. Espera un segundo e intenta de nuevo.");
        setFase("lista");
        return;
      }

      const lienzo = document.createElement("canvas");
      lienzo.width = ancho;
      lienzo.height = alto;
      const ctx = lienzo.getContext("2d");
      if (!ctx) {
        setError("Este navegador no pudo procesar la imagen.");
        setFase("lista");
        return;
      }
      ctx.drawImage(video, 0, 0, ancho, alto);

      const fotograma = await new Promise<Blob | null>((resolve) =>
        lienzo.toBlob(resolve, "image/jpeg", CALIDAD_FOTOGRAMA),
      );
      if (!fotograma) {
        setError("No pudimos procesar la foto. Intenta de nuevo.");
        setFase("lista");
        return;
      }

      // 2 — La ubicación. Sin ella la foto se descarta: no se guarda una foto a
      //     medias «para no perderla», porque una foto sin sitio es justo la que
      //     no sirve el día que hay discusión.
      const gps = await obtenerGPS();
      if (!gps) {
        setAvisoGps(
          "No pudimos obtener la ubicación, así que descartamos la foto. Permite el acceso a la " +
            "ubicación y vuelve a tomarla.",
        );
        setFase("lista");
        return;
      }

      // 3 — Fecha, hora y coordenadas quemadas DENTRO de la imagen.
      // La marca es «SEIRICON», no la de la línea de alertas: este overlay va
      // dentro del acta de estado inicial de un arquitecto, donde «SEIRICON
      // ALERTA» (el defecto del módulo, heredado de Juntos) está fuera de sitio.
      const imagen = await quemarOverlay(
        new File([fotograma], "captura.jpg", { type: "image/jpeg" }),
        capturadaEn,
        gps,
        etiquetaUbicacion,
        WORDMARK_REGISTRO_INICIAL,
      );

      await onCapturada({ imagen, capturadaEn, gps });
      setFase("lista");
    } catch {
      setError("No pudimos guardar la foto. Intenta de nuevo.");
      setFase("lista");
    }
  }

  if (fase === "cerrada") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={abrir}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
        >
          <Video className="h-4 w-4" />
          Abrir la cámara
        </button>
        <p className="text-xs leading-relaxed text-slate-500">
          Las fotos del registro inicial se toman aquí, con la cámara. No se pueden subir desde la
          galería: una foto guardada no prueba en qué fecha se tomó, y esa fecha es todo lo que este
          registro sirve para demostrar.
        </p>
        {error && <p className="text-sm text-rose-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-auto w-full max-h-[60vh] object-contain"
        />
        <p className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 text-xs text-white">
          {etiquetaUbicacion}
        </p>
      </div>

      {avisoGps && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {avisoGps}
        </p>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={capturar}
          disabled={disabled || fase !== "lista"}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
        >
          {fase === "capturando" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {fase === "capturando" ? "Guardando la foto…" : "Tomar foto"}
        </button>
        <button
          type="button"
          onClick={cerrar}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <CameraOff className="h-4 w-4" />
          Cerrar cámara
        </button>
      </div>
    </div>
  );
}
