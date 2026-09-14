import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Botón del sistema Vivo/Aizome.
 *
 * El gesto —borde de tinta 2.5px, sombra dura 4px que sube a 6px al pasar por
 * encima y cae a 1px al pulsar, hundiendo el botón— vive en vivo.css, que se
 * importa desde globals.css. Aquí sólo se compone el nombre de clase.
 */

export type VarianteBoton = "principal" | "secundario" | "peligro" | "fantasma";
export type TamanoBoton = "chico" | "medio" | "grande";

const VARIANTES: Record<VarianteBoton, string> = {
  principal: "vv-boton--principal",
  secundario: "vv-boton--secundario",
  // Sólo para acciones destructivas: el rojo ya significa RECHAZADO en este
  // producto y usarlo de acento rompería ese código.
  peligro: "vv-boton--peligro",
  fantasma: "vv-boton--fantasma",
};

const TAMANOS: Record<TamanoBoton, string> = {
  chico: "vv-boton--chico",
  medio: "vv-boton--medio",
  grande: "vv-boton--grande",
};

/**
 * Receta de clases del botón, expuesta aparte para que un `<a>` o un `<Link>`
 * que hace de botón use exactamente el mismo gesto sin duplicar CSS.
 */
export function clasesBoton(
  variante: VarianteBoton = "principal",
  tamano: TamanoBoton = "medio",
  extra?: string
): string {
  return [
    "vv-boton",
    TAMANOS[tamano],
    VARIANTES[variante],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  /** Ocupa todo el ancho disponible (CTA de móvil, pie de modal). */
  ancho?: boolean;
  children: ReactNode;
}

export default function Boton({
  variante = "principal",
  tamano = "medio",
  ancho = false,
  className,
  // Por defecto "button": dentro de un <form>, un <button> sin type envía el
  // formulario, que es la causa habitual de recargas accidentales.
  type = "button",
  children,
  ...resto
}: BotonProps) {
  const extra = [ancho ? "vv-boton--ancho" : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={clasesBoton(variante, tamano, extra)} {...resto}>
      {children}
    </button>
  );
}
