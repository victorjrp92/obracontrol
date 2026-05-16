"use client";

import { useEffect } from "react";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import IOSInstallHint from "@/components/pwa/IOSInstallHint";
import OfflineQueueBadge from "@/components/pwa/OfflineQueueBadge";
import { installOnlineFlushListener } from "@/lib/offline-queue";

interface ObreroLayoutProps {
  obreroNombre: string;
  contratistaNombre: string;
  token?: string;
  children: React.ReactNode;
}

export default function ObreroLayout({
  obreroNombre,
  contratistaNombre,
  token,
  children,
}: ObreroLayoutProps) {
  // Drenar la cola offline cuando vuelva la conexión + intento inicial.
  useEffect(() => {
    return installOnlineFlushListener();
  }, []);

  // Recordar el último token usado, así un re-launch desde el icono PWA
  // (start_url=/) puede redirigir al obrero a su URL.
  useEffect(() => {
    if (typeof window === "undefined" || !token) return;
    try {
      localStorage.setItem("obrero-last-token", token);
    } catch {
      // ignore
    }
  }, [token]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <img
          src="/seiricon-icon.png"
          alt="Seiricon"
          className="w-8 h-8 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-slate-900 truncate">
            {obreroNombre}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {contratistaNombre}
          </div>
        </div>
        <OfflineQueueBadge />
      </header>

      <main className="p-4">{children}</main>

      {/* PWA: Android/Chrome → InstallPrompt nativo. iOS Safari → hint manual. */}
      <InstallPrompt />
      <IOSInstallHint />
    </div>
  );
}
