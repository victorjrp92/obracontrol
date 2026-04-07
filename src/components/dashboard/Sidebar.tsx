"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import {
  HardHat,
  LayoutDashboard,
  FolderOpen,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: FolderOpen, label: "Proyectos", href: "/dashboard/proyectos" },
  { icon: ClipboardList, label: "Tareas", href: "/dashboard/tareas" },
  { icon: Users, label: "Contratistas", href: "/dashboard/contratistas" },
  { icon: BarChart3, label: "Reportes", href: "/dashboard/reportes" },
  { icon: Settings, label: "Configuración", href: "/dashboard/configuracion" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`relative flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 h-full ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <HardHat className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-base tracking-tight whitespace-nowrap">
            Obra<span className="text-blue-400">Control</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-800 p-3 flex flex-col gap-1">
        <button
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Notificaciones" : undefined}
        >
          <Bell className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Notificaciones</span>}
        </button>
        <form action={logout}>
          <button
            type="submit"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors w-full ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "Salir" : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Salir</span>}
          </button>
        </form>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-md z-10"
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
