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

type TipoNotificacion =
  | "TAREA_APROBADA"
  | "TAREA_RECHAZADA"
  | "SUGERENCIA_NUEVA"
  | "SUGERENCIA_APROBADA"
  | "SUGERENCIA_RECHAZADA"
  | "OBRERO_REPORTO";

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
      return <Camera className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    default:
      return <Bell className="w-4 h-4 text-slate-400 flex-shrink-0" />;
  }
}

export default function NotificacionesDropdown({ collapsed = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotificaciones = useCallback(async () => {
    try {
      const res = await fetch("/api/notificaciones?limit=10");
      if (!res.ok) return;
      const data = await res.json();
      setNotificaciones(data.notificaciones ?? []);
      setTotalNoLeidas(data.totalNoLeidas ?? 0);
    } catch {
      // silently ignore
    }
  }, []);

  // Fetch on mount and poll every 30s for unread count
  useEffect(() => {
    fetchNotificaciones();
    const interval = setInterval(fetchNotificaciones, 30000);
    return () => clearInterval(interval);
  }, [fetchNotificaciones]);

  // Close when clicking outside
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

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Trigger button */}
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

      {/* Dropdown panel */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[360px] bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
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

          {/* List */}
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
  );
}
