"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, LogOut, Menu, User, X } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import NotificacionesDropdown from "@/components/dashboard/NotificacionesDropdown";

/**
 * Menú del personal de campo. DOS destinos y nada más.
 *
 * No reutiliza `Sidebar.tsx` a propósito: ese arma su lista con
 * `getPermissions(nivel).sidebarItems` sobre un catálogo de doce entradas de
 * administración, y basta con que alguien añada una clave suelta para que a
 * este rol le aparezca una pantalla que no le toca. Aquí la lista está escrita
 * a mano y no crece sola.
 *
 * Tampoco se colapsa: con dos ítems el botón de colapsar ahorraría 176px de
 * un menú que ya cabe, a cambio de un estado más que mantener. En móvil —que
 * es donde se usa esto, con guantes y a pleno sol— sigue siendo el mismo cajón
 * lateral que el del contratista.
 */
const navItems = [
  { icon: ClipboardCheck, label: "Mis obras", href: "/campo" },
  { icon: User, label: "Mis datos", href: "/campo/perfil" },
];

interface SidebarCampoProps {
  userName?: string;
  userRole?: string;
}

export default function SidebarCampo({
  userName = "Personal de campo",
  userRole = "Personal de campo",
}: SidebarCampoProps) {
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
        {/* `next/image` y no `<img>`: los sidebars viejos arrastran el warning
            de `@next/next/no-img-element` y no hay razón para sumar uno más. */}
        <Image
          src="/seiricon-icon.png"
          alt="Seiricon"
          width={36}
          height={36}
          className="w-9 h-9 flex-shrink-0"
        />
        <div className="leading-tight">
          <div className="font-extrabold text-white text-base tracking-wide whitespace-nowrap">
            SEIRICON
          </div>
          <div className="text-[9px] text-blue-300 whitespace-nowrap">construyendo en orden</div>
        </div>
        {/* Cierre en móvil */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden p-1 text-slate-400 hover:text-white"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quién soy */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{userName}</div>
            <div className="text-[10px] text-slate-400 truncate">{userRole}</div>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            // "/campo" es prefijo de todo lo demás: sin la igualdad exacta,
            // «Mis obras» se quedaría activo también dentro de «Mis datos».
            const active =
              pathname === item.href ||
              (item.href !== "/campo" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Pie */}
      <div className="border-t border-slate-800 p-3 flex flex-col gap-1">
        <NotificacionesDropdown collapsed={false} />
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors w-full"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Salir</span>
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Hamburguesa (móvil) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Fondo oscuro (móvil) */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Cajón lateral (móvil) */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col transform transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Menú fijo (escritorio) */}
      <aside className="relative hidden lg:flex flex-col bg-slate-900 border-r border-slate-800 h-full w-60">
        {sidebarContent}
      </aside>
    </>
  );
}
