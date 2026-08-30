/**
 * Matrícula inmobiliaria — el identificador legal de un predio en Colombia,
 * el que emite la Oficina de Registro de Instrumentos Públicos y el que va a
 * pedir una aseguradora o una alcaldía.
 *
 * Forma canónica: `CIRCULO-NUMERO`, donde el círculo es el código de la
 * oficina de registro (Cali 370, Medellín 001, Bogotá 50N / 50C / 50S — sí,
 * con letra) y el número identifica el predio dentro de ese círculo.
 *
 * ── DECISIÓN: la validación es PERMISIVA a propósito ─────────────────────────
 * Hay matrículas históricas con distinto número de dígitos: `370-7596` (cuatro)
 * convive con `50N-20123456` (ocho). No existe una longitud fija que se pueda
 * exigir sin dejar fuera predios viejos que son exactamente los que un
 * arquitecto inspecciona. Y rechazar una matrícula válida es peor que aceptar
 * una rara: el usuario la copia de su escritura, no se la inventa, y si el
 * campo se la rechaza escribe cualquier cosa o lo deja vacío.
 *
 * Por eso esto valida la FORMA (código de círculo, guion, número) y no la
 * EXISTENCIA del predio. Nada aquí consulta el registro: comprobar que la
 * matrícula existe es un trámite en la VUR, no una expresión regular.
 *
 * Lo que sí se rechaza es lo imposible: cadenas sin número, con letras en el
 * número, con más de un guion, o absurdamente largas.
 */
import type { Resultado } from "./tipos";

/** Tope de caracteres tras normalizar. La matrícula más larga en uso real ronda los 12. */
export const MATRICULA_MAX_LARGO = 20;

/** Hasta tres caracteres: uno a tres dígitos y una letra opcional (`50N` en Bogotá). */
const CIRCULO_RE = /^\d{1,3}[A-Z]?$/;
/** Solo dígitos. Diez da margen de sobra sobre los ocho que se usan hoy. */
const NUMERO_RE = /^\d{1,10}$/;
/** Cuando la persona escribe sin guion, el código de círculo son los tres primeros caracteres. */
const LARGO_CIRCULO = 3;

export interface MatriculaInmobiliaria {
  /** Código de la oficina de registro: "370", "50N". */
  circulo: string;
  /** Número del predio dentro del círculo: "7596". */
  numero: string;
  /** Forma canónica `CIRCULO-NUMERO`, que es la que se guarda y se imprime. */
  canonica: string;
}

/**
 * Limpia lo que escribió la persona sin interpretarlo: mayúsculas, fuera
 * espacios, puntos y guiones bajos, y los guiones tipográficos (– —, los que
 * mete el teclado del celular al autocorregir) pasan a guion normal.
 */
export function normalizarMatricula(cruda: string): string {
  return cruda
    .trim()
    .toUpperCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\s._]/g, "");
}

/**
 * Valida y lleva a forma canónica. `370-7596` y `3707596` dan el MISMO
 * resultado: sin guion, los tres primeros caracteres son el círculo.
 */
export function validarMatricula(cruda: string): Resultado<MatriculaInmobiliaria> {
  const limpia = normalizarMatricula(cruda);

  if (limpia.length === 0) {
    return { ok: false, error: "Escribe la matrícula inmobiliaria o deja el campo vacío." };
  }
  if (limpia.length > MATRICULA_MAX_LARGO) {
    return { ok: false, error: "Esa matrícula tiene demasiados caracteres. Revísala en tu escritura." };
  }
  if (!/^[0-9A-Z-]+$/.test(limpia)) {
    return { ok: false, error: "La matrícula lleva solo números y el guion del círculo registral. Ejemplo: 370-7596." };
  }

  const partes = limpia.split("-");
  let circulo: string;
  let numero: string;

  if (partes.length === 1) {
    if (partes[0].length <= LARGO_CIRCULO) {
      return { ok: false, error: "Faltan dígitos: la matrícula lleva el código del círculo y el número del predio. Ejemplo: 370-7596." };
    }
    circulo = partes[0].slice(0, LARGO_CIRCULO);
    numero = partes[0].slice(LARGO_CIRCULO);
  } else if (partes.length === 2) {
    circulo = partes[0];
    numero = partes[1];
  } else {
    return { ok: false, error: "La matrícula lleva un solo guion, entre el círculo registral y el número. Ejemplo: 370-7596." };
  }

  if (!CIRCULO_RE.test(circulo)) {
    return { ok: false, error: "Antes del guion va el código del círculo registral: hasta tres caracteres. Ejemplo: 370, o 50N en Bogotá." };
  }
  if (!NUMERO_RE.test(numero)) {
    return { ok: false, error: "Después del guion va el número del predio, solo dígitos. Ejemplo: 370-7596." };
  }

  return { ok: true, valor: { circulo, numero, canonica: `${circulo}-${numero}` } };
}

/** Atajo para pintar en pantalla lo que la persona escribió, ya canónico. */
export function formatearMatricula(cruda: string): string {
  const resultado = validarMatricula(cruda);
  return resultado.ok ? resultado.valor.canonica : normalizarMatricula(cruda);
}
