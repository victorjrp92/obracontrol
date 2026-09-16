"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import { getPermissions, getRolLabel } from "@/lib/permissions";
import { esCuentaPersonal, modulosVisibles, tonoPerfil } from "@/lib/plan";
import type { TipoCuenta } from "@/generated/prisma";
import {
  LayoutDashboard,
  FolderOpen,
  ClipboardList,
  UsersRound,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Lightbulb,
  Plus,
  HardHat,
  ArrowLeft,
  ClipboardCheck,
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
  clasesCtaBarra,
  clasesHamburguesa,
  clasesItemNav,
  clasesSalir,
} from "@/components/dashboard/chrome";

// Tabla única de items: `sidebarItems` de permissions.ts solo trae CLAVES, y el
// `.map(find).filter(Boolean)` de abajo se come en silencio cualquier clave que
// no exista aquí. Toda clave nueva que declare un rol necesita su fila.
const allNavItems = [
  // Salidas a otros shells: el directivo vuelve a su portal y el personal de
  // campo va al suyo. Viven aquí porque `sidebarItems` de permissions.ts los
  // nombra por clave ("campo") y sin fila desaparecerían sin avisar.
  { key: "portal-directivo", icon: ArrowLeft, label: "Portal directivo", href: "/directivo" },
  { key: "campo", icon: ClipboardCheck, label: "Mis obras", href: "/campo" },
  { key: "dashboard", icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { key: "proyectos", icon: FolderOpen, label: "Proyectos", href: "/dashboard/proyectos" },
  { key: "tareas", icon: ClipboardList, label: "Tareas", href: "/dashboard/tareas" },
  { key: "equipo", icon: HardHat, label: "Mi equipo", href: "/dashboard/equipo" },
  { key: "sugerencias", icon: Lightbulb, label: "Sugerencias", href: "/dashboard/sugerencias" },
  { key: "reportes", icon: BarChart3, label: "Reportes", href: "/dashboard/reportes" },
  { key: "usuarios", icon: UsersRound, label: "Usuarios", href: "/dashboard/usuarios" },
  { key: "configuracion", icon: Settings, label: "Configuración", href: "/dashboard/configuracion" },
];

interface SidebarProps {
  nivelAcceso?: string;
  tipoCuenta?: TipoCuenta;
  userName?: string;
  userRole?: string;
}

export default function Sidebar({ nivelAcceso = "ADMIN_GENERAL", tipoCuenta = "CONSTRUCTORA", userName = "Usuario", userRole }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Cuentas personales (contratista B2C/propietario) usan un menú reducido (modo
  // simple); las empresas conservan el menú por permisos de siempre.
  const personal = esCuentaPersonal(tipoCuenta);
  const itemKeys = personal ? modulosVisibles(tipoCuenta) : getPermissions(nivelAcceso).sidebarItems;

  // El directivo llega a este shell solo de paso (Tareas, Reportes) desde su
  // portal, y nada aquí lo devolvía: entraba y se quedaba. La vuelta va en el
  // Sidebar y no en permissions.ts porque es navegación entre shells, no un
  // permiso — sidebarItems no debe saber dónde vive cada rol.
  const keys = nivelAcceso === "DIRECTIVO" ? ["portal-directivo", ...itemKeys] : itemKeys;

  const resueltos = keys
    .map((key) => allNavItems.find((item) => item.key === key))
    .filter((item): item is (typeof allNavItems)[number] => Boolean(item));
  // Red de seguridad: una clave sin fila en `allNavItems` desaparece sin error
  // de build, así que un rol cuyas claves no casen se queda con el menú EN
  // BLANCO y sin forma de moverse. Antes de eso, al menos el Dashboard.
  const navItems =
    resueltos.length > 0 ? resueltos : allNavItems.filter((item) => item.key === "dashboard");
  const rolLabel = getRolLabel(userRole ?? nivelAcceso);
  const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`flex items-center h-16 border-b ${BARRA_LINEA} flex-shrink-0`}>
        <Link href="/dashboard" className="flex items-center gap-2.5 px-4 flex-1 min-w-0" onClick={() => setMobileOpen(false)}>
          <img src="/seiricon-icon.png" alt="Seiricon" className="w-9 h-9 flex-shrink-0" />
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-extrabold text-white text-base tracking-wide whitespace-nowrap">SEIRICON</div>
              {/* Versalitas espaciadas: es como el sistema pinta esta misma bajada
                  en la maqueta de la app (`.lgo .hd-logo small`). */}
              <div className={`text-[9px] font-semibold uppercase tracking-[0.05em] whitespace-nowrap ${BARRA_TEXTO_TENUE}`}>
                construyendo en orden
              </div>
            </div>
          )}
        </Link>
        {/* Mobile close */}
        <button onClick={() => setMobileOpen(false)} className={`${CLASES_CERRAR_MOVIL} mr-3`} aria-label="Cerrar menú">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User info — clickeable hacia el perfil */}
      {!collapsed && (
        <Link
          href="/dashboard/perfil"
          onClick={() => setMobileOpen(false)}
          className={`block px-4 py-3 border-b ${BARRA_LINEA} hover:bg-white/10 transition-colors motion-reduce:transition-none`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`${CLASES_AVATAR} bg-azul`}>{initials}</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{userName}</div>
              <div className={`text-[10px] font-semibold truncate ${BARRA_TEXTO_APAGADO}`}>{rolLabel}</div>
            </div>
          </div>
        </Link>
      )}

      {/* CTA Nueva obra (solo cuentas personales) */}
      {personal && (
        <div className="px-2 pt-3">
          <Link
            href="/empezar"
            data-tour="nav-nueva-obra"
            onClick={() => setMobileOpen(false)}
            className={clasesCtaBarra(collapsed)}
            title={collapsed ? "Nueva obra" : undefined}
          >
            <Plus className="w-4.5 h-4.5 flex-shrink-0" />
            {!collapsed && <span>Nueva {tonoPerfil(tipoCuenta).obraSingular}</span>}
          </Link>
        </div>
      )}

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
                  data-tour={`nav-${item.key}`}
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
