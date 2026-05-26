"use client";

import { useState } from "react";
import { Download, Plus, Share, X, CheckCircle2 } from "lucide-react";
import { triggerInstall, usePwaInstall } from "@/lib/pwa-install";

interface Props {
  collapsed?: boolean;
}

/**
 * Botón "Instalar app" para los sidebars. Comportamiento por plataforma:
 *  - Chrome/Edge/Android con prompt capturado: ejecuta el install nativo.
 *  - iOS Safari: abre modal con instrucciones manuales (Compartir → Agregar).
 *  - Ya instalada (standalone) o navegador sin soporte: no se muestra.
 */
export default function InstalarAppButton({ collapsed = false }: Props) {
  const { canInstall, standalone, ios } = usePwaInstall();
  const [showIosModal, setShowIosModal] = useState(false);
  const [resultado, setResultado] = useState<"accepted" | "dismissed" | null>(null);

  // No mostrar si ya está instalada o si la plataforma no permite instalar.
  if (standalone) return null;
  if (!canInstall && !ios) return null;

  async function handleClick() {
    if (ios && !canInstall) {
      setShowIosModal(true);
      return;
    }
    const r = await triggerInstall();
    if (r === "accepted") setResultado("accepted");
    else if (r === "dismissed") setResultado("dismissed");
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors w-full ${
          collapsed ? "justify-center" : ""
        }`}
        title={collapsed ? "Instalar app" : undefined}
      >
        <Download className="w-4 h-4 flex-shrink-0" />
        {!collapsed && <span>Instalar app</span>}
      </button>

      {/* Feedback breve tras instalar/cancelar */}
      {resultado && (
        <div
          className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
          role="status"
        >
          <button
            onClick={() => setResultado(null)}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
          {resultado === "accepted" ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-800">¡App instalada!</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ya puedes acceder desde el ícono en tu pantalla de inicio.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-800">Instalación cancelada</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Puedes intentar de nuevo en cualquier momento.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de instrucciones iOS */}
      {showIosModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
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
                  Tap el botón{" "}
                  <Share className="inline w-4 h-4 text-blue-600 mb-0.5" />{" "}
                  <strong>Compartir</strong> en la barra inferior.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <span className="flex-1">
                  Desplázate y tap{" "}
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
                  Tap <strong>Agregar</strong> arriba a la derecha. ¡Listo!
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
