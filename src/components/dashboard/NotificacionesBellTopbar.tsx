"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, XCircle, Lightbulb, Camera, X } from "lucide-react";
import { useNotificaciones, type Notificacion, type TipoNotificacion } from "@/components/dashboard/NotificacionesContext";

function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const minutos = Math.floor(diff / 60000);
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas}h`;
  return `Hace ${Math.floor(horas / 24)}d`;
}

function IconoPorTipo({ tipo }: { tipo: TipoNotificacion }) {
  switch (tipo) {
    case "TAREA_APROBADA":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
    case "TAREA_RECHAZADA":
      return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
    case "SUGERENCIA_NUEVA":
    case "SUGERENCIA_APROBADA":
    case "SUGERENCIA_RECHAZADA":
      return <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    case "OBRERO_REPORTO":
    case "TAREA_REPORTADA":
      return <Camera className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    default:
      return <Bell className="w-4 h-4 text-slate-400 flex-shrink-0" />;
  }
}

/**
 * Campanita del topbar — muestra SOLO no leídas. Al abrir el dropdown, las
 * notificaciones visibles quedan listadas durante la sesión actual, pero
 * al cerrar el dropdown se marcan todas como leídas y desaparecen del
 * próximo open. También muestra el toast/sonido cuando llega una nueva.
 */
export default function NotificacionesBellTopbar() {
  const router = useRouter();
  const { notificaciones, totalNoLeidas, toast, dismissToast, markRead, markAllRead } =
    useNotificaciones();
  const [open, setOpen] = useState(false);
  // Snapshot de IDs no leídas en el momento de abrir, para que sigan visibles
  // mientras el dropdown está abierto aunque las marquemos como leídas.
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closedByRef = useRef<"item" | "outside" | "x" | null>(null);

  const noLeidas = notificaciones.filter((n) => !n.leida);
  const mostrar: Notificacion[] = open
    ? notificaciones.filter((n) => visibleIds.includes(n.id) || !n.leida)
    : noLeidas;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closedByRef.current = "outside";
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleOpen() {
    setVisibleIds(noLeidas.map((n) => n.id));
    setOpen(true);
  }

  // Al cerrar, marca como leídas las que estaban visibles (sin esperar a click).
  useEffect(() => {
    if (!open && visibleIds.length > 0) {
      const aMarcar = notificaciones
        .filter((n) => visibleIds.includes(n.id) && !n.leida)
        .map((n) => n.id);
      if (aMarcar.length > 0) markRead(aMarcar);
      setVisibleIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleClickItem(n: Notificacion) {
    if (!n.leida) await markRead([n.id]);
    closedByRef.current = "item";
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function handleToastClick() {
    if (!toast) return;
    await markRead([toast.id]);
    const link = toast.link;
    dismissToast();
    if (link) router.push(link);
  }

  return (
    <>
      {/* Toast popup */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-toast-in">
          <button
            onClick={handleToastClick}
            className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors"
          >
            <div className="mt-0.5">
              <IconoPorTipo tipo={toast.tipo} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{toast.titulo}</p>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{toast.mensaje}</p>
            </div>
          </button>
          <button
            onClick={dismissToast}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="h-1 bg-blue-500 animate-shrink-5s" />
        </div>
      )}

      {/* Bell trigger */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => (open ? setOpen(false) : handleOpen())}
          className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900 cursor-pointer"
          aria-label="Notificaciones"
        >
          <Bell className="w-[18px] h-[18px]" />
          {totalNoLeidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none border-2 border-white">
              {totalNoLeidas > 99 ? "99+" : totalNoLeidas}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute top-full right-0 mt-2 w-[360px] bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <span className="text-sm font-semibold text-slate-800">Nuevas</span>
                <p className="text-[10px] text-slate-400">
                  {noLeidas.length === 0
                    ? "Sin notificaciones nuevas"
                    : `${noLeidas.length} sin leer`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {noLeidas.length > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Marcar todas leídas
                  </button>
                )}
                <button
                  onClick={() => {
                    closedByRef.current = "x";
                    setOpen(false);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[24rem] overflow-y-auto">
              {mostrar.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  Sin notificaciones nuevas
                </div>
              ) : (
                <ul>
                  {mostrar.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClickItem(n)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 bg-blue-50/60"
                      >
                        <span className="mt-0.5">
                          <IconoPorTipo tipo={n.tipo} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {n.titulo}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-snug">
                            {n.mensaje}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {tiempoRelativo(n.created_at)}
                          </p>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {notificaciones.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                <p className="text-[10px] text-slate-500 text-center">
                  Para ver el historial completo, usa &quot;Notificaciones&quot; en el menú lateral.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
