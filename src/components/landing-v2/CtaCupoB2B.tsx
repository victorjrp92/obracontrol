"use client";

import type { ReactNode } from "react";
import { abrirModalCupoB2B } from "./ModalCupoB2B";

/**
 * Botón que abre la lista de espera B2B. Es el único trozo cliente que
 * necesitan las secciones estáticas de la landing: `origen` viaja al registro
 * para saber desde qué CTA levantó la mano cada quien.
 */
export default function CtaCupoB2B({
  origen,
  className = "btn btn-azul",
  style,
  children,
}: {
  origen: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={(e) => abrirModalCupoB2B({ origen, abridor: e.currentTarget })}
    >
      {children}
    </button>
  );
}
