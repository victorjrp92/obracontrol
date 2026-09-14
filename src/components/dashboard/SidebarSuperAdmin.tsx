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
import {
  BARRA_FONDO,
  BARRA_LINEA,
  CLASES_AVATAR,
  CLASES_CERRAR_MOVIL,
  CLASES_TOGGLE_COLAPSO,
  CLASES_VELO_MOVIL,
  clasesHamburguesa,
  clasesItemNav,
  clasesSalir,
} from "@/components/dashboard/chrome";

const navItems = [
  { key: "sa-dashboard", icon: LayoutDashboard, label: "Vista global", href: "/super-admin" },
  { key: "sa-constructoras", icon: Building2, label: "Constructoras", href: "/super-admin/constructoras" },
  { key: "sa-proyectos", icon: FolderOpen, label: "Proyectos", href: "/super-admin/proyectos" },
  { key: "sa-admins", icon: UsersRound, label: "Admin Generales", href: "/super-admin/admins-generales" },
  { key: "sa-contratistas", icon: Briefcase, label: "Contratistas", href: "/super-admin/contratistas" },
  // Solo cambia la etiqueta: `key` es el identificador estable del item y `href`
  // la ruta real. OJO: esta barra no pinta `data-tour`, así que hoy ningún paso
  // del tour apunta a estas claves (los targets de tours.ts son `nav-*` y sólo
  // existen en Sidebar.tsx).
  { key: "sa-obreros", icon: HardHat, label: "Maestros", href: "/super-admin/obreros" },
  { key: "sa-roles", icon: KeyRound, label: "Roles del sistema", href: "/super-admin/roles" },
  { key: "sa-reportes", icon: BarChart3, label: "Reportes globales", href: "/super-admin/reportes" },
  { key: "sa-pwa", icon: Smartphone, label: "Instalaciones PWA", href: "/super-admin/pwa-metricas" },
  { key: "sa-configuracion", icon: Settings, label: "Configuración", href: "/super-admin/configuracion" },
];

interface Props {
  userName?: string;
}

/**
 * El rojo de esta barra no es decoración ni se cambia a índigo: marca la consola
 * del dueño del sistema y ya estaba aquí. Es además el rojo del sistema
 * (--rojo, #dc2626). Sobre el navy de la barra ese rojo como TEXTO no llega a AA (3.70:1), así
 * que los textos rojos usan #fca5a5 — el mismo que Aizome pone sobre navy en
 * `.lgo .alarma svg`— y el relleno del item activo conserva --rojo con texto
 * blanco encima (4.83:1).
 */
export default function SidebarSuperAdmin({ userName = "Super Admin" }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const sidebarContent = (
    <>
      <div className={`flex items-center h-16 border-b ${BARRA_LINEA} flex-shrink-0`}>
        <Link
          href="/super-admin"
          className="flex items-center gap-2.5 px-4 flex-1 min-w-0"
          onClick={() => setMobileOpen(false)}
        >
          <div className="w-9 h-9 rounded-xl bg-[var(--rojo)] border-2 border-white flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-extrabold text-white text-base tracking-wide whitespace-nowrap">SEIRICON</div>
              <div className="text-[9px] text-[#fca5a5] whitespace-nowrap font-extrabold uppercase tracking-[0.05em]">
                SUPER ADMIN
              </div>
            </div>
          )}
        </Link>
        <button onClick={() => setMobileOpen(false)} className={`${CLASES_CERRAR_MOVIL} mr-3`} aria-label="Cerrar menú">
          <X className="w-5 h-5" />
        </button>
      </div>

      {!collapsed && (
        <div className={`px-4 py-3 border-b ${BARRA_LINEA}`}>
          <div className="flex items-center gap-2.5">
            <div className={`${CLASES_AVATAR} bg-[var(--rojo)]`}>{initials}</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{userName}</div>
              <div className="text-[10px] text-[#fca5a5] truncate font-extrabold">Dueño del sistema</div>
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
                  className={clasesItemNav(active, collapsed, "rojo")}
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

      <div className={`border-t ${BARRA_LINEA} p-3 flex flex-col gap-1`}>
        <NotificacionesDropdown collapsed={collapsed} />
        <form action={logout}>
          <button type="submit" className={clasesSalir(collapsed)} title={collapsed ? "Salir" : undefined}>
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Salir</span>}
          </button>
        </form>
      </div>

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
      <button onClick={() => setMobileOpen(true)} className={clasesHamburguesa(mobileOpen)} aria-label="Abrir menú">
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && <div className={CLASES_VELO_MOVIL} onClick={() => setMobileOpen(false)} />}

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 ${BARRA_FONDO} flex flex-col transform transition-transform duration-300 motion-reduce:transition-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

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
