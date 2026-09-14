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
import {
  BARRA_FONDO,
  BARRA_LINEA,
  BARRA_TEXTO_APAGADO,
  BARRA_TEXTO_TENUE,
  CLASES_AVATAR,
  CLASES_CERRAR_MOVIL,
  CLASES_ROTULO_SECCION,
  CLASES_TOGGLE_COLAPSO,
  CLASES_VELO_MOVIL,
  clasesHamburguesa,
  clasesItemNav,
  clasesSalir,
} from "@/components/dashboard/chrome";

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
              <div className={`text-[10px] font-semibold truncate ${BARRA_TEXTO_APAGADO}`}>Directivo</div>
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
                  <li role="presentation" className={`mt-3 pt-3 border-t ${BARRA_LINEA}`}>
                    {!collapsed && <span className={CLASES_ROTULO_SECCION}>Administración</span>}
                  </li>
                )}
                <li>
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
              </Fragment>
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
