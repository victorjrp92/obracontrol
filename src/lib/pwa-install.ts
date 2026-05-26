"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Store singleton para que múltiples componentes (auto-prompt + botón
// manual) compartan el mismo `BeforeInstallPromptEvent`. El navegador solo
// lo emite una vez; sin un store compartido, el primer listener lo captura
// y los demás se quedan vacíos.
let savedEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    savedEvent = e as BeforeInstallPromptEvent;
    notify();
  });
  // Cuando el usuario instala la app desde el browser UI, limpiamos.
  window.addEventListener("appinstalled", () => {
    savedEvent = null;
    notify();
  });
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
  savedEvent = null;
  notify();
  return outcome;
}

/**
 * Estado reactivo del install prompt.
 * - canInstall: true si el navegador ya disparó `beforeinstallprompt` y aún
 *   no se consumió (Chrome/Edge/Android).
 * - standalone: true si la app ya está corriendo como PWA instalada.
 * - ios: true si el dispositivo es iOS (necesita instrucciones manuales).
 */
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
