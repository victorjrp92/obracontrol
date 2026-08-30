/**
 * Productos técnicos — planos, renders y registro fotográfico inicial de una
 * obra. Es el entregable del perfil ARQUITECTO y un módulo más para las
 * cuentas CONSTRUCTORA.
 *
 * La API pública del módulo. Lo que NO sale por aquí es intencional:
 *
 *   - `contexto.ts` y `respuesta.ts` arrastran `next/headers` y `next/server`.
 *     Los importan las rutas directamente; si salieran por el índice, el
 *     script de verificación no podría importar el dominio en Node pelado.
 *   - `almacenamiento.ts` habla con Supabase Storage. Mismo motivo.
 *   - `puertos-prisma.ts` y `consultas.ts` importan `@/lib/prisma`, que
 *     INSTANCIA el cliente en el propio módulo (`src/lib/prisma.ts:19`). Un
 *     barril con un módulo así dentro no se puede podar: cualquier componente
 *     `"use client"` que importe UNA constante de aquí se arrastra Prisma y
 *     `pg` al bundle del navegador. Ya pasaba con cuatro:
 *     `SubidaProductoDialog.tsx`, `logica/vista-cupo.ts`,
 *     `logica/vista-formatos.ts` y `logica/vista-planos.ts`.
 *     Quien necesite consultar la base importa el fichero directamente
 *     (`@/lib/productos-tecnicos/consultas`, `.../puertos-prisma`), que es lo
 *     que ya hacían todas las rutas de `src/app/api/productos-tecnicos/**`.
 */
export { assertPerfilConAcceso, perfilPuedeProductosTecnicos } from "./acceso";
export {
  bytesOcupados,
  estadoCupo,
  formatearBytes,
  verificarCupo,
  verificarTamanoArchivo,
  CUPO_BYTES_POR_OBRA,
  MAX_BYTES_POR_ARCHIVO,
} from "./cupo";
export { fallar, ProductoTecnicoError, type CodigoProductoTecnico } from "./errores";
export {
  detectarFormato,
  extensionCanonica,
  extensionDe,
  validarArchivo,
  BYTES_CABECERA,
  FIRMAS,
  FORMATOS_POR_TIPO,
  type FirmaArchivo,
  type Formato,
} from "./formatos";
export { rutaProductoTecnico, rutaPerteneceAObra, PREFIJO_STORAGE } from "./ruta";
export { prepararSubida } from "./subida";
export { nivelDeUbicacion, normalizarUbicacion, validarUbicacion } from "./ubicacion";
export {
  cadenaDeVersiones,
  planificarCambioDeVigente,
  planificarNuevaVersion,
  vigenteDeLaCadena,
} from "./versionado";
export type {
  ArchivoEntrante,
  EntradaSubida,
  EstadoCupo,
  NivelUbicacion,
  PlanSubida,
  PlanVersion,
  ProductoConPeso,
  ProductoVersionado,
  PuertosSubida,
  Ubicacion,
} from "./tipos";
