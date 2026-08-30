/**
 * El único error que sale de la capa de dominio de productos técnicos.
 *
 * Lleva el `status` HTTP puesto para que las rutas no tengan que traducir
 * nada: el dominio decide si un archivo falsificado es un 415 o un 400, y la
 * ruta se limita a devolverlo. El `codigo` es estable y va en el JSON — la UI
 * puede reaccionar a `CUPO_EXCEDIDO` sin leer el texto en español.
 *
 * NO extiende `TenantError` a propósito: `src/lib/tenant.ts` arrastra
 * `next/headers` vía el cliente de Supabase, y este módulo tiene que poder
 * importarse desde un script de verificación que corre en Node pelado.
 */
export type CodigoProductoTecnico =
  | "PERFIL_SIN_ACCESO"       // el tipo de cuenta no tiene la capacidad
  | "ENTRADA_INVALIDA"        // faltan campos o vienen mal formados
  | "UBICACION_INVALIDA"      // sin obra, o piso y unidad a la vez
  | "UBICACION_AJENA"         // el piso/unidad no cuelga de esa obra
  | "OBRA_SIN_ACCESO"         // la obra es del tenant, pero no de este usuario
  | "FORMATO_NO_RECONOCIDO"   // los primeros bytes no son de ningún formato conocido
  | "FORMATO_NO_PERMITIDO"    // formato real válido, pero no para ese tipo de producto
  | "EXTENSION_ENGANOSA"      // el contenido no es lo que dice la extensión
  | "MIME_ENGANOSO"           // el contenido no es lo que dice el Content-Type
  | "ARCHIVO_DEMASIADO_GRANDE"
  | "CUPO_EXCEDIDO"
  | "VERSION_INVALIDA"
  | "NO_ENCONTRADO";

export class ProductoTecnicoError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: CodigoProductoTecnico,
    message: string,
  ) {
    super(message);
    this.name = "ProductoTecnicoError";
  }
}

/** Azúcar para lanzar sin repetir el `new` en cada guarda. */
export function fallar(
  status: number,
  codigo: CodigoProductoTecnico,
  mensaje: string,
): never {
  throw new ProductoTecnicoError(status, codigo, mensaje);
}
