import type { TipoProductoTecnico } from "@/generated/prisma";

/**
 * Contratos del módulo de productos técnicos: planos, renders y registro
 * fotográfico inicial de una obra.
 *
 * Tres decisiones viven en estos tipos y no se pueden esquivar desde fuera:
 *
 * 1. `Ubicacion` SIEMPRE trae `proyectoId`. Un plano suelto, sin obra, no
 *    existe: no habría contra qué cobrarle el cupo ni a quién aislarlo.
 * 2. El archivo llega con su `cabecera` — los primeros bytes reales. El
 *    dominio nunca ve el `File` completo, y por lo tanto nunca puede caer en
 *    la tentación de creerle al `Content-Type` del cliente.
 * 3. `PlanSubida` devuelve el `mime` CANÓNICO (el que se deduce del
 *    contenido), no el declarado. Lo que se guarda en la base es lo que el
 *    archivo es, no lo que dijo ser.
 */

/** Dónde cuelga un producto técnico. La obra es obligatoria; el resto no. */
export interface Ubicacion {
  proyectoId: string;
  /** Plano de un piso completo. Excluyente con `unidadId`. */
  pisoId?: string | null;
  /** Plano de una unidad concreta. Excluyente con `pisoId`. */
  unidadId?: string | null;
}

/** A qué altura de la jerarquía quedó atado el archivo. */
export type NivelUbicacion = "OBRA" | "PISO" | "UNIDAD";

/** Lo que el dominio necesita saber del archivo, y nada más. */
export interface ArchivoEntrante {
  /** Nombre original, tal cual lo mandó el cliente. Solo se usa su extensión. */
  nombre: string;
  /** `Content-Type` declarado. Se contrasta contra el contenido; no se cree. */
  mimeDeclarado?: string | null;
  /** Tamaño en bytes. */
  bytes: number;
  /** Primeros bytes del archivo (ver `BYTES_CABECERA` en `formatos.ts`). */
  cabecera: Uint8Array;
}

/** Todo lo que hace falta para decidir si una subida se acepta. */
export interface EntradaSubida {
  ubicacion: Ubicacion;
  tipo: TipoProductoTecnico;
  nombre: string;
  descripcion?: string | null;
  archivo: ArchivoEntrante;
  /** Id de la versión vigente que este archivo reemplaza, si es un reemplazo. */
  reemplazaA?: string | null;
}

/** La cara de un producto que le importa al versionado. */
export interface ProductoVersionado {
  id: string;
  proyecto_id: string;
  tipo: TipoProductoTecnico;
  version: number;
  vigente: boolean;
  reemplaza_a: string | null;
}

/** La cara de un producto que le importa al cupo. */
export interface ProductoConPeso {
  bytes: number;
  /**
   * Se declara a propósito aunque el cálculo del cupo lo ignore: quien lea
   * `bytesOcupados()` tiene que ver que el campo estaba ahí y que NO se filtró.
   */
  vigente: boolean;
}

/** Foto del cupo de una obra en un instante. */
export interface EstadoCupo {
  limiteBytes: number;
  usadoBytes: number;
  restanteBytes: number;
  /** 0–100, redondeado a entero. Para pintar una barra sin recalcular. */
  porcentaje: number;
}

/** Lo que decide el versionado antes de escribir nada. */
export interface PlanVersion {
  version: number;
  reemplazaA: string | null;
  /** Ids que deben quedar en `vigente: false` en la misma transacción. */
  aDesactivar: string[];
}

/** El veredicto completo de una subida aceptada. */
export interface PlanSubida {
  tipo: TipoProductoTecnico;
  nombre: string;
  descripcion: string | null;
  ubicacion: Ubicacion;
  nivel: NivelUbicacion;
  /** MIME deducido del contenido. Es el que se guarda. */
  mime: string;
  bytes: number;
  version: number;
  reemplazaA: string | null;
  aDesactivar: string[];
  /** Extensión canónica del formato real, para construir la ruta de storage. */
  extension: string;
  /** Cómo queda el cupo de la obra DESPUÉS de aceptar este archivo. */
  cupo: EstadoCupo;
}

/**
 * Los tres datos que el dominio no puede calcular solo. Se inyectan para que
 * toda la lógica de arriba sea verificable sin base de datos.
 *
 * Las tres implementaciones reales (`puertos-prisma.ts`) van scopeadas por
 * `constructora_id`: el aislamiento por tenant se hace DENTRO del puerto, no
 * en el dominio, para que no exista forma de llamarlo sin tenant.
 */
export interface PuertosSubida {
  /**
   * Bytes ya ocupados por la obra. Incluye las versiones reemplazadas: no se
   * borran, así que siguen pesando.
   */
  bytesUsadosEnObra(proyectoId: string): Promise<number>;
  /** ¿El piso/unidad de la ubicación cuelga realmente de esa obra? */
  ubicacionPertenece(ubicacion: Ubicacion): Promise<boolean>;
  /** Producto por id, ya filtrado por tenant. `null` si no existe o es ajeno. */
  buscarProducto(id: string): Promise<ProductoVersionado | null>;
}
