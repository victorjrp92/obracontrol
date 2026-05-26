"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type EventoTipo =
  | "PROMPT_SHOWN"
  | "INSTALL_ACCEPTED"
  | "INSTALL_DISMISSED"
  | "APP_INSTALLED"
  | "LAUNCHED_STANDALONE"
  | "IOS_INSTRUCTIONS_SHOWN";

// Store singleton para que múltiples componentes compartan el mismo
// BeforeInstallPromptEvent (el browser solo lo emite una vez).
let savedEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function detectPlatform(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function detectBrowser(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent;
  const nav = window.navigator as unknown as { brave?: unknown };
  if (nav.brave) return "brave";
  if (/Edg\//.test(ua)) return "edge";
  if (/OPR\/|Opera/.test(ua)) return "opera";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "unknown";
}

export function emitPwaEvento(evento: EventoTipo, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // Fire-and-forget. `keepalive` permite que sobreviva si la página se cierra.
  fetch("/api/pwa-eventos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      evento,
      plataforma: detectPlatform(),
      navegador: detectBrowser(),
      metadata,
    }),
    keepalive: true,
  }).catch(() => {
    // silent — telemetría no crítica
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    savedEvent = e as BeforeInstallPromptEvent;
    notify();
    // Solo trackeamos prompt_shown una vez por sesión para no spamear si
    // el browser lo re-emite tras navegación.
    if (!sessionStorage.getItem("pwa-prompt-tracked")) {
      sessionStorage.setItem("pwa-prompt-tracked", "1");
      emitPwaEvento("PROMPT_SHOWN");
    }
  });

  window.addEventListener("appinstalled", () => {
    savedEvent = null;
    notify();
    emitPwaEvento("APP_INSTALLED");
  });

  // Detectar lanzamiento como PWA standalone — fire una vez por sesión.
  const yaCorreStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (yaCorreStandalone && !sessionStorage.getItem("pwa-standalone-tracked")) {
    sessionStorage.setItem("pwa-standalone-tracked", "1");
    // delay para asegurar que la auth/cookies estén listas
    setTimeout(() => emitPwaEvento("LAUNCHED_STANDALONE"), 800);
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

export async function triggerInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!savedEvent) return "unavailable";
  await savedEvent.prompt();
  const { outcome } = await savedEvent.userChoice;
  emitPwaEvento(outcome === "accepted" ? "INSTALL_ACCEPTED" : "INSTALL_DISMISSED");
  savedEvent = null;
  notify();
  return outcome;
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setCanInstall(savedEvent !== null);
    setStandalone(isStandalone());
    setIos(isIOS());
    function handler() {
      setCanInstall(savedEvent !== null);
    }
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return { canInstall, standalone, ios };
}
