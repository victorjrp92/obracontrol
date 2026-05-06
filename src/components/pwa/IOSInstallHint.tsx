"use client";

import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";

const DISMISS_KEY = "ios-install-hint-dismissed";

/**
 * Hint visual para iOS Safari (que NO dispara `beforeinstallprompt`).
 * Solo se muestra si:
 *  - El user agent es iOS
 *  - No está corriendo ya como standalone (PWA instalada)
 *  - No fue dismisseado previamente
 */
export default function IOSInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    if (!isIOS) return;

    // Detectar standalone en iOS Safari
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - iOS-specific property
      window.navigator.standalone === true;
    if (isStandalone) return;

    if (localStorage.getItem(DISMISS_KEY)) return;

    // Pequeño delay para que el usuario vea primero la app
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1"
      >
        <X className="w-4 h-4" />
      </button>
      <h3 className="text-sm font-bold text-slate-900 pr-6">
        Instala la app en tu iPhone
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        Para acceder más rápido, agregar a la pantalla de inicio:
      </p>
      <ol className="mt-2 space-y-1.5 text-xs text-slate-700">
        <li className="flex items-center gap-2">
          <span className="font-bold text-slate-400">1.</span>
          <span>Tap el botón</span>
          <Share className="w-4 h-4 text-blue-600" />
          <span>compartir</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="font-bold text-slate-400">2.</span>
          <span>Tap</span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <Plus className="w-3.5 h-3.5" />
            Agregar al inicio
          </span>
        </li>
      </ol>
    </div>
  );
}
