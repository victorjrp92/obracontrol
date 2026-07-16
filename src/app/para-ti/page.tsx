import { permanentRedirect } from "next/navigation";

/**
 * La página B2C anterior fue reemplazada por Seiricon Go (decisión de Victor,
 * 2026-07-12: resuelve de paso el claim de offline, el naming "arquitecto" y
 * el conflicto con la lista de espera). La versión vieja queda en git.
 */
export default function ParaTiRedirect() {
  permanentRedirect("/go");
}
