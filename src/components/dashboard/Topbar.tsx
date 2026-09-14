"use client";

import { Search } from "lucide-react";
import OfflineQueueBadge from "@/components/pwa/OfflineQueueBadge";
import NotificacionesBellTopbar from "@/components/dashboard/NotificacionesBellTopbar";
import InstallBannerTopbar from "@/components/pwa/InstallBannerTopbar";

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

/**
 * Barra superior del dashboard, en Vivo/Aizome.
 *
 * Se queda BLANCA sobre el papel del contenido, no al revés. Es lo que hace el
 * propio sistema cuando dibuja esta app —`.lgo .hd-top` en landing-go.css es
 * `background:#fff` con `border-bottom: 1px solid var(--linea)` sobre un cuerpo
 * de `--gris-50`—, y es el mismo patrón figura/fondo de la landing de Juntos,
 * donde los paneles son blancos sobre papel. Una barra de papel sobre contenido
 * de papel no tendría borde que la separase salvo la línea.
 *
 * La línea sube de 1 a 1.5px: es el grosor de línea fina del sistema (`.jt-nav`,
 * `.doc-fila`, `.vv-tarjeta`) y el que aguanta el borde entre dos superficies
 * casi idénticas.
 */
export default function Topbar({ title = "Dashboard", subtitle }: TopbarProps) {
  return (
    <>
    <InstallBannerTopbar />
    <header className="h-14 sm:h-16 flex items-center justify-between gap-4 px-4 sm:px-6 border-b-[1.5px] border-linea bg-white flex-shrink-0">
      {/* Título — en móvil se aparta de la hamburguesa, que ahora mide 44px
          (12px de margen + 44 = 56; 60 deja 4px de aire). */}
      <div className="pl-[60px] lg:pl-0 min-w-0">
        <h1 className="text-sm sm:text-base font-extrabold tracking-[-0.02em] text-tinta truncate">{title}</h1>
        {subtitle && <p className="text-[10px] sm:text-xs font-medium text-gris truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Evidencias pendientes de sincronizar */}
        <OfflineQueueBadge />

        {/* Search — el campo del sistema: radio 12px, línea de 1.5px y, al
            enfocar, borde índigo con halo del 16% (`.ljt .campo input`). */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gris" />
          <input
            type="search"
            placeholder="Buscar proyecto, tarea..."
            className="pl-9 pr-4 h-10 rounded-xl border-[1.5px] border-gris-bde text-sm bg-white w-60 text-tinta font-medium placeholder:text-gris placeholder:font-normal focus:outline-none focus:border-azul focus:shadow-[0_0_0_3px_rgba(37,99,235,0.16)]"
          />
        </div>

        {/* Notificaciones (solo no leídas — historial está en sidebar) */}
        <NotificacionesBellTopbar />
      </div>
    </header>
    </>
  );
}
