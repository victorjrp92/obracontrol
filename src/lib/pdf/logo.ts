/**
 * Logo real de Seiricon para los PDF de react-pdf (SOLO servidor: usa fs).
 * Se lee una vez de public/seiricon-logo.png y se cachea como data-URI,
 * que es el formato que `<Image src>` de @react-pdf/renderer consume sin
 * depender del host. Si el archivo no está (build raro), devuelve null y el
 * reporte cae al wordmark de texto — el PDF nunca falla por el logo.
 */
import { readFileSync } from "fs";
import path from "path";

let cache: string | null | undefined;

export function logoSeiriconDataUrl(): string | null {
  if (cache !== undefined) return cache;
  try {
    const ruta = path.join(process.cwd(), "public", "seiricon-logo.png");
    cache = `data:image/png;base64,${readFileSync(ruta).toString("base64")}`;
  } catch {
    cache = null;
  }
  return cache;
}
