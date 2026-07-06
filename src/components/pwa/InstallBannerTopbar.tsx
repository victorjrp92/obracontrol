"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { emitPwaEvento, triggerInstall, usePwaInstall } from "@/lib/pwa-install";

const DISMISS_KEY = "pwa-install-banner-dismissed";

/**
 * Banner discreto que se muestra arriba del Topbar invitando a instalar la
 * PWA. Visible solo cuando hay un install prompt disponible (Chrome/Edge/
 * Android) o cuando es iOS (que abre modal con instrucciones manuales).
 * Se cierra con la X y queda persistente hasta limpiar localStorage o
 * desinstalar.
 */
export default function InstallBannerTopbar() {
  const { canInstall, standalone, ios } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true); // empieza true para no flashear en hidratación
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (standalone || dismissed) return null;
  if (!canInstall && !ios) return null;

  async function handleInstall() {
    if (ios && !canInstall) {
      setShowIosModal(true);
      emitPwaEvento("IOS_INSTRUCTIONS_SHOWN");
      return;
    }
    await triggerInstall();
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <>
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2 sm:gap-3">
        <Download className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <p className="text-xs sm:text-sm text-slate-700 flex-1 min-w-0">
          <span className="font-semibold">Instala Seiricon</span>
          <span className="hidden sm:inline text-slate-500"> — Acceso rápido desde tu celular, funciona sin conexión.</span>
        </p>
        <button
          onClick={handleInstall}
          className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
        >
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-700 p-1 flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modal iOS — Safari no soporta el prompt nativo */}
      {showIosModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowIosModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900">Instalar en iPhone</h3>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Safari no permite instalar directamente. Sigue estos pasos:
            </p>

            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <span className="flex-1">
                  Toca el botón{" "}
                  <Share className="inline w-4 h-4 text-blue-600 mb-0.5" />{" "}
                  <strong>Compartir</strong> en la barra inferior.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <span className="flex-1">
                  Desplázate y toca{" "}
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Plus className="w-3.5 h-3.5" />
                    Agregar al inicio
                  </span>
                  .
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <span className="flex-1">
                  Toca <strong>Agregar</strong> arriba a la derecha. Listo.
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosModal(false)}
              className="mt-5 w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
