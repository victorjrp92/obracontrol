/**
 * Validación del bloque de datos del inmueble, campo por campo y completo.
 *
 * Dos usos, un solo cuerpo de reglas:
 * 1. El formulario (`src/components/inmueble/BloqueDatosInmueble.tsx`) valida
 *    `FormularioInmueble` — strings de `<input>` — con
 *    `validarFormularioInmueble`, que devuelve TODOS los errores a la vez: en
 *    un celular, enseñar un error por intento es un formulario que no se
 *    termina.
 * 2. Cualquier ruta API valida el JSON crudo con `validarDatosInmueble`. En
 *    este repo no hay Zod: cada ruta valida a mano (ver AGENTS.md), así que
 *    esta es la segunda línea de defensa del servidor.
 *
 * Todo es opcional salvo `direccion_inmueble`. Un campo obligatorio que la
 * gente no puede llenar —la matrícula está en la escritura, no en el bolsillo—
 * se llena con basura, y la basura contamina el documento.
 */
import { validarMatricula } from "./matricula";
import { ANIO_MIN_CONSTRUCCION, anioMaximoConstruccion } from "./norma-sismica";
import type { CampoInmueble, DatosInmueble, FormularioInmueble, Resultado, TipoPropiedad } from "./tipos";

// ─── Límites ────────────────────────────────────────────────────────────────
export const DIRECCION_MIN_LARGO = 5;
export const DIRECCION_MAX_LARGO = 200;
export const TEXTO_MAX_LARGO = 120;
export const CIUDAD_MAX_LARGO = 60;

/** Menos de 1 m² no es un inmueble: es un punto decimal fuera de lugar. */
export const AREA_MIN_M2 = 1;
/** 100.000 m² son diez hectáreas construidas. Por encima, es un dedo de más. */
export const AREA_MAX_M2 = 100_000;

/** Altura libre de piso a techo. Por debajo de 1,80 m no se puede trabajar de pie. */
export const ALTURA_MIN_M = 1.8;
/** Diez metros cubre la nave industrial o el hall a doble altura más generoso. */
export const ALTURA_MAX_M = 10;

const TIPOS_PROPIEDAD_VALIDOS: TipoPropiedad[] = ["CASA", "APARTAMENTO", "EDIFICIO", "LOCAL"];

// ─── Utilidades internas ────────────────────────────────────────────────────

function estaVacio(crudo: unknown): boolean {
  return crudo === null || crudo === undefined || (typeof crudo === "string" && crudo.trim() === "");
}

/**
 * Lee un número escrito por una persona colombiana en un celular: coma
 * decimal (`2,4`), la unidad escrita al final (`70 m2`, `2,4 metros`) y
 * espacios sueltos. Devuelve `null`
 * si no hay forma de leerlo como número — el llamador ya descartó el vacío.
 * Rechaza notación científica y separadores de miles a propósito: `1e5` y
 * `1.000` son ambiguos escritos a mano.
 */
