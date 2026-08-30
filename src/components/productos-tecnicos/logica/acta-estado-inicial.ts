import type { DatosInmueble, LineaInmueble } from "@/lib/inmueble";
import { lineasInmuebleParaDocumento } from "@/lib/inmueble";
import { ALCANCE, NATURALEZA_DOCUMENTO, NO_INCLUYE } from "./copys-acta-inicial";
import { buscarEspacio, type ArbolInmueble } from "./arbol-espacios";
import { leerMarca, type MarcaFotoInicial } from "./marca-foto-inicial";

/**
 * El contenido del acta de estado inicial: qué entra, en qué orden, y qué se
 * niega a salir.
 *
 * Este módulo construye el objeto que se imprime y —el mismo, serializado— el
 * que se resume en la huella SHA-256. Los dos SON el mismo objeto a propósito:
 * si el PDF imprimiera algo que no entró en la huella, ese algo se podría
 * cambiar sin que la verificación se enterara, y entonces el sello del pie
 * dejaría de significar lo que dice que significa.
 *
 * LO QUE ESTE MÓDULO IMPIDE, y es su razón de existir:
 *
 *  - Un acta con CERO fotos. Un registro fotográfico vacío no registra nada.
 *  - Una foto sin fecha, hora y ubicación quemadas. Si `leerMarca()` devuelve
 *    `null` para una sola de las fotos, el acta entera no se emite. No se filtra
 *    en silencio: una foto sin fecha dentro de una obra que se va a documentar
 *    es un problema que alguien tiene que ver, no un dato que se descarta.
 *  - Un acta sin matrícula inmobiliaria. Es el identificador legal del predio en
 *    Colombia y lo primero que pide una aseguradora; sin él, el documento no
 *    identifica de qué inmueble habla.
 *
 * Módulo puro: sin React, sin red, sin Prisma. Lo consumen la ruta de emisión,
 * el PDF y `scripts/verificar-acta-inicial.ts`.
 */

export type CodigoActa =
  | "SIN_FOTOS"
  | "FOTO_SIN_OVERLAY"
  | "DEMASIADAS_FOTOS"
  | "SIN_MATRICULA_INMOBILIARIA"
  | "SIN_DIRECCION"
  | "SIN_PROFESIONAL";

export class ActaInicialError extends Error {
  constructor(
    public readonly codigo: CodigoActa,
    message: string,
  ) {
    super(message);
    this.name = "ActaInicialError";
  }
}

export function esActaInicialError(err: unknown): err is ActaInicialError {
  return err instanceof ActaInicialError;
}

/**
 * Tope de fotos por acta.
 *
 * No es una regla de negocio: el PDF incrusta cada imagen como data-URI y se
 * arma entero en memoria dentro de una función serverless. Cien fotos de ~120 KB
 * ya son unos 16 MB de base64. Si algún día hace falta más, el cambio no es
 * subir este número sino paginar el documento o generarlo fuera de la petición.
 */
export const MAX_FOTOS_ACTA = 100;

/** Una fila de `productos_tecnicos` vista por el acta. Nada más le hace falta. */
export interface FotoRegistroFila {
  id: string;
  /** Nombre del espacio congelado al subir. Se conserva por si la marca faltara. */
  nombre: string;
  /** Aquí vive la marca (ver `marca-foto-inicial.ts`). */
  descripcion: string | null;
  unidad_id: string | null;
  created_at: string;
}

/** Una foto, ya numerada y con su sitio en el inmueble resuelto. */
export interface FotoActa {
  /** 1..N sobre TODO el documento, para poder decir «la foto 3». */
  numero: number;
  productoId: string;
  espacioId: string;
  espacio: string;
  /** «Cocina · Apto 501 · Piso 5 · Torre A», o solo el espacio si ya no está en la obra. */
  ubicacion: string;
  /** ISO 8601. El mismo instante que está quemado en la imagen. */
  capturadaEn: string;
  lat: number;
  lng: number;
  nota: string | null;
}

/** Las fotos de un espacio, juntas. */
export interface EspacioActa {
  espacioId: string;
  nombre: string;
  ubicacion: string;
  fotos: FotoActa[];
}

/** Quién firma. El nombre sale de la sesión, la matrícula de su perfil de firma. */
export interface ProfesionalActa {
  nombre: string;
  matricula: string | null;
}

/**
 * El contenido completo del acta. Lo que se imprime y lo que entra en la huella.
 *
 * El orden de las claves es el orden de serialización, y por lo tanto entra en
 * el hash: no se reordena.
 */
