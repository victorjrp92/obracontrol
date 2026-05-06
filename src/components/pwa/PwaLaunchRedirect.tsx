"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Cuando la PWA se relanza desde el icono del home (start_url=/?source=pwa),
 * redirige al obrero a su última URL conocida si tenía una.
 *
 * Para usuarios con login normal, no hace nada — el flujo de auth los lleva
 * a su dashboard correspondiente.
 *
 * Montar SOLO en la landing (`/`), no en otras páginas.
 */
export default function PwaLaunchRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (params.get("source") !== "pwa") return;

    try {
      const lastObreroToken = localStorage.getItem("obrero-last-token");
      if (lastObreroToken && /^[a-z0-9-]+$/i.test(lastObreroToken)) {
        router.replace(`/o/${lastObreroToken}`);
      }
    } catch {
      // localStorage bloqueado (private mode, etc.) — quedarse en landing
    }
  }, [params, router]);

  return null;
}
