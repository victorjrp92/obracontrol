"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import NotificacionesDropdown from "@/components/dashboard/NotificacionesDropdown";

// El portal del directivo tiene UNA pantalla: /directivo, que ya lista las
// obras (el antiguo item "Proyectos" apuntaba a /directivo?tab=proyectos y era
// un enlace muerto — esa página no declara `searchParams`, así que el query no
// cambiaba ni el contenido ni el resaltado).
//
// Las dos cosas que un directivo viene a ver de verdad —el estado de las tareas
// y las gráficas— viven en el shell de administración, al que SÍ tiene derecho
// de entrar: el layout de (dashboard) solo rebota a SUPER_ADMIN y CONTRATISTA.
// Se marcan con `externo` porque lo sacan de su portal, y Sidebar.tsx le pinta
// allí el camino de vuelta.
const navItems = [
  { key: "inicio", icon: LayoutDashboard, label: "Inicio", href: "/directivo", externo: false },
  { key: "tareas", icon: ClipboardList, label: "Tareas", href: "/dashboard/tareas", externo: true },
  { key: "reportes", icon: BarChart3, label: "Reportes", href: "/dashboard/reportes", externo: true },
];

interface SidebarDirectivoProps {
  userName?: string;
}

export default function SidebarDirectivo({ userName = "Usuario" }: SidebarDirectivoProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-slate-800 flex-shrink-0">
        <img src="/seiricon-icon.png" alt="Seiricon" className="w-9 h-9 flex-shrink-0" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-extrabold text-white text-base tracking-wide whitespace-nowrap">
              SEIRICON
            </div>
            <div className="text-[9px] text-blue-300 whitespace-nowrap">construyendo en orden</div>
          </div>
        )}
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden p-1 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{userName}</div>
              <div className="text-[10px] text-slate-400 truncate">Directivo</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="flex flex-col gap-1 px-2">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            // "Inicio" cubre todo el portal: el detalle de obra
            // (/directivo/proyecto/[id]) es una bajada desde esa misma lista,
            // no una sección aparte.
            const active =
              item.key === "inicio"
                ? pathname.startsWith("/directivo")
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            // Separador antes del primer item que lo saca del portal: sin él,
            // el menú no avisa de que el shell cambia debajo de los pies.
            const abreSeccionExterna = item.externo && !navItems[i - 1]?.externo;

            return (
              <Fragment key={item.key}>
                {abreSeccionExterna && (
                  <li role="presentation" className="mt-3 pt-3 border-t border-slate-800">
                    {!collapsed && (
                      <span className="px-3 text-[10px] uppercase tracking-wide text-slate-500">
                        Administración
                      </span>
                    )}
                  </li>
                )}
                <li>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
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
              </Fragment>
            );
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-800 p-3 flex flex-col gap-1">
        <NotificacionesDropdown collapsed={collapsed} />
        <form action={logout}>
          <button
            type="submit"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors w-full ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Salir" : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Salir</span>}
          </button>
        </form>
      </div>

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-slate-900 border border-slate-700 rounded-full hidden lg:flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-md z-10"
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col transform transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
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
