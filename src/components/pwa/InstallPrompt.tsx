"use client";

import { Download, X } from "lucide-react";
import {
  marcarDescartado,
  triggerInstall,
  useBannerDescartado,
  usePwaInstall,
} from "@/lib/pwa-install";

const DISMISS_KEY = "pwa-install-dismissed";

/**
 * Prompt automático que se muestra una vez cuando el navegador emite
 * `beforeinstallprompt`. El usuario puede dismissearlo (no vuelve a aparecer
 * hasta limpiar localStorage) o instalar. Comparte el event con el botón
 * manual del sidebar vía `@/lib/pwa-install`.
 */
export default function InstallPrompt() {
  const { canInstall, standalone } = usePwaInstall();
  // `false` en hidratación: da igual, en el servidor `canInstall` ya es falso
  // y el componente no pinta nada.
  const dismissed = useBannerDescartado(DISMISS_KEY, false);

  if (standalone || dismissed || !canInstall) return null;

  async function handleInstall() {
    const result = await triggerInstall();
    if (result === "dismissed") {
      marcarDescartado(DISMISS_KEY);
    }
  }

  function handleClose() {
    marcarDescartado(DISMISS_KEY);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
      <button
        type="button"
        onClick={handleClose}
        aria-label="Cerrar"
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">
            Instalar Seiricon
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Acceso directo desde tu celular, funciona sin conexión y sube
            evidencias en segundo plano.
          </p>
          <button
            type="button"
            onClick={handleInstall}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}