export interface PayloadActaInicial {
  version: 1;
  obra: { id: string; nombre: string };
  inmueble: LineaInmueble[];
  profesional: ProfesionalActa;
  /** ISO 8601 del momento de emisión. */
  emitidaEn: string;
  metodologia: { naturaleza: string; alcance: string[]; noIncluye: string[] };
  espacios: EspacioActa[];
  totalEspacios: number;
  totalFotos: number;
  /** ISO de la foto más antigua y de la más reciente. Acota el registro en el tiempo. */
  primeraCaptura: string;
  ultimaCaptura: string;
}

export interface EntradaActa {
  obra: { id: string; nombre: string };
  inmueble: DatosInmueble;
  arbol: ArbolInmueble;
  fotos: readonly FotoRegistroFila[];
  profesional: ProfesionalActa;
  emitidaEn: Date;
}

/** Una foto con su marca ya leída y validada. Paso intermedio, no sale del módulo. */
interface FotoConMarca {
  fila: FotoRegistroFila;
  marca: MarcaFotoInicial;
}

/**
 * Lee la marca de cada foto y CORTA en la primera que no la tenga.
 *
 * El mensaje nombra la foto por su espacio y su fecha de subida porque quien lo
 * lee tiene que poder ir a buscarla. «Hay una foto inválida» obligaría a
 * revisarlas todas a mano.
 */
function conMarcaOFallar(fotos: readonly FotoRegistroFila[]): FotoConMarca[] {
  return fotos.map((fila) => {
    const marca = leerMarca(fila.descripcion);
    if (!marca) {
      throw new ActaInicialError(
        "FOTO_SIN_OVERLAY",
        `Hay una foto del registro sin fecha, hora y ubicación quemadas en la imagen (${fila.nombre || "sin espacio"}, subida el ${fila.created_at.slice(0, 10)}). ` +
          "El acta no se emite con ella dentro: descártala y vuelve a tomarla desde la app.",
      );
    }
    return { fila, marca };
  });
}

/**
 * Agrupa por espacio siguiendo el recorrido del inmueble, y dentro de cada
 * espacio ordena las fotos por el instante de captura.
 *
 * Los espacios que ya no están en la obra —los borró alguien después de tomar
 * la foto— no se pierden ni bloquean el acta: van al final, ordenados por
 * nombre, con la dirección que se pueda reconstruir. Perder una foto del estado
 * previo porque se renombró la estructura sería el peor de los dos males.
 */
function agrupar(fotos: readonly FotoConMarca[], arbol: ArbolInmueble): EspacioActa[] {
  const porEspacio = new Map<string, FotoConMarca[]>();
  for (const foto of fotos) {
    const grupo = porEspacio.get(foto.marca.espacioId);
    if (grupo) grupo.push(foto);
    else porEspacio.set(foto.marca.espacioId, [foto]);
  }

  const grupos = [...porEspacio.entries()].map(([espacioId, delEspacio]) => {
    const ubicado = buscarEspacio(arbol, espacioId);
    const nombre = delEspacio[0].marca.espacio;
    return {
      espacioId,
      nombre,
      // La dirección sale del árbol; el NOMBRE del espacio sale de la marca, que
      // es el que está quemado en la imagen. Si alguien renombró el espacio
      // después, la foto y el acta siguen diciendo lo mismo.
      ubicacion: ubicado ? ubicado.ubicacion.replace(ubicado.nombre, nombre) : nombre,
      orden: ubicado ? ubicado.orden : Number.MAX_SAFE_INTEGER,
      fotos: [...delEspacio].sort(comparaFotos),
    };
  });

  grupos.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));

  return grupos.map((g) => ({
    espacioId: g.espacioId,
    nombre: g.nombre,
    ubicacion: g.ubicacion,
    fotos: g.fotos.map((f) => ({
      numero: 0, // se numera después, sobre el documento entero
      productoId: f.fila.id,
      espacioId: f.marca.espacioId,
      espacio: f.marca.espacio,
      ubicacion: g.ubicacion,
      capturadaEn: f.marca.capturadaEn,
      lat: f.marca.lat,
      lng: f.marca.lng,
      nota: f.marca.nota,
    })),
  }));
}

/** Por instante de captura; el id desempata para que el orden sea siempre el mismo. */
function comparaFotos(a: FotoConMarca, b: FotoConMarca): number {
  const ta = Date.parse(a.marca.capturadaEn);
  const tb = Date.parse(b.marca.capturadaEn);
  if (ta !== tb) return ta - tb;
  return a.fila.id.localeCompare(b.fila.id);
}

/**
 * Construye el contenido del acta, o lanza diciendo qué falta.
 *
 * La numeración es GLOBAL y corre en el orden del documento: la foto 3 es la
 * tercera que aparece leyendo de arriba abajo, y por eso «mira la foto 3» es una
 * instrucción que se puede seguir sin más contexto.
 */