function aNumero(crudo: unknown): number | null {
  if (typeof crudo === "number") return Number.isFinite(crudo) ? crudo : null;
  if (typeof crudo !== "string") return null;

  const limpio = crudo
    .trim()
    .toLowerCase()
    .replace(/\s*(mts2|mts|metros?|m2|m²|m)$/, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Decimales como se escriben aquí: coma, no punto. Los mensajes se leen en español. */
function conComa(n: number): string {
  return String(n).replace(".", ",");
}

function validarTextoOpcional(crudo: unknown, maxLargo: number, queEs: string): Resultado<string | null> {
  if (estaVacio(crudo)) return { ok: true, valor: null };
  if (typeof crudo !== "string") return { ok: false, error: `Revisa ${queEs}.` };
  const texto = crudo.trim();
  if (texto.length > maxLargo) {
    return { ok: false, error: `${queEs.charAt(0).toUpperCase()}${queEs.slice(1)}: máximo ${maxLargo} caracteres.` };
  }
  return { ok: true, valor: texto };
}

// ─── Validadores por campo ──────────────────────────────────────────────────

/** ÚNICO campo obligatorio del bloque. */
export function validarDireccionInmueble(crudo: unknown): Resultado<string> {
  if (typeof crudo !== "string" || crudo.trim().length < DIRECCION_MIN_LARGO) {
    return { ok: false, error: "Escribe la dirección del inmueble: es lo que lo identifica en el documento." };
  }
  const texto = crudo.trim();
  if (texto.length > DIRECCION_MAX_LARGO) {
    return { ok: false, error: `La dirección no puede pasar de ${DIRECCION_MAX_LARGO} caracteres.` };
  }
  return { ok: true, valor: texto };
}

/** Opcional. Si viene, se guarda en forma canónica `CIRCULO-NUMERO`. */
export function validarMatriculaOpcional(crudo: unknown): Resultado<string | null> {
  if (estaVacio(crudo)) return { ok: true, valor: null };
  if (typeof crudo !== "string") return { ok: false, error: "Revisa la matrícula inmobiliaria." };
  const resultado = validarMatricula(crudo);
  return resultado.ok ? { ok: true, valor: resultado.valor.canonica } : resultado;
}

export function validarConjuntoEdificio(crudo: unknown): Resultado<string | null> {
  return validarTextoOpcional(crudo, TEXTO_MAX_LARGO, "el nombre del conjunto o edificio");
}

export function validarUnidadInmueble(crudo: unknown): Resultado<string | null> {
  return validarTextoOpcional(crudo, TEXTO_MAX_LARGO, "el apartamento, casa o local");
}

export function validarCiudad(crudo: unknown): Resultado<string | null> {
  return validarTextoOpcional(crudo, CIUDAD_MAX_LARGO, "la ciudad");
}

export function validarSolicitante(crudo: unknown): Resultado<string | null> {
  return validarTextoOpcional(crudo, TEXTO_MAX_LARGO, "quién solicita la inspección");
}

export function validarTipoPropiedad(crudo: unknown): Resultado<TipoPropiedad | null> {
  if (estaVacio(crudo)) return { ok: true, valor: null };
  if (typeof crudo !== "string" || !TIPOS_PROPIEDAD_VALIDOS.includes(crudo as TipoPropiedad)) {
    return { ok: false, error: "Elige un tipo de inmueble de la lista." };
  }
  return { ok: true, valor: crudo as TipoPropiedad };
}

/** Área total en m². Rechaza negativos, cero y valores que no son un inmueble. */
export function validarMetrajeTotal(crudo: unknown): Resultado<number | null> {
  if (estaVacio(crudo)) return { ok: true, valor: null };
  const n = aNumero(crudo);
  if (n === null) return { ok: false, error: "Escribe el área en números. Ejemplo: 70." };
  if (n <= 0) return { ok: false, error: "El área tiene que ser mayor que cero." };
  if (n < AREA_MIN_M2) return { ok: false, error: `Menos de ${AREA_MIN_M2} m² parece un punto decimal fuera de lugar.` };
  if (n > AREA_MAX_M2) {
    return { ok: false, error: `Más de ${AREA_MAX_M2.toLocaleString("es-CO")} m² no parece un inmueble. Revisa la cifra.` };
  }
  return { ok: true, valor: n };
}

/** Altura libre de piso a techo, en metros. El error enseña a convertir centímetros. */
export function validarAlturaLibre(crudo: unknown): Resultado<number | null> {
  if (estaVacio(crudo)) return { ok: true, valor: null };
  const n = aNumero(crudo);
  if (n === null) return { ok: false, error: "Escribe la altura en metros. Ejemplo: 2,4." };
  if (n < ALTURA_MIN_M || n > ALTURA_MAX_M) {
    return {
      ok: false,
      error: `La altura libre va entre ${conComa(ALTURA_MIN_M)} y ${conComa(ALTURA_MAX_M)} metros. Si la tienes en centímetros, pásala a metros: 250 cm son 2,5.`,
    };
  }
  return { ok: true, valor: n };
}

/** Año en cuatro dígitos, entre 1500 y el año que viene. */
export function validarAnioConstruccion(crudo: unknown): Resultado<number | null> {
  if (estaVacio(crudo)) return { ok: true, valor: null };
  const n = aNumero(crudo);
  if (n === null || !Number.isInteger(n)) {
    return { ok: false, error: "Escribe el año en cuatro dígitos. Ejemplo: 1998." };
  }
  const maximo = anioMaximoConstruccion();
  if (n < ANIO_MIN_CONSTRUCCION || n > maximo) {
    return { ok: false, error: `El año de construcción va entre ${ANIO_MIN_CONSTRUCCION} y ${maximo}.` };
  }
  return { ok: true, valor: n };
}

/** `""` sin responder, `"si"` / `"no"` en el formulario; booleano o nulo hacia el modelo. */
export function validarHabitadaDuranteObra(crudo: unknown): Resultado<boolean | null> {
  if (estaVacio(crudo)) return { ok: true, valor: null };
  if (typeof crudo === "boolean") return { ok: true, valor: crudo };
  if (crudo === "si") return { ok: true, valor: true };
  if (crudo === "no") return { ok: true, valor: false };
  return { ok: false, error: "Responde sí o no, o deja la pregunta en blanco." };
}

// ─── Bloque completo ────────────────────────────────────────────────────────

/** Un formulario vacío, listo para `useState`. */
export function formularioInmuebleVacio(): FormularioInmueble {
  return {
    matricula_inmobiliaria: "",
    direccion_inmueble: "",
    conjunto_edificio: "",
    unidad_inmueble: "",
    ciudad: "",
    tipo_propiedad: "",
    metraje_total: "",
    anio_construccion: "",
    altura_libre_m: "",
    habitada_durante_obra: "",
    solicitante: "",
  };
}

function aTextoFormulario(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "si" : "no";
  if (typeof valor === "number") return String(valor).replace(".", ",");
  return valor;
}

/** Precarga el formulario con lo que ya está guardado en el proyecto. */
export function formularioDesdeDatos(datos: Partial<DatosInmueble>): FormularioInmueble {
  const vacio = formularioInmuebleVacio();
  const claves = Object.keys(vacio) as CampoInmueble[];
  const forma = { ...vacio };
  for (const clave of claves) {
    forma[clave] = aTextoFormulario(datos[clave]);
  }
  return forma;
}

export type ErroresInmueble = Partial<Record<CampoInmueble, string>>;

export type ValidacionBloque =
  | { ok: true; datos: DatosInmueble }
  | { ok: false; errores: ErroresInmueble };

/**
 * Todos los validadores en un solo mapa: `validarFormularioInmueble` y
 * `validarDatosInmueble` recorren esto y no duplican reglas. El tipo es
 * deliberadamente laxo en el valor porque cada campo devuelve el suyo; el
 * ensamblado de abajo vuelve a estrechar a `DatosInmueble`.
 */
const VALIDADORES: Record<CampoInmueble, (crudo: unknown) => Resultado<unknown>> = {
  matricula_inmobiliaria: validarMatriculaOpcional,
  direccion_inmueble: validarDireccionInmueble,
  conjunto_edificio: validarConjuntoEdificio,
  unidad_inmueble: validarUnidadInmueble,
  ciudad: validarCiudad,
  tipo_propiedad: validarTipoPropiedad,
  metraje_total: validarMetrajeTotal,
  anio_construccion: validarAnioConstruccion,
  altura_libre_m: validarAlturaLibre,
  habitada_durante_obra: validarHabitadaDuranteObra,
  solicitante: validarSolicitante,
};

function validarBloque(fuente: Record<string, unknown>): ValidacionBloque {
  const errores: ErroresInmueble = {};
  const valores: Record<string, unknown> = {};

  for (const [campo, validar] of Object.entries(VALIDADORES) as [CampoInmueble, (c: unknown) => Resultado<unknown>][]) {
    const resultado = validar(fuente[campo]);
    if (resultado.ok) {
      valores[campo] = resultado.valor;
    } else {
      errores[campo] = resultado.error;
    }
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos: valores as unknown as DatosInmueble };
}

/** Valida el formulario entero y devuelve TODOS los errores de una vez. */
export function validarFormularioInmueble(forma: FormularioInmueble): ValidacionBloque {
  return validarBloque(forma as unknown as Record<string, unknown>);
}

/**
 * Valida un objeto crudo llegado por la red (segunda línea de defensa del
 * servidor). Acepta que falten claves: todas son opcionales salvo la
 * dirección, y ausente vale lo mismo que vacío.
 */
export function validarDatosInmueble(crudo: unknown): ValidacionBloque {
  if (!crudo || typeof crudo !== "object") {
    return { ok: false, errores: { direccion_inmueble: "Faltan los datos del inmueble." } };
  }
  return validarBloque(crudo as Record<string, unknown>);
}
