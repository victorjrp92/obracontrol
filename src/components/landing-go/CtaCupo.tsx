"use client";

import type { ReactNode } from "react";
import { abrirModalCupo, type AudienciaCupo } from "./ModalCupo";

/**
 * Botón CTA de la lista de espera: todos los CTAs de la página abren el
 * <ModalCupo/> con su origen (para segmentar) y la audiencia preseleccionada
 * (el CTA del bloque contratista abre con "contratista"). Es el único trozo
 * cliente que necesitan las secciones estáticas.
 */
export default function CtaCupo({
  origen,
  audiencia = "propietario",
  className = "btn btn-azul",
  style,
  children,
}: {
  origen: string;
  audiencia?: AudienciaCupo;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={(e) => abrirModalCupo({ origen, audiencia, abridor: e.currentTarget })}
    >
      {children}
    </button>
  );
}
