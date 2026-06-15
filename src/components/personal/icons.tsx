"use client";

import { createElement } from "react";
import {
  Home,
  Building2,
  Building,
  Store,
  ChefHat,
  Bath,
  BedDouble,
  Sofa,
  Utensils,
  WashingMachine,
  Car,
  BookOpen,
  Trees,
  DoorOpen,
  LayoutGrid,
  Wrench,
  Ruler,
  Sparkles,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { TipoObra, TipoPropiedad } from "@/lib/plantillas-personal";

/**
 * Set de íconos propios para el wizard B2C. NO emojis.
 *
 * Cada ícono es un Lucide de línea (trazo consistente 1.5px, color de marca)
 * dentro de un contenedor cuadrado redondeado (`rounded-2xl`, fondo azul suave)
 * para que todo el wizard se vea cohesivo y "propio".
 */

type Size = "sm" | "md" | "lg";

const BOX: Record<Size, string> = {
  sm: "w-9 h-9 rounded-xl",
  md: "w-11 h-11 rounded-2xl",
  lg: "w-14 h-14 rounded-2xl",
};

const GLYPH: Record<Size, number> = { sm: 18, md: 22, lg: 26 };

/** Contenedor de marca para un ícono. Activo = azul lleno; inactivo = azul suave. */
export function IconBox({
  Icon,
  size = "md",
  active = false,
}: {
  Icon: LucideIcon;
  size?: Size;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 transition-colors ${BOX[size]} ${
        active ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
      }`}
    >
      <Icon size={GLYPH[size]} strokeWidth={1.5} />
    </span>
  );
}

// ─── Tipos de obra (paso 1) ──────────────────────────────────────────────────
export const ICONO_TIPO_OBRA: Record<TipoObra, LucideIcon> = {
  REFORMA: Wrench,
  MODIFICACION: Ruler,
  OBRA_NUEVA: Sparkles,
};

// ─── Tipos de propiedad (paso 2) ─────────────────────────────────────────────
export const ICONO_PROPIEDAD: Record<TipoPropiedad, LucideIcon> = {
  CASA: Home,
  APARTAMENTO: Building2,
  EDIFICIO: Building,
  LOCAL: Store,
};

// ─── Espacios ────────────────────────────────────────────────────────────────
// Mapea por `key` de ESPACIOS_PERSONAL y por palabras del nombre (para los
// espacios generados/renombrados tipo "Habitación 2", "Baño principal").
const ICONO_POR_KEY: Record<string, LucideIcon> = {
  cocina: ChefHat,
  bano: Bath,
  sala: Sofa,
  comedor: Utensils,
  habitacion: BedDouble,
  estudio: BookOpen,
  lavanderia: WashingMachine,
  balcon: Trees,
  garaje: Car,
  fachada: LayoutGrid,
  pasillo: DoorOpen,
  otro: MoreHorizontal,
};

/**
 * Renderiza el glifo de un espacio a partir de su nombre/key. Es un componente
 * de módulo (no se crea en render) para cumplir `react-hooks/static-components`.
 */
export function EspacioGlyph({
  nombre,
  size = 16,
  strokeWidth = 1.75,
}: {
  nombre: string;
  size?: number;
  strokeWidth?: number;
}) {
  // `createElement` evita el patrón `const Icon = ...; <Icon/>` que dispara la
  // regla react-hooks/static-components (el ícono se resuelve dinámicamente).
  return createElement(iconoEspacio(nombre), { size, strokeWidth });
}

/** Devuelve el ícono para un espacio a partir de su key o de su nombre libre. */
export function iconoEspacio(keyOrNombre: string): LucideIcon {
  const directo = ICONO_POR_KEY[keyOrNombre];
  if (directo) return directo;

  const n = keyOrNombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (n.includes("cocina")) return ChefHat;
  if (n.includes("bano")) return Bath;
  if (n.includes("habitacion") || n.includes("cuarto") || n.includes("alcoba") || n.includes("dormitorio"))
    return BedDouble;
  if (n.includes("sala")) return Sofa;
  if (n.includes("comedor")) return Utensils;
  if (n.includes("estudio")) return BookOpen;
  if (n.includes("lavado") || n.includes("lavander")) return WashingMachine;
  if (n.includes("balcon") || n.includes("terraza") || n.includes("jardin")) return Trees;
  if (n.includes("garaje") || n.includes("parqueadero")) return Car;
  if (n.includes("fachada")) return LayoutGrid;
  if (n.includes("pasillo")) return DoorOpen;
  return MoreHorizontal;
}
