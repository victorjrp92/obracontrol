/**
 * Contrato del bloque de datos del inmueble (spec-arquitecto-2026-08.md, B8).
 *
 * Un arquitecto que hace un informe de inspección escribe hoy a mano un bloque
 * como este:
 *
 *   Dirección del inmueble: Calle 33a N.° 2B-100, Conjunto Prados del Naranjo
 *   Nro. matrícula: 370-7596
 *   Solicitado por: Apto 904 B - Ana Steward
 *   Dimensiones aproximadas: Apto de 70 m²
 *
 * Se escribe UNA vez y lo consumen el acta de estado inicial, los informes
 * técnicos y la línea Juntos. Por eso vive en `src/lib/inmueble/` y no dentro
 * de una pantalla.
 *
 * TypeScript puro, sin dependencias de UI ni de red — mismo criterio que
 * `src/lib/alerta/tipos.ts`. Los nombres de campo son EXACTAMENTE las columnas
 * del modelo `Proyecto`, para que `prisma.proyecto.update({ data })` reciba
 * este objeto sin traducción intermedia.
 */
import type { TipoPropiedad } from "@/lib/plantillas-personal";

export type { TipoPropiedad };

/**
 * El bloque ya validado y tipado. Todo opcional salvo `direccion_inmueble`:
 * nadie tiene la matrícula a mano cuando está registrando una obra, y un campo
 * obligatorio que la gente no puede llenar se llena con basura.
 */
export interface DatosInmueble {
  /** Identificador legal del predio, forma canónica `NNN-NNNNNNN` (ver matricula.ts). */
  matricula_inmobiliaria: string | null;
  /** ÚNICO campo obligatorio del bloque. */
  direccion_inmueble: string;
  conjunto_edificio: string | null;
  unidad_inmueble: string | null;
  ciudad: string | null;
  tipo_propiedad: TipoPropiedad | null;
  /** m² aproximados de todo el inmueble. */
  metraje_total: number | null;
  /** Dice bajo qué norma sísmica se construyó (ver norma-sismica.ts). */
  anio_construccion: number | null;
  /** Altura de piso a techo, en metros. Gobierna el grueso de estuco y pintura. */
  altura_libre_m: number | null;
  habitada_durante_obra: boolean | null;
  /** Quién pide la inspección, si no es el dueño. */
  solicitante: string | null;
}

/** Las once claves del bloque. Se deriva de `DatosInmueble` para que no se desfasen. */
export type CampoInmueble = keyof DatosInmueble;

/**
 * El mismo bloque tal como vive en un formulario: todo string, que es lo que
 * devuelve un `<input>`. `Record<CampoInmueble, string>` a propósito — añadir
 * un campo a `DatosInmueble` rompe la compilación aquí hasta que el formulario
 * lo cubra.
 *
 * Convenciones de los dos campos que no son texto libre:
 * - `tipo_propiedad`: `""` o un valor de `TipoPropiedad`.
 * - `habitada_durante_obra`: `""` (sin responder), `"si"` o `"no"`.
 */
export type FormularioInmueble = Record<CampoInmueble, string>;

/** Resultado de validar un campo o un bloque. Mismo patrón que `src/lib/juntos/acta-juntos.ts`. */
export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

export type NormaSismicaId = "sin_codigo" | "cccsr_84" | "nsr_98" | "nsr_10";

/**
 * Qué norma de construcción sismo resistente regía cuando se construyó el
 * inmueble. Es un HECHO derivado del año, no una evaluación: ninguna cadena de
 * este objeto puede opinar sobre el estado del inmueble.
 */
export interface NormaSismica {
  id: NormaSismicaId;
  /** Corta, para un badge o una celda de tabla: "NSR-98". */
  etiqueta: string;
  /** Rango de años que cubre: "1998 a 2009". */
  vigencia: string;
  /** Frase neutra lista para el documento, sin el año (lo pone `fraseNormaSismica`). */
  frase: string;
}
