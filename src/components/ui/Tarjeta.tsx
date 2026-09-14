import type { HTMLAttributes, ReactNode } from "react";

/**
 * Tarjeta del sistema Vivo/Aizome — PLANA, con línea fina.
 *
 * No lleva sombra dura y no es un descuido. En una landing hay diez elementos
 * y la sombra de 4px es el sistema; en el dashboard hay cientos de tarjetas,
 * tablas y paneles a la vez, y repetir ahí un borde duro de 4px hace vibrar la
 * pantalla y la vuelve ilegible. La sombra dura se reserva para lo que se
 * pulsa: Boton y Pastilla accionable.
 *
 * La jerarquía entre superficies la da el tono pastel del fondo —el mismo
 * recurso que usa la landing para sus tarjetas ancla—, no la elevación.
 */

export type TonoTarjeta = "blanca" | "papel" | "azul" | "ambar" | "gris";

const TONOS: Record<TonoTarjeta, string> = {
  blanca: "vv-tarjeta--blanca",
  papel: "vv-tarjeta--papel",
  azul: "vv-tarjeta--azul",
  ambar: "vv-tarjeta--ambar",
  gris: "vv-tarjeta--gris",
};

interface TarjetaProps extends HTMLAttributes<HTMLDivElement> {
  tono?: TonoTarjeta;
  /**
   * La tarjeta entera responde al puntero (es un enlace o abre algo). Marca el
   * borde y expone el foco de teclado; sigue sin ganar sombra.
   * Si se activa, el elemento necesita ser realmente enfocable: envuélvela en
   * un <Link> o pásale role/tabIndex.
   */
  pulsable?: boolean;
  children: ReactNode;
}

export default function Tarjeta({
  tono = "blanca",
  pulsable = false,
  className,
  children,
  ...resto
}: TarjetaProps) {
  const clases = [
    "vv-tarjeta",
    TONOS[tono],
    pulsable ? "vv-tarjeta--pulsable" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={clases} {...resto}>
      {children}
    </div>
  );
}
