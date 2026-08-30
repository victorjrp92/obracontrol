import type { TipoProductoTecnico } from "@/generated/prisma";
import { FIRMAS, FORMATOS_POR_TIPO } from "@/lib/productos-tecnicos";

/**
 * Qué formatos ofrece el `<input type="file">` según el tipo de producto.
 * Sale entera de `FORMATOS_POR_TIPO` — el mismo mapa que usa el servidor para
 * rechazar por magic number — para que el input nunca ofrezca algo que el
 * servidor va a rechazar, ni le falte algo que sí aceptaría.
 */

/** Extensiones (con punto), en el mismo orden que las declara el dominio. */
export function extensionesAceptadas(tipo: TipoProductoTecnico): string[] {
  return FORMATOS_POR_TIPO[tipo].map((formato) => {
    const firma = FIRMAS.find((f) => f.formato === formato);
    return `.${firma ? firma.extensiones[0] : formato}`;
  });
}

/** El atributo `accept` del input: extensiones + MIME, todo lo que entiende el navegador. */
export function acceptDeTipo(tipo: TipoProductoTecnico): string {
  const mimes = FORMATOS_POR_TIPO[tipo]
    .map((formato) => FIRMAS.find((f) => f.formato === formato)?.mime)
    .filter((m): m is string => !!m);
  return [...extensionesAceptadas(tipo), ...mimes].join(",");
}

/** Etiqueta legible ("PDF, PNG, JPEG, WEBP") para ayuda del formulario y estados vacíos. */
export function etiquetaFormatos(tipo: TipoProductoTecnico): string {
  return FORMATOS_POR_TIPO[tipo]
    .map((formato) => FIRMAS.find((f) => f.formato === formato)?.etiqueta ?? formato.toUpperCase())
    .join(", ");
}
