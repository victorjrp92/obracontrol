import type { TipoDocumentoFirmable } from "@/generated/prisma";

/**
 * El documento firmable tal cual está guardado, en lo que a firmas e
 * inmutabilidad concierne.
 *
 * Es un tipo cerrado y deliberadamente pequeño: las reglas de este módulo se
 * escriben contra él y no contra el modelo de Prisma, así que se pueden
 * comprobar con casos fijos, sin base de datos. Lo que no está aquí, las reglas
 * no lo pueden mirar.
 */
export interface DocumentoGuardado {
  id: string;
  folio: string;
  /** SHA-256 del contenido validado + folio. */
  hash: string;
  tipo: TipoDocumentoFirmable;
  proyecto_id: string | null;
  constructora_id: string | null;

  /** Firma del profesional. Los tres van juntos o no va ninguno. */
  firmado_por_id: string | null;
  firmado_el: Date | null;
  /** Matrícula congelada en el momento de firmar. */
  matricula: string | null;

  /** «Recibido conforme» del cliente: constancia de ENTREGA. */
  recibido_por: string | null;
  recibido_el: Date | null;

  version: number;
  reemplaza_a: string | null;
  created_at: Date;
}

/**
 * Lo que se escribe al emitir un documento. No incluye ni firma ni recepción:
 * un documento NACE sin firmar, y firmar es una transición aparte con su propia
 * regla. Tampoco incluye `id` ni `created_at`, que los pone la base.
 */
export interface DocumentoNuevo {
  folio: string;
  hash: string;
  tipo: TipoDocumentoFirmable;
  proyecto_id: string | null;
  constructora_id: string | null;
  ciudad: string | null;
  nivel: string | null;
  piezas: number | null;
  version: number;
  reemplaza_a: string | null;
}

/** Lo que estampa la firma del profesional. Nada más se puede escribir al firmar. */
export interface DatosFirma {
  firmado_por_id: string;
  firmado_el: Date;
  matricula: string;
}

/** Lo que estampa la constancia de entrega del cliente. */
export interface DatosRecibido {
  recibido_por: string;
  recibido_el: Date;
}
