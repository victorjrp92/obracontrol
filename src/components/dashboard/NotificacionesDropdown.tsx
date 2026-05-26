"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Camera,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TipoNotificacion =
  | "TAREA_APROBADA"
  | "TAREA_RECHAZADA"
  | "SUGERENCIA_NUEVA"
  | "SUGERENCIA_APROBADA"
  | "SUGERENCIA_RECHAZADA"
  | "OBRERO_REPORTO"
  | "TAREA_REPORTADA";

interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  link: string | null;
  created_at: string;
}

interface Props {
  collapsed?: boolean;
}

function tiempoRelativo(fecha: string): string {
  const ahora = Date.now();
  const diff = ahora - new Date(fecha).getTime();
  const minutos = Math.floor(diff / 60000);
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias}d`;
  return new Date(fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
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

// Genera un beep corto vía Web Audio API (no requiere assets). El navegador
// puede bloquear audio si el usuario aún no ha interactuado con la página —
// en ese caso falla silenciosamente.
function playBeep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // ignore — autoplay bloqueado u otro problema
  }
}

interface ToastState {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacion;
  link: string | null;
}

function ToastBanner({ toast, onDismiss, onClick }: { toast: ToastState; onDismiss: () => void; onClick: () => void }) {
  return (
    <div className="fixed top-4 right-4 z-[60] max-w-sm w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-toast-in">
      <button
        onClick={onClick}
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
        onClick={onDismiss}
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="h-1 bg-blue-500 animate-shrink-5s" />
    </div>
  );
}

export default function NotificacionesDropdown({ collapsed = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotificaciones = useCallback(async () => {
    try {
      const res = await fetch("/api/notificaciones?limit=10");
      if (!res.ok) return;
      const data = await res.json();
      setNotificaciones(data.notificaciones ?? []);
      setTotalNoLeidas(data.totalNoLeidas ?? 0);
      if (data.userId) setUserId(data.userId);
    } catch {
      // silently ignore
    }
  }, []);

  // Fetch inicial + polling defensivo cada 60s (por si realtime se desconecta).
  useEffect(() => {
    fetchNotificaciones();
    const interval = setInterval(fetchNotificaciones, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotificaciones]);

  // Suscripción Supabase Realtime: INSERT en notificaciones filtrado por usuario.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notificaciones:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones",
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            tipo: TipoNotificacion;
            titulo: string;
            mensaje: string;
            leida: boolean;
            link: string | null;
            created_at: string;
          };
          // Prepend a la lista
          setNotificaciones((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev].slice(0, 10);
          });
          if (!row.leida) setTotalNoLeidas((c) => c + 1);
          // Toast + sonido
          setToast({
            id: row.id,
            titulo: row.titulo,
            mensaje: row.mensaje,
            tipo: row.tipo,
            link: row.link,
          });
          playBeep();
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setToast(null), 5_000);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function marcarTodasLeidas() {
    setCargando(true);
    try {
      await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      setTotalNoLeidas(0);
    } finally {
      setCargando(false);
    }
  }

  async function handleClickNotificacion(n: Notificacion) {
    if (!n.leida) {
      await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      });
      setNotificaciones((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, leida: true } : item))
      );
      setTotalNoLeidas((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (n.link) {
      router.push(n.link);
    }
  }

  async function handleToastClick() {
    if (!toast) return;
    // Marca como leída y navega
    try {
      await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [toast.id] }),
      });
    } catch {
      // ignore
    }
    setNotificaciones((prev) =>
      prev.map((item) => (item.id === toast.id ? { ...item, leida: true } : item)),
    );
    setTotalNoLeidas((prev) => Math.max(0, prev - 1));
    const link = toast.link;
    setToast(null);
    if (link) router.push(link);
  }

  return (
    <>
      {toast && (
        <ToastBanner
          toast={toast}
          onDismiss={() => setToast(null)}
          onClick={handleToastClick}
        />
      )}
      <div ref={dropdownRef} className="relative w-full">
        <button
          onClick={() => {
            setOpen((v) => !v);
            if (!open) fetchNotificaciones();
          }}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full ${
            collapsed ? "justify-center" : ""
          }`}
          title={collapsed ? "Notificaciones" : undefined}
        >
          <span className="relative flex-shrink-0">
            <Bell className="w-4 h-4" />
            {totalNoLeidas > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {totalNoLeidas > 99 ? "99+" : totalNoLeidas}
              </span>
            )}
          </span>
          {!collapsed && <span>Notificaciones</span>}
        </button>

        {open && (
          <div className="absolute bottom-full left-0 mb-2 w-[360px] bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800">Notificaciones</span>
              <div className="flex items-center gap-2">
                {totalNoLeidas > 0 && (
                  <button
                    onClick={marcarTodasLeidas}
                    disabled={cargando}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    Marcar todas como leídas
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notificaciones.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  Sin notificaciones
                </div>
              ) : (
                <ul>
                  {notificaciones.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClickNotificacion(n)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${
                          !n.leida ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <span className="mt-0.5">
                          <IconoPorTipo tipo={n.tipo} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm leading-snug truncate ${
                              !n.leida ? "font-semibold text-slate-800" : "font-medium text-slate-700"
                            }`}
                          >
                            {n.titulo}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                            {n.mensaje}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {tiempoRelativo(n.created_at)}
                          </p>
                        </div>
                        {!n.leida && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
