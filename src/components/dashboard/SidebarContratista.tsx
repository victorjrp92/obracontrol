"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import {
  LayoutDashboard,
  History,
  PlusCircle,
  Users,
  BarChart3,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import NotificacionesDropdown from "@/components/dashboard/NotificacionesDropdown";
import {
  BARRA_FONDO,
  BARRA_LINEA,
  BARRA_TEXTO_APAGADO,
  BARRA_TEXTO_TENUE,
  CLASES_AVATAR,
  CLASES_CERRAR_MOVIL,
  CLASES_TOGGLE_COLAPSO,
  CLASES_VELO_MOVIL,
  clasesHamburguesa,
  clasesItemNav,
  clasesSalir,
} from "@/components/dashboard/chrome";

const navItems = [
  { icon: LayoutDashboard, label: "Inicio", href: "/contratista" },
  { icon: CheckSquare, label: "Reportar tareas", href: "/contratista/reportar" },
  { icon: History, label: "Historial", href: "/contratista/historial" },
  { icon: PlusCircle, label: "Sugerir tarea", href: "/contratista/sugerir" },
  // Solo cambia la etiqueta: la ruta /contratista/obreros es infraestructura.
  { icon: Users, label: "Mis maestros", href: "/contratista/obreros" },
  { icon: BarChart3, label: "Reportes", href: "/contratista/reportes" },
];

interface SidebarContratistaProps {
  userName?: string;
  userRole?: string;
}

export default function SidebarContratista({
  userName = "Contratista",
  userRole = "Contratista",
}: SidebarContratistaProps) {
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
      <div className={`flex items-center gap-2.5 px-4 h-16 border-b ${BARRA_LINEA} flex-shrink-0`}>
        <img src="/seiricon-icon.png" alt="Seiricon" className="w-9 h-9 flex-shrink-0" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-extrabold text-white text-base tracking-wide whitespace-nowrap">
              SEIRICON
            </div>
            <div className={`text-[9px] font-semibold uppercase tracking-[0.05em] whitespace-nowrap ${BARRA_TEXTO_TENUE}`}>
              construyendo en orden
            </div>
          </div>
        )}
        {/* Mobile close */}
        <button onClick={() => setMobileOpen(false)} className={`ml-auto ${CLASES_CERRAR_MOVIL}`} aria-label="Cerrar menú">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User info */}
      {!collapsed && (
        <div className={`px-4 py-3 border-b ${BARRA_LINEA}`}>
          <div className="flex items-center gap-2.5">
            <div className={`${CLASES_AVATAR} bg-azul`}>{initials}</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{userName}</div>
              <div className={`text-[10px] font-semibold truncate ${BARRA_TEXTO_APAGADO}`}>{userRole}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/contratista" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={clasesItemNav(active, collapsed)}
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
      <div className={`border-t ${BARRA_LINEA} p-3 flex flex-col gap-1`}>
        <NotificacionesDropdown collapsed={collapsed} />
        <form action={logout}>
          <button type="submit" className={clasesSalir(collapsed)} title={collapsed ? "Salir" : undefined}>
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Salir</span>}
          </button>
        </form>
      </div>

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={CLASES_TOGGLE_COLAPSO}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button onClick={() => setMobileOpen(true)} className={clasesHamburguesa(mobileOpen)} aria-label="Abrir menú">
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div className={CLASES_VELO_MOVIL} onClick={() => setMobileOpen(false)} />}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 ${BARRA_FONDO} flex flex-col transform transition-transform duration-300 motion-reduce:transition-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`relative hidden lg:flex flex-col ${BARRA_FONDO} border-r-[1.5px] border-tinta transition-all duration-300 motion-reduce:transition-none h-full ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
