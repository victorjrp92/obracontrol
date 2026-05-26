"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type TipoNotificacion =
  | "TAREA_APROBADA"
  | "TAREA_RECHAZADA"
  | "SUGERENCIA_NUEVA"
  | "SUGERENCIA_APROBADA"
  | "SUGERENCIA_RECHAZADA"
  | "OBRERO_REPORTO"
  | "TAREA_REPORTADA";

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  link: string | null;
  created_at: string;
}

export interface ToastNotif {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  link: string | null;
}

interface ContextValue {
  notificaciones: Notificacion[];
  totalNoLeidas: number;
  userId: string | null;
  toast: ToastNotif | null;
  dismissToast: () => void;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

const Ctx = createContext<ContextValue | null>(null);

export function useNotificaciones(): ContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useNotificaciones debe usarse dentro de NotificacionesProvider");
  }
  return ctx;
}

// Beep corto vía Web Audio API. Falla silenciosamente si el navegador bloquea
// autoplay antes de la primera interacción del usuario.
function playBeep() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const audioCtx = new Ctor();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
    osc.onended = () => audioCtx.close();
  } catch {
    // ignore
  }
}

const LIMIT_HISTORIAL = 50;

export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotif | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/notificaciones?limit=${LIMIT_HISTORIAL}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotificaciones(data.notificaciones ?? []);
      setTotalNoLeidas(data.totalNoLeidas ?? 0);
      if (data.userId) setUserId(data.userId);
    } catch {
      // ignore
    }
  }, []);

  // Initial fetch + polling defensivo (60s por si Realtime se cae)
  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 60_000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Suscripción Supabase Realtime. Envuelta en try/catch para que un fallo
  // de WebSocket (RLS, network, etc) NUNCA crashee la página.
  useEffect(() => {
    if (!userId) return;
    let cleanup: (() => void) | undefined;
    try {
      const supabase = createClient();
      // Canal único por montaje — evita "cannot add callbacks after subscribe"
      // si quedó un canal previo colgado en el registro del cliente.
      const channelName = `notif-${userId}-${Date.now()}`;
      const channel = supabase.channel(channelName);
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones",
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as unknown as Notificacion;
          setNotificaciones((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev].slice(0, LIMIT_HISTORIAL);
          });
          if (!row.leida) setTotalNoLeidas((c) => c + 1);
          setToast({
            id: row.id,
            tipo: row.tipo,
            titulo: row.titulo,
            mensaje: row.mensaje,
            link: row.link,
          });
          playBeep();
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setToast(null), 5_000);
        },
      );
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`Realtime ${channelName}: ${status} (polling sigue activo)`);
        }
      });
      cleanup = () => {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      };
    } catch (err) {
      console.error("No se pudo iniciar Realtime:", err);
    }
    return cleanup;
  }, [userId]);

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    // Optimista: actualiza UI inmediatamente
    setNotificaciones((prev) =>
      prev.map((n) => (ids.includes(n.id) && !n.leida ? { ...n, leida: true } : n)),
    );
    setTotalNoLeidas((c) => {
      const cuantasEranNoLeidas = ids.filter((id) =>
        notificaciones.find((n) => n.id === id && !n.leida),
      ).length;
      return Math.max(0, c - cuantasEranNoLeidas);
    });
    try {
      await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      // ignore — el optimistic update queda; el siguiente refetch corrige
    }
  }, [notificaciones]);

  const markAllRead = useCallback(async () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    setTotalNoLeidas(0);
    try {
      await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // ignore
    }
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <Ctx.Provider
      value={{
        notificaciones,
        totalNoLeidas,
        userId,
        toast,
        dismissToast,
        markRead,
        markAllRead,
        refetch,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
