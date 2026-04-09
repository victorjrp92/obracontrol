"use client";

import { Bell, Search, ChevronDown } from "lucide-react";

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
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar proyecto, tarea..."
            className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 w-60 text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900 cursor-pointer">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 border-2 border-white" />
        </button>
      </div>
    </header>
  );
}