export function construirPayloadActa(entrada: EntradaActa): PayloadActaInicial {
  const nombreProfesional = entrada.profesional.nombre.trim();
  if (!nombreProfesional) {
    throw new ActaInicialError(
      "SIN_PROFESIONAL",
      "El acta tiene que decir quién la emite; no encontramos el nombre del profesional.",
    );
  }

  const direccion = (entrada.inmueble.direccion_inmueble ?? "").trim();
  if (!direccion) {
    throw new ActaInicialError(
      "SIN_DIRECCION",
      "Falta la dirección del inmueble. Complétala en los datos de la obra antes de emitir el acta.",
    );
  }

  const matricula = (entrada.inmueble.matricula_inmobiliaria ?? "").trim();
  if (!matricula) {
    throw new ActaInicialError(
      "SIN_MATRICULA_INMOBILIARIA",
      "Falta la matrícula inmobiliaria. Es el identificador legal del predio y el acta la lleva impresa: " +
        "complétala en los datos de la obra antes de emitir el documento.",
    );
  }

  if (entrada.fotos.length === 0) {
    throw new ActaInicialError(
      "SIN_FOTOS",
      "Todavía no hay fotos en el registro inicial. Toma al menos una desde la app antes de emitir el acta.",
    );
  }
  if (entrada.fotos.length > MAX_FOTOS_ACTA) {
    throw new ActaInicialError(
      "DEMASIADAS_FOTOS",
      `Un acta admite hasta ${MAX_FOTOS_ACTA} fotografías y este registro tiene ${entrada.fotos.length}. ` +
        "Descarta las que no aporten, o emite el acta por etapas.",
    );
  }

  const conMarca = conMarcaOFallar(entrada.fotos);
  const espacios = agrupar(conMarca, entrada.arbol);

  let numero = 0;
  for (const espacio of espacios) {
    for (const foto of espacio.fotos) {
      numero += 1;
      foto.numero = numero;
    }
  }

  const instantes = conMarca.map((f) => f.marca.capturadaEn).sort();

  return {
    version: 1,
    obra: { id: entrada.obra.id, nombre: entrada.obra.nombre },
    inmueble: lineasInmuebleParaDocumento(entrada.inmueble),
    profesional: { nombre: nombreProfesional, matricula: entrada.profesional.matricula },
    emitidaEn: entrada.emitidaEn.toISOString(),
    metodologia: {
      naturaleza: NATURALEZA_DOCUMENTO,
      alcance: [...ALCANCE],
      noIncluye: [...NO_INCLUYE],
    },
    espacios,
    totalEspacios: espacios.length,
    totalFotos: numero,
    primeraCaptura: instantes[0],
    ultimaCaptura: instantes[instantes.length - 1],
  };
}

/**
 * El contenido serializado, EXACTAMENTE como entra en la huella.
 *
 * `JSON.stringify` sobre un objeto construido con literales conserva el orden de
 * inserción de las claves, así que dos ejecuciones con los mismos datos dan la
 * misma cadena y por lo tanto la misma huella. Quien emite y quien imprime
 * llaman a esta función; no hay una segunda forma de serializar.
 */
export function serializarContenidoActa(payload: PayloadActaInicial): string {
  return JSON.stringify(payload);
}

/** El contenido de vuelta desde el texto guardado. `null` si no es un acta. */
export function leerContenidoActa(serializado: string): PayloadActaInicial | null {
  try {
    const crudo = JSON.parse(serializado) as PayloadActaInicial;
    if (!crudo || crudo.version !== 1 || !Array.isArray(crudo.espacios)) return null;
    return crudo;
  } catch {
    return null;
  }
}

/** Todas las fotos del acta en el orden del documento, ya numeradas. */
export function fotosEnOrden(payload: PayloadActaInicial): FotoActa[] {
  return payload.espacios.flatMap((e) => e.fotos);
}

/** Todo el texto legible del acta ya construida. Sirve para barrer el lenguaje. */
export function textosDelPayload(payload: PayloadActaInicial): string[] {
  return [
    payload.obra.nombre,
    payload.profesional.nombre,
    payload.metodologia.naturaleza,
    ...payload.metodologia.alcance,
    ...payload.metodologia.noIncluye,
    ...payload.inmueble.flatMap((l) => [l.etiqueta, l.valor]),
    ...payload.espacios.flatMap((e) => [
      e.nombre,
      e.ubicacion,
      ...e.fotos.flatMap((f) => [f.espacio, f.ubicacion, f.nota ?? ""]),
    ]),
  ];
}
