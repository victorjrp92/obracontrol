import type { HTMLAttributes, ReactNode } from "react";

/**
 * Pastilla / chip del sistema Vivo/Aizome.
 *
 * `accionable` no es un detalle estético: decide si lleva sombra dura. Una
 * pastilla que sólo informa (un estado, una etiqueta) va plana con borde fino;
 * si llevara sombra prometería una interacción que no existe. Una que se pulsa
 * (un filtro, un «quitar») lleva borde de tinta y sombra dura, y se hunde igual
 * que el botón.
 *
 * Los tonos verde, rojo y ámbar están aquí porque en este producto ya son
 * código de color aprendido —APROBADO, RECHAZADO, ESPERANDO—, no paleta libre.
 */

export type TonoPastilla = "neutro" | "azul" | "ambar" | "verde" | "rojo";

const TONOS: Record<TonoPastilla, string> = {
  neutro: "vv-pastilla--neutro",
  azul: "vv-pastilla--azul",
  ambar: "vv-pastilla--ambar",
  verde: "vv-pastilla--verde",
  rojo: "vv-pastilla--rojo",
};

interface PastillaProps extends HTMLAttributes<HTMLElement> {
  tono?: TonoPastilla;
  /** true sólo si al pulsarla pasa algo. Entonces gana la sombra dura. */
  accionable?: boolean;
  /** Sólo tiene efecto cuando es accionable (se renderiza como <button>). */
  disabled?: boolean;
  children: ReactNode;
}

export default function Pastilla({
  tono = "neutro",
  accionable = false,
  disabled = false,
  className,
  children,
  ...resto
}: PastillaProps) {
  const clases = [
    "vv-pastilla",
    TONOS[tono],
    accionable ? "vv-pastilla--accionable" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (accionable) {
    return (
      <button type="button" className={clases} disabled={disabled} {...resto}>
        {children}
      </button>
    );
  }

  return (
    <span className={clases} {...resto}>
      {children}
    </span>
  );
}
