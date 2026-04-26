"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

/**
 * Muestra un prompt para instalar la PWA. Se oculta si:
 * - El navegador no dispara `beforeinstallprompt` (iOS Safari, etc.)
 * - El usuario ya la instaló (display-mode: standalone)
 * - El usuario dismisseó previamente (localStorage)
 */
export default function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!evt) return null;

  async function handleInstall() {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "dismissed") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
    setEvt(null);
  }

  function handleClose() {
    localStorage.setItem(DISMISS_KEY, "1");
    setEvt(null);
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
            Instalar ObraControl
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
