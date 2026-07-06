import type { LucideIcon } from "lucide-react";
import { ImageIcon } from "lucide-react";

/**
 * Hueco de foto con respaldo elegante.
 *
 * Mientras no haya foto real, renderiza un placeholder cálido e intencional
 * (gradiente + icono + la guía de qué foto va ahí). Cuando tengas las fotos,
 * déjalas en `public/b2c/` y pasa `src` (p. ej. src="/b2c/hero-familia.jpg").
 *
 * Dirección de arte (humano, no corporativo de stock frío):
 *  - Personas reales en SU casa/obra, luz natural, tonos cálidos.
 *  - Manos sosteniendo un celular con la app; familias mirando su avance.
 *  - Evitar cascos azules genéricos y oficinas: esto es B2C, es personal.
 */
export default function PhotoSlot({
  src,
  alt = "",
  label,
  icon: Icon = ImageIcon,
  className = "",
  rounded = "rounded-3xl",
}: {
  src?: string;
  alt?: string;
  label: string;
  icon?: LucideIcon;
  className?: string;
  rounded?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover ${rounded} ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden border border-white/70 bg-gradient-to-br from-amber-100 via-orange-50 to-blue-100 px-5 text-center ${rounded} ${className}`}
    >
      <div className="absolute inset-0 dot-pattern opacity-[0.18]" />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 shadow-sm backdrop-blur">
        <Icon className="h-7 w-7 text-orange-500" />
      </div>
      <span className="relative max-w-[16rem] text-xs font-medium leading-snug text-slate-500">
        {label}
      </span>
    </div>
  );
}
