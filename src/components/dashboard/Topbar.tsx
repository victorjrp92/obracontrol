"use client";

import { Bell, Search, ChevronDown } from "lucide-react";

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

export default function Topbar({ title = "Dashboard", subtitle }: TopbarProps) {
  return (
    <header className="h-16 flex items-center justify-between gap-4 px-6 border-b border-slate-100 bg-white flex-shrink-0">
      {/* Page title */}
      <div>
        <h1 className="text-base font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block">
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

        {/* User avatar */}
        <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            JM
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-800">Jaramillo Mora</div>
            <div className="text-[10px] text-slate-500">Administrador</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </header>
  );
}
