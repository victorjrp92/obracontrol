/**
 * Quema fecha/hora/GPS (y una etiqueta de espacio) en una foto para el Acta
 * de daños de /alerta/documentar.
 *
 * IMPORTANTE — este módulo es intencionalmente PARALELO a la lógica de
 * overlay que ya vive dentro de `src/components/evidencia/CameraCapture.tsx`
 * (función `drawOverlay`), NO una extracción compartida. `CameraCapture.tsx`
 * alimenta 3 superficies de producción (obrero con cola offline en
 * IndexedDB, `ReportarButton.tsx` B2B, `SugerirTareaForm.tsx` B2C) y el
 * service worker de Serwist — cualquier cambio de comportamiento ahí es de
 * alto riesgo para flujos ya en producción. Cero cambios en ese archivo.
 *
 * El Acta de daños es un flujo público nuevo, sin tenant, con su propio tope
 * de payload (Vercel: ~4.5MB por función serverless) — por eso este módulo
 * tiene su PROPIO perfil de compresión (fotos más chicas que las de
 * CameraCapture.tsx) en vez de reusar el de allá.
 *
 * Ver docs/specs/2026-08-13-seiricon-alerta-fase1.md, addendum R1 y R2.
 */

export interface GPSCoords {
  lat: number;
  lng: number;
}

/** Perfil de compresión propio del Acta (spec addendum R1) — más agresivo que CameraCapture.tsx. */
export const MAX_DIM = 1200;
export const CALIDAD_JPEG = 0.65;

export async function obtenerGPS(): Promise<GPSCoords | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

/**
 * Redimensiona la foto a `MAX_DIM`, quema una franja con fecha/hora/GPS/
 * etiqueta de espacio y la comprime a JPEG en `CALIDAD_JPEG`.
 */
export async function quemarOverlay(
  file: File,
  timestamp: Date,
  gps: GPSCoords | null,
  etiquetaEspacio?: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas no disponible"));
      ctx.drawImage(img, 0, 0, w, h);

      const padding = Math.round(canvas.width * 0.025);
      const lineHeight = Math.round(canvas.width * 0.035);
      const fontSize = Math.round(canvas.width * 0.028);
      const lines: string[] = [];

      const fechaStr = timestamp.toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const horaStr = timestamp.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      lines.push(`${fechaStr} · ${horaStr}`);

      if (gps) {
        lines.push(`GPS: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`);
      } else {
        lines.push("GPS: no disponible");
      }

      if (etiquetaEspacio) lines.push(etiquetaEspacio);

      const boxHeight = lineHeight * lines.length + padding * 2;
      const boxY = canvas.height - boxHeight;

      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(0, boxY, canvas.width, boxHeight);

      ctx.fillStyle = "white";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = "top";
      lines.forEach((line, i) => {
        ctx.fillText(line, padding, boxY + padding + i * lineHeight);
      });

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `bold ${Math.round(fontSize * 0.85)}px sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText("SEIRICON ALERTA", canvas.width - padding, padding);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Error creando imagen"))),
        "image/jpeg",
        CALIDAD_JPEG
      );
    };
    img.onerror = () => reject(new Error("Error cargando imagen"));
    img.src = URL.createObjectURL(file);
  });
}

/** Convierte un Blob a data-URI base64, para mandarlo en el payload JSON de las rutas /api/alerta/*. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Error leyendo la imagen"));
    reader.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Fase 2 (triage de grietas, D5) — SOLO ADITIVO. Nada de lo de arriba
// cambia: `quemarOverlay`, `obtenerGPS`, `blobToDataUrl`, `MAX_DIM` y
// `CALIDAD_JPEG` quedan intactos y los sigue usando el Acta de daños.
//
// `GrietaCameraCapture.tsx` produce DOS blobs por cada foto de una grieta:
// el de arriba (`quemarOverlay`, con fecha/hora/GPS quemados) para la
// evidencia que va al PDF, y el de aquí abajo (`comprimirParaAnalisis`, SIN
// overlay) para el modelo de visión. La franja del overlay tapa ~10% de la
// imagen por abajo — ruido (y posible tapa de la grieta) para el modelo; se
// descarta apenas vuelve la respuesta de `observarGrieta()`.
//
// Ver docs/specs/2026-08-13-seiricon-alerta-fase2.md, sección D5.
// ─────────────────────────────────────────────────────────────────────────

/** Perfil de compresión del blob que ve el modelo de visión (spec Fase 2, D5). */
export const MAX_DIM_ANALISIS = 1400;
export const CALIDAD_ANALISIS = 0.8;

/** Redimensiona a `MAX_DIM_ANALISIS` y comprime a JPEG en `CALIDAD_ANALISIS`, SIN quemar overlay. */
export async function comprimirParaAnalisis(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_DIM_ANALISIS || h > MAX_DIM_ANALISIS) {
        const ratio = Math.min(MAX_DIM_ANALISIS / w, MAX_DIM_ANALISIS / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas no disponible"));
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Error creando imagen"))),
        "image/jpeg",
        CALIDAD_ANALISIS
      );
    };
    img.onerror = () => reject(new Error("Error cargando imagen"));
    img.src = URL.createObjectURL(file);
  });
}
