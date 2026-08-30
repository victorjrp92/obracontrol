"use client";

import { useSyncExternalStore } from "react";

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

/**
 * Suscripción al store singleton de arriba. Es la firma que pide
 * `useSyncExternalStore`: devuelve la baja.
 */
function suscribir(alCambiar: () => void): () => void {
  listeners.add(alCambiar);
  return () => {
    listeners.delete(alCambiar);
  };
}

/** El estado del navegador en el servidor: no hay navegador. */
const enServidor = () => false;

/**
 * Estado de instalación de la PWA.
 *
 * Se lee con `useSyncExternalStore` y no con `useState` + efecto porque esto YA
 * es un store externo (el `savedEvent` singleton con su `Set` de oyentes, arriba
 * en este mismo fichero). La versión anterior sembraba los tres booleanos con
 * `setState` dentro de un efecto de montaje —lo que dispara un render en
 * cascada y es lo que marca `react-hooks/set-state-in-effect`— y además dejaba
 * `standalone` e `ios` congelados en el valor del montaje.
 *
 * Cada `useSyncExternalStore` devuelve un BOOLEANO, no un objeto: React compara
 * la instantánea por identidad y un objeto nuevo en cada llamada sería un bucle
 * de renders. El objeto se compone al devolver, que es inocuo.
 */
export function usePwaInstall() {
  const canInstall = useSyncExternalStore(suscribir, () => savedEvent !== null, enServidor);
  const standalone = useSyncExternalStore(suscribir, isStandalone, enServidor);
  const ios = useSyncExternalStore(suscribir, isIOS, enServidor);

  return { canInstall, standalone, ios };
}

// ─── Descarte de los banners de instalación ────────────────────────────────
// Mismo patrón: `localStorage` es un store externo, así que se lee con
// `useSyncExternalStore` en vez de copiarlo a estado dentro de un efecto.

const oyentesDescarte = new Set<() => void>();

function leerDescartado(clave: string): boolean {
  try {
    return window.localStorage.getItem(clave) !== null;
  } catch {
    // Safari en navegación privada lanza al tocar localStorage. Sin dato
    // guardado, el banner se muestra: es el estado por defecto, no un fallo.
    return false;
  }
}

/** Marca el banner `clave` como descartado y avisa a todas sus instancias. */
export function marcarDescartado(clave: string): void {
  try {
    window.localStorage.setItem(clave, "1");
  } catch {
    // Sin persistencia, el descarte dura lo que la pestaña. Mejor que reventar.
  }
  oyentesDescarte.forEach((fn) => fn());
}

/**
 * ¿Descartó el usuario el banner `clave`?
 *
 * @param enHidratacion valor que se sirve mientras no hay `localStorage`
 *   (servidor e hidratación). El banner del Topbar arranca en `true` para no
 *   parpadear; el prompt flotante en `false` porque de todos modos depende de
 *   `canInstall`, que en el servidor es falso.
 */
export function useBannerDescartado(clave: string, enHidratacion: boolean): boolean {
  return useSyncExternalStore(
    (alCambiar) => {
      oyentesDescarte.add(alCambiar);
      // `storage` sincroniza pestañas: descartar en una lo descarta en todas.
      window.addEventListener("storage", alCambiar);
      return () => {
        oyentesDescarte.delete(alCambiar);
        window.removeEventListener("storage", alCambiar);
      };
    },
    () => leerDescartado(clave),
    () => enHidratacion,
  );
}
