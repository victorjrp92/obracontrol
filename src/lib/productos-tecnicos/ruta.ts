import type { TipoProductoTecnico } from "@/generated/prisma";

/**
 * Dónde vive el archivo dentro del bucket.
 *
 * Comparte bucket con las evidencias (`evidencias`) bajo su propio prefijo,
 * igual que hacen las facturas en `src/lib/storage.ts`. La obra va primero en
 * la ruta porque es el eje por el que se aísla, se cuenta el cupo y se borra
 * en cascada: con `productos-tecnicos/<obra>/` delante, cualquier operación
 * masiva sobre una obra es un prefijo, no un scan.
 *
 * El nombre original del usuario NO entra en la ruta. Puede traer acentos,
 * barras, espacios o `../`; nada de eso aporta —el nombre legible se guarda en
 * la columna `nombre`— y sí abre la puerta a escribir fuera del prefijo.
 */
export const PREFIJO_STORAGE = "productos-tecnicos";

export function rutaProductoTecnico(datos: {
  proyectoId: string;
  tipo: TipoProductoTecnico;
  /** Extensión canónica del formato REAL, no la que mandó el cliente. */
  extension: string;
  /** Discriminante único del archivo (timestamp + azar). */
  sufijoUnico: string;
}): string {
  const obra = segmentoSeguro(datos.proyectoId);
  const sufijo = segmentoSeguro(datos.sufijoUnico);
  const ext = segmentoSeguro(datos.extension) || "bin";
  return `${PREFIJO_STORAGE}/${obra}/${datos.tipo}/${sufijo}.${ext}`;
}

/** Solo lo que no puede escaparse de su carpeta. */
function segmentoSeguro(valor: string): string {
  return valor.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

/**
 * ¿Este `storage_path` es de un producto técnico de esta obra?
 *
 * La comprobación existe para la ruta de descarga: el path sale de la base,
 * pero firmarlo sin mirar convertiría cualquier fila corrupta en una URL a un
 * objeto arbitrario del bucket —incluidas las evidencias de otro tenant.
 */
export function rutaPerteneceAObra(storagePath: string, proyectoId: string): boolean {
  return storagePath.startsWith(`${PREFIJO_STORAGE}/${segmentoSeguro(proyectoId)}/`);
}
