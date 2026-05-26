"use client";

import { Search } from "lucide-react";
import OfflineQueueBadge from "@/components/pwa/OfflineQueueBadge";
import NotificacionesBellTopbar from "@/components/dashboard/NotificacionesBellTopbar";

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

export default function Topbar({ title = "Dashboard", subtitle }: TopbarProps) {
  return (
    <header className="h-14 sm:h-16 flex items-center justify-between gap-4 px-4 sm:px-6 border-b border-slate-100 bg-white flex-shrink-0">
      {/* Page title — offset on mobile for hamburger */}
      <div className="pl-12 lg:pl-0">
        <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-[10px] sm:text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Evidencias pendientes de sincronizar */}
        <OfflineQueueBadge />

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar proyecto, tarea..."
            className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 w-60 text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Notificaciones (solo no leídas — historial está en sidebar) */}
        <NotificacionesBellTopbar />
      </div>
    </header>
  );
}
