"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import {
  LayoutDashboard,
  Building2,
  UsersRound,
  FolderOpen,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Shield,
  KeyRound,
  Briefcase,
  HardHat,
  Smartphone,
} from "lucide-react";
import NotificacionesDropdown from "@/components/dashboard/NotificacionesDropdown";

const navItems = [
  { key: "sa-dashboard", icon: LayoutDashboard, label: "Vista global", href: "/super-admin" },
  { key: "sa-constructoras", icon: Building2, label: "Constructoras", href: "/super-admin/constructoras" },
  { key: "sa-proyectos", icon: FolderOpen, label: "Proyectos", href: "/super-admin/proyectos" },
  { key: "sa-admins", icon: UsersRound, label: "Admin Generales", href: "/super-admin/admins-generales" },
  { key: "sa-contratistas", icon: Briefcase, label: "Contratistas", href: "/super-admin/contratistas" },
  { key: "sa-obreros", icon: HardHat, label: "Obreros", href: "/super-admin/obreros" },
  { key: "sa-roles", icon: KeyRound, label: "Roles del sistema", href: "/super-admin/roles" },
  { key: "sa-reportes", icon: BarChart3, label: "Reportes globales", href: "/super-admin/reportes" },
  { key: "sa-pwa", icon: Smartphone, label: "Instalaciones PWA", href: "/super-admin/pwa-metricas" },
  { key: "sa-configuracion", icon: Settings, label: "Configuración", href: "/super-admin/configuracion" },
];

interface Props {
  userName?: string;
}

export default function SidebarSuperAdmin({ userName = "Super Admin" }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const sidebarContent = (
    <>
      <div className="flex items-center h-16 border-b border-slate-800 flex-shrink-0">
        <Link
          href="/super-admin"
          className="flex items-center gap-2.5 px-4 flex-1 min-w-0"
          onClick={() => setMobileOpen(false)}
        >
          <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-extrabold text-white text-base tracking-wide whitespace-nowrap">SEIRICON</div>
              <div className="text-[9px] text-red-300 whitespace-nowrap font-semibold">SUPER ADMIN</div>
            </div>
          )}
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 text-slate-400 hover:text-white mr-3"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{userName}</div>
              <div className="text-[10px] text-red-300 truncate font-semibold">Dueño del sistema</div>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/super-admin" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    active ? "bg-red-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
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

      <div className="border-t border-slate-800 p-3 flex flex-col gap-1">
        <NotificacionesDropdown collapsed={collapsed} />
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

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-slate-900 border border-slate-700 rounded-full hidden lg:flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-md z-10"
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col transform transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      <aside
        className={`relative hidden lg:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 h-full ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
