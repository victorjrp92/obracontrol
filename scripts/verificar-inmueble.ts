/**
 * Verifica el bloque de datos del inmueble (`src/lib/inmueble/`) contra la
 * sección B8 del spec del perfil Arquitecto: los once campos del modelo, la
 * matrícula inmobiliaria colombiana, los cuatro tramos de norma sísmica con
 * sus bordes exactos, los rangos de área y altura, y la regla dura de que
 * NINGÚN texto del módulo emite un juicio sobre el estado del inmueble.
 *
 * No hay test runner en el proyecto — este script es la suite, en asserts
 * planos, con el mismo estilo que `scripts/verificar-reglas-alerta.ts`.
 *
 * Uso: `npx tsx scripts/verificar-inmueble.ts`. Sale con código 1 si algo falla.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  COPY_INMUEBLE,
  ETIQUETAS_DOCUMENTO,
  LABEL_HABITADA,
  LABEL_TIPO_PROPIEDAD,
  NOTA_NORMA_SISMICA,
  SUBTITULO_BLOQUE,
  TEXTO_OCUPACION,
  TITULO_BLOQUE,
} from "@/lib/inmueble/copys";
import { lineasInmuebleParaDocumento, resumenInmuebleUnaLinea } from "@/lib/inmueble/documento";
import { formatearMatricula, normalizarMatricula, validarMatricula } from "@/lib/inmueble/matricula";
import {
  ANIO_MIN_CONSTRUCCION,
  NORMAS_SISMICAS,
  TRAMOS_NORMA_SISMICA,
  anioMaximoConstruccion,
  fraseNormaSismica,
  normaSismicaPorAnio,
} from "@/lib/inmueble/norma-sismica";
import type { DatosInmueble } from "@/lib/inmueble/tipos";
import {
  ALTURA_MAX_M,
  ALTURA_MIN_M,
  AREA_MAX_M2,
  formularioDesdeDatos,
  formularioInmuebleVacio,
  validarAlturaLibre,
  validarAnioConstruccion,
  validarCiudad,
  validarConjuntoEdificio,
  validarDatosInmueble,
  validarDireccionInmueble,
  validarFormularioInmueble,
  validarHabitadaDuranteObra,
  validarMatriculaOpcional,
  validarMetrajeTotal,
  validarSolicitante,
  validarTipoPropiedad,
  validarUnidadInmueble,
} from "@/lib/inmueble/validacion";

let total = 0;
let fallos = 0;

function verificar(descripcion: string, condicion: boolean) {
  total++;
  if (condicion) {
    console.log(`  OK   ${descripcion}`);
  } else {
    fallos++;
    console.error(`  FAIL ${descripcion}`);
  }
}

/** Azúcar para los casos «esperaba X, obtuve Y», que son casi todos. */
function igual(descripcion: string, obtenido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  verificar(ok ? descripcion : `${descripcion} → esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(obtenido)}`, ok);
}

console.log("Bloque de datos del inmueble — verificación\n");

// ─── 1) El modelo Proyecto tiene los campos y la matrícula es opcional ──────
console.log("1) Modelo Proyecto — los campos del bloque existen y son opcionales");

const RUTA_SCHEMA = path.join(process.cwd(), "prisma", "schema.prisma");
if (!existsSync(RUTA_SCHEMA)) {
  console.error(`No encuentro ${RUTA_SCHEMA}. Corre este script desde la raíz del repo.`);
  process.exit(1);
}
const SCHEMA = readFileSync(RUTA_SCHEMA, "utf8");
const BLOQUE_PROYECTO = SCHEMA.match(/model Proyecto \{([\s\S]*?)\n\}/)?.[1] ?? "";
verificar("el modelo Proyecto existe en schema.prisma", BLOQUE_PROYECTO.length > 0);

// Los once campos del bloque B8. Ocho se añadieron para el perfil Arquitecto;
// ciudad, tipo_propiedad y metraje_total ya existían y se reutilizan.
const CAMPOS_MODELO = [
  "matricula_inmobiliaria",
  "direccion_inmueble",
  "conjunto_edificio",
  "unidad_inmueble",
  "ciudad",
  "tipo_propiedad",
  "metraje_total",
  "anio_construccion",
  "altura_libre_m",
  "habitada_durante_obra",
  "solicitante",
];
for (const campo of CAMPOS_MODELO) {
  verificar(`Proyecto.${campo} existe`, new RegExp(`^\\s*${campo}\\s+\\S+`, "m").test(BLOQUE_PROYECTO));
}
verificar(
  "Proyecto.matricula_inmobiliaria es opcional (String?)",
  /^\s*matricula_inmobiliaria\s+String\?/m.test(BLOQUE_PROYECTO)
);
verificar(
  "Proyecto.anio_construccion es un entero opcional (Int?)",
  /^\s*anio_construccion\s+Int\?/m.test(BLOQUE_PROYECTO)
);

// ─── 2) Matrícula inmobiliaria ─────────────────────────────────────────────
console.log("\n2) Matrícula inmobiliaria — misma forma canónica con guion y sin guion");

function canonica(cruda: string): string | null {
  const r = validarMatricula(cruda);
  return r.ok ? r.valor.canonica : null;
}

igual("con guion: 370-7596", canonica("370-7596"), "370-7596");
igual("sin guion: 3707596 → 370-7596", canonica("3707596"), "370-7596");
igual("con espacios: '370 7596'", canonica("370 7596"), "370-7596");
igual("con espacios alrededor del guion: ' 370 - 7596 '", canonica(" 370 - 7596 "), "370-7596");
igual("con punto: 370.7596", canonica("370.7596"), "370-7596");
igual("con guion tipográfico (autocorrector del celular): 370–7596", canonica("370–7596"), "370-7596");
verificar(
  "las cinco formas de escribirla dan EXACTAMENTE la misma canónica",
  new Set([
    canonica("370-7596"),
    canonica("3707596"),
    canonica("370 7596"),
    canonica("370.7596"),
    canonica("370–7596"),
  ]).size === 1
);
igual("normalizar es idempotente: validar(canónica) === canónica", canonica("370-7596"), canonica(canonica("370-7596") ?? ""));
igual("formatearMatricula devuelve la canónica", formatearMatricula("370 7596"), "370-7596");
// normalizar SOLO limpia: no inventa el guion. Interpretar dónde acaba el
// círculo es trabajo de validarMatricula.
igual("normalizarMatricula limpia sin interpretar (no inserta el guion)", normalizarMatricula(" 370 . 7596 "), "3707596");
igual("normalizarMatricula respeta el guion que ya venía", normalizarMatricula(" 370 - 7596 "), "370-7596");

console.log("\n   Permisiva a propósito: círculos con letra (Bogotá) y longitudes históricas");
igual("Bogotá con guion: 50N-20123456", canonica("50N-20123456"), "50N-20123456");
igual("Bogotá en minúscula: 50n-20123456", canonica("50n-20123456"), "50N-20123456");
igual("Bogotá sin guion: 50N20123456", canonica("50N20123456"), "50N-20123456");
igual("círculo de un dígito: 1-25", canonica("1-25"), "1-25");
igual("matrícula histórica corta: 370-45", canonica("370-45"), "370-45");
igual("ocho dígitos de número: 001-12345678", canonica("001-12345678"), "001-12345678");
igual("ceros a la izquierda del número se conservan: 370-0007596", canonica("370-0007596"), "370-0007596");

console.log("\n   Rechaza lo imposible");
function rechaza(descripcion: string, cruda: string) {
  const r = validarMatricula(cruda);
  verificar(`${descripcion}: ${JSON.stringify(cruda)}`, !r.ok);
}
rechaza("cadena vacía", "");
rechaza("solo espacios", "   ");
rechaza("solo el círculo, sin número", "370");
rechaza("solo el guion", "-");
rechaza("sin círculo", "-7596");
rechaza("sin número tras el guion", "370-");
rechaza("letras en el círculo", "ABC-1234");
rechaza("letras en el número", "370-75A6");
rechaza("dos guiones", "370-7596-2");
rechaza("guion doble", "370--7596");
rechaza("caracteres que no son de una matrícula", "370/7596");
rechaza("número absurdamente largo", "370-123456789012345");
rechaza("cadena larguísima", "9".repeat(30));

// ─── 3) Norma sísmica por año ──────────────────────────────────────────────
console.log("\n3) Norma sísmica — los cuatro tramos y sus bordes exactos");

function idNorma(anio: number | null): string | null {
  return normaSismicaPorAnio(anio)?.id ?? null;
}

igual("1932 → sin código sísmico", idNorma(1932), "sin_codigo");
igual("BORDE 1983 (último año sin código) → sin_codigo", idNorma(1983), "sin_codigo");
igual("BORDE 1984 (primer año con código) → CCCSR-84", idNorma(1984), "cccsr_84");
igual("1990 → CCCSR-84", idNorma(1990), "cccsr_84");
igual("BORDE 1997 (último año del CCCSR-84) → cccsr_84", idNorma(1997), "cccsr_84");
igual("BORDE 1998 (primer año de la NSR-98) → nsr_98", idNorma(1998), "nsr_98");
igual("2005 → NSR-98", idNorma(2005), "nsr_98");
igual("BORDE 2009 (último año de la NSR-98) → nsr_98", idNorma(2009), "nsr_98");
igual("BORDE 2010 (primer año de la NSR-10) → nsr_10", idNorma(2010), "nsr_10");
igual("2024 → NSR-10", idNorma(2024), "nsr_10");
igual("el año que viene → NSR-10", idNorma(anioMaximoConstruccion()), "nsr_10");

igual("etiqueta de sin_codigo", NORMAS_SISMICAS.sin_codigo.etiqueta, "Sin código sísmico");
igual("etiqueta de cccsr_84", NORMAS_SISMICAS.cccsr_84.etiqueta, "CCCSR-84");
igual("etiqueta de nsr_98", NORMAS_SISMICAS.nsr_98.etiqueta, "NSR-98");
igual("etiqueta de nsr_10", NORMAS_SISMICAS.nsr_10.etiqueta, "NSR-10");
igual("hay exactamente cuatro tramos", TRAMOS_NORMA_SISMICA.length, 4);

console.log("\n   Sin año no hay tramo por defecto: devuelve null");
igual("null → null", idNorma(null), null);
igual("undefined → null", normaSismicaPorAnio(undefined), null);
igual(`${ANIO_MIN_CONSTRUCCION - 1} (antes del mínimo) → null`, idNorma(ANIO_MIN_CONSTRUCCION - 1), null);
igual("año futuro fuera de rango → null", idNorma(anioMaximoConstruccion() + 1), null);
igual("año con decimales → null", idNorma(1998.5), null);
igual("NaN → null", idNorma(Number.NaN), null);
verificar("fraseNormaSismica(1979) menciona el año", (fraseNormaSismica(1979) ?? "").includes("1979"));
igual("fraseNormaSismica(null) → null", fraseNormaSismica(null), null);

// ─── 4) Área y altura ──────────────────────────────────────────────────────
console.log("\n4) Área — rechaza negativos y absurdos");

function areaValor(crudo: unknown): number | null | "ERROR" {
  const r = validarMetrajeTotal(crudo);
  return r.ok ? r.valor : "ERROR";
}
igual("70 → 70", areaValor("70"), 70);
igual("coma decimal: '70,5' → 70.5", areaValor("70,5"), 70.5);
igual("con unidad pegada: '70 m2' → 70", areaValor("70 m2"), 70);
igual("con unidad en símbolo: '70 m²' → 70", areaValor("70 m²"), 70);
igual("con unidad suelta: '70 m' → 70", areaValor("70 m"), 70);
igual("vacío → null (es opcional)", areaValor(""), null);
igual("número nativo 70 → 70", areaValor(70), 70);
igual("NEGATIVA (-1) → error", areaValor("-1"), "ERROR");
igual("negativa nativa (-45.5) → error", areaValor(-45.5), "ERROR");
igual("cero → error", areaValor("0"), "ERROR");
igual("0,5 m² (punto decimal fuera de lugar) → error", areaValor("0,5"), "ERROR");
igual(`BORDE ${AREA_MAX_M2} m² → válida`, areaValor(String(AREA_MAX_M2)), AREA_MAX_M2);
igual(`BORDE ${AREA_MAX_M2 + 1} m² → error`, areaValor(String(AREA_MAX_M2 + 1)), "ERROR");
igual("texto que no es número → error", areaValor("setenta"), "ERROR");
igual("notación científica → error (ambigua escrita a mano)", areaValor("1e5"), "ERROR");

console.log("\n   Altura libre — fuera de 1,8–10 m se rechaza");
function alturaValor(crudo: unknown): number | null | "ERROR" {
  const r = validarAlturaLibre(crudo);
  return r.ok ? r.valor : "ERROR";
}
igual("2,4 → 2.4", alturaValor("2,4"), 2.4);
igual("con unidad escrita: '2,4 m' → 2.4", alturaValor("2,4 m"), 2.4);
igual("con unidad en palabra: '2,4 metros' → 2.4", alturaValor("2,4 metros"), 2.4);
igual("centímetros no se convierten solos: '250 cm' → error", alturaValor("250 cm"), "ERROR");
igual("vacío → null (es opcional)", alturaValor(""), null);
igual(`BORDE ${ALTURA_MIN_M} m → válida`, alturaValor(String(ALTURA_MIN_M)), ALTURA_MIN_M);
igual(`BORDE ${ALTURA_MAX_M} m → válida`, alturaValor(String(ALTURA_MAX_M)), ALTURA_MAX_M);
igual("1,79 m (por debajo del mínimo) → error", alturaValor("1,79"), "ERROR");
igual("10,01 m (por encima del máximo) → error", alturaValor("10,01"), "ERROR");
igual("ABSURDA: 250 (escribió centímetros) → error", alturaValor("250"), "ERROR");
igual("ABSURDA: 0 → error", alturaValor("0"), "ERROR");
igual("NEGATIVA: -2,4 → error", alturaValor("-2,4"), "ERROR");

console.log("\n   Año de construcción como campo de formulario");
function anioValor(crudo: unknown): number | null | "ERROR" {
  const r = validarAnioConstruccion(crudo);
  return r.ok ? r.valor : "ERROR";
}
igual("'1998' → 1998", anioValor("1998"), 1998);
igual("vacío → null (es opcional)", anioValor(""), null);
igual("'98' → error (fuera de rango)", anioValor("98"), "ERROR");
igual("'mil novecientos' → error", anioValor("mil novecientos"), "ERROR");
igual("año dos veces en el futuro → error", anioValor(String(anioMaximoConstruccion() + 1)), "ERROR");
igual("1998,5 → error (el año no lleva decimales)", anioValor("1998,5"), "ERROR");

// ─── 5) El bloque completo ─────────────────────────────────────────────────
console.log("\n5) Bloque completo — solo la dirección es obligatoria");

const soloDireccion = { ...formularioInmuebleVacio(), direccion_inmueble: "Calle 33A #2B-100" };
const resSoloDireccion = validarFormularioInmueble(soloDireccion);
verificar("con solo la dirección, el bloque es válido", resSoloDireccion.ok);
if (resSoloDireccion.ok) {
  igual("matrícula vacía → null", resSoloDireccion.datos.matricula_inmobiliaria, null);
  igual("año vacío → null", resSoloDireccion.datos.anio_construccion, null);
  igual("habitada sin responder → null", resSoloDireccion.datos.habitada_durante_obra, null);
  igual("tipo sin elegir → null", resSoloDireccion.datos.tipo_propiedad, null);
}

const sinDireccion = validarFormularioInmueble(formularioInmuebleVacio());
verificar("sin dirección, el bloque NO es válido", !sinDireccion.ok);
verificar(
  "el error cae en direccion_inmueble y en ningún otro campo",
  !sinDireccion.ok && Object.keys(sinDireccion.errores).length === 1 && Boolean(sinDireccion.errores.direccion_inmueble)
);

const variosErrores = validarFormularioInmueble({
  ...formularioInmuebleVacio(),
  direccion_inmueble: "Calle 33A #2B-100",
  matricula_inmobiliaria: "ABC-XYZ",
  metraje_total: "-40",
  altura_libre_m: "250",
  anio_construccion: "12",
});
verificar("un formulario con cuatro problemas no es válido", !variosErrores.ok);
verificar(
  "devuelve los CUATRO errores de una vez, no el primero",
  !variosErrores.ok && Object.keys(variosErrores.errores).length === 4
);

// El caso real del brief, escrito a mano por un arquitecto en Cali.
const CASO_REAL = validarFormularioInmueble({
  matricula_inmobiliaria: "370 7596",
  direccion_inmueble: "Calle 33A N.° 2B-100",
  conjunto_edificio: "Conjunto Prados del Naranjo",
  unidad_inmueble: "Apto 904 B",
  ciudad: "Cali",
  tipo_propiedad: "APARTAMENTO",
  metraje_total: "70",
  anio_construccion: "1998",
  altura_libre_m: "2,4",
  habitada_durante_obra: "si",
  solicitante: "Apto 904 B - Ana Steward",
});
verificar("el caso real completo es válido", CASO_REAL.ok);
if (!CASO_REAL.ok) {
  console.error(`  detalle: ${JSON.stringify(CASO_REAL.errores)}`);
}
const DATOS_REALES: DatosInmueble = CASO_REAL.ok
  ? CASO_REAL.datos
  : {
      matricula_inmobiliaria: null,
      direccion_inmueble: "",
      conjunto_edificio: null,
      unidad_inmueble: null,
      ciudad: null,
      tipo_propiedad: null,
      metraje_total: null,
      anio_construccion: null,
      altura_libre_m: null,
      habitada_durante_obra: null,
      solicitante: null,
    };
igual("la matrícula se guarda canónica", DATOS_REALES.matricula_inmobiliaria, "370-7596");
igual("el área queda numérica", DATOS_REALES.metraje_total, 70);
igual("la altura acepta coma decimal", DATOS_REALES.altura_libre_m, 2.4);
igual("habitada 'si' → true", DATOS_REALES.habitada_durante_obra, true);

const ida = formularioDesdeDatos(DATOS_REALES);
igual("ida y vuelta: el área vuelve como texto", ida.metraje_total, "70");
igual("ida y vuelta: la altura vuelve con coma", ida.altura_libre_m, "2,4");
igual("ida y vuelta: habitada vuelve como 'si'", ida.habitada_durante_obra, "si");
verificar("ida y vuelta: revalida sin errores", validarFormularioInmueble(ida).ok);

console.log("\n   validarDatosInmueble — segunda línea de defensa del servidor");
verificar("null → inválido", !validarDatosInmueble(null).ok);
verificar("string → inválido", !validarDatosInmueble("Calle 1").ok);
verificar(
  "objeto con solo la dirección → válido (las claves ausentes valen como vacías)",
  validarDatosInmueble({ direccion_inmueble: "Calle 33A #2B-100" }).ok
);
verificar("tipo de inmueble inventado → inválido", !validarDatosInmueble({ direccion_inmueble: "Calle 33A #2B-100", tipo_propiedad: "FINCA" }).ok);
verificar(
  "booleano nativo en habitada_durante_obra → válido",
  validarDatosInmueble({ direccion_inmueble: "Calle 33A #2B-100", habitada_durante_obra: false }).ok
);

// ─── 6) El bloque impreso ──────────────────────────────────────────────────
console.log("\n6) Líneas para el documento — solo sale lo que tiene valor");

const LINEAS = lineasInmuebleParaDocumento(DATOS_REALES);
const porEtiqueta = (etiqueta: string) => LINEAS.find((l) => l.etiqueta === etiqueta)?.valor ?? null;

igual(
  "dirección y conjunto se leen juntos",
  porEtiqueta(ETIQUETAS_DOCUMENTO.direccion_inmueble),
  "Calle 33A N.° 2B-100, Conjunto Prados del Naranjo"
);
igual("la matrícula sale canónica", porEtiqueta(ETIQUETAS_DOCUMENTO.matricula_inmobiliaria), "370-7596");
igual("el área lleva su unidad", porEtiqueta(ETIQUETAS_DOCUMENTO.metraje_total), "70 m²");
igual("la altura lleva su unidad", porEtiqueta(ETIQUETAS_DOCUMENTO.altura_libre_m), "2,4 m");
igual("el año arrastra su norma", porEtiqueta(ETIQUETAS_DOCUMENTO.anio_construccion), "1998 (NSR-98)");
igual("el solicitante se imprime", porEtiqueta(ETIQUETAS_DOCUMENTO.solicitante), "Apto 904 B - Ana Steward");
verificar("hay línea de norma sísmica", porEtiqueta(ETIQUETAS_DOCUMENTO.norma_sismica) !== null);

const LINEAS_MINIMAS = lineasInmuebleParaDocumento({
  matricula_inmobiliaria: null,
  direccion_inmueble: "Calle 33A #2B-100",
  conjunto_edificio: null,
  unidad_inmueble: null,
  ciudad: null,
  tipo_propiedad: null,
  metraje_total: null,
  anio_construccion: null,
  altura_libre_m: null,
  habitada_durante_obra: null,
  solicitante: null,
});
igual("con solo la dirección, sale UNA línea", LINEAS_MINIMAS.length, 1);
igual("y es la dirección", LINEAS_MINIMAS[0]?.valor, "Calle 33A #2B-100");
verificar("resumen de una línea usa unidad y conjunto", resumenInmuebleUnaLinea(DATOS_REALES).includes("Apto 904 B"));

// ─── 7) REGLA DURA: ningún texto dictamina ─────────────────────────────────
console.log("\n7) Regla dura — ninguna cadena del módulo emite un juicio sobre el inmueble");

/**
 * Misma mecánica que la regla de `/\bsegur/i` en `src/lib/alerta/copys.ts`:
 * decir «se construyó antes de que existiera código sísmico» es un hecho;
 * decir «es peligroso», «tiene riesgo» o «no es habitable» sería un dictamen,
 * y esta aplicación no dictamina.
 */
const PROHIBIDO = /\bsegur|peligr|riesg|habitab/i;

// Control positivo: si el patrón no cazara un dictamen, este bloque entero no
// verificaría nada.
verificar("el patrón caza 'es peligroso'", PROHIBIDO.test("La estructura es peligrosa"));
verificar("el patrón caza 'riesgo'", PROHIBIDO.test("hay riesgo de colapso"));
verificar("el patrón caza 'no es habitable'", PROHIBIDO.test("el inmueble no es habitable"));
verificar("el patrón caza 'es seguro'", PROHIBIDO.test("el inmueble es seguro"));
// Control negativo: «aseguradora» NO es un juicio — el `\b` del patrón lo deja
// pasar a propósito, y el microcopy de la matrícula la nombra.
verificar("el patrón NO caza 'aseguradora'", !PROHIBIDO.test("va a pedirte tu aseguradora"));

function todasLasCadenas(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(todasLasCadenas);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(todasLasCadenas);
  return [];
}

// Toda entrada inválida que el módulo sabe rechazar, para barrer también los
// mensajes de error (que es texto que el usuario lee).
const ENTRADAS_INVALIDAS: [(c: unknown) => { ok: boolean; error?: string }, unknown[]][] = [
  [validarDireccionInmueble, ["", "Cll", 42, "x".repeat(500)]],
  [validarMatriculaOpcional, ["ABC-XYZ", "370", "370-7596-2", "9".repeat(30), 42]],
  [validarConjuntoEdificio, ["x".repeat(500), 42]],
  [validarUnidadInmueble, ["x".repeat(500)]],
  [validarCiudad, ["x".repeat(500)]],
  [validarSolicitante, ["x".repeat(500)]],
  [validarTipoPropiedad, ["FINCA", 42]],
  [validarMetrajeTotal, ["-1", "0", "0,5", String(AREA_MAX_M2 + 1), "setenta"]],
  [validarAlturaLibre, ["1,79", "10,01", "250", "-2", "alto"]],
  [validarAnioConstruccion, ["98", "mil novecientos", "1998,5", String(anioMaximoConstruccion() + 5)]],
  [validarHabitadaDuranteObra, ["quizá", 42]],
];

const mensajesDeError: string[] = [];
for (const [validador, entradas] of ENTRADAS_INVALIDAS) {
  for (const entrada of entradas) {
    const r = validador(entrada);
    if (!r.ok && r.error) mensajesDeError.push(r.error);
  }
}
verificar("la batería de entradas inválidas produjo mensajes de error", mensajesDeError.length >= 25);

const TEXTOS_DEL_MODULO: unknown[] = [
  COPY_INMUEBLE,
  ETIQUETAS_DOCUMENTO,
  LABEL_HABITADA,
  LABEL_TIPO_PROPIEDAD,
  NOTA_NORMA_SISMICA,
  SUBTITULO_BLOQUE,
  TEXTO_OCUPACION,
  TITULO_BLOQUE,
  NORMAS_SISMICAS,
  TRAMOS_NORMA_SISMICA,
  fraseNormaSismica(1932),
  fraseNormaSismica(1990),
  fraseNormaSismica(2005),
  fraseNormaSismica(2024),
  LINEAS,
  LINEAS_MINIMAS,
  resumenInmuebleUnaLinea(DATOS_REALES),
  mensajesDeError,
];

const CADENAS = TEXTOS_DEL_MODULO.flatMap(todasLasCadenas);
verificar("hay texto que revisar (el barrido no está vacío)", CADENAS.length > 60);

const CULPABLES = CADENAS.filter((c) => PROHIBIDO.test(c));
verificar(
  CULPABLES.length === 0
    ? `ninguna de las ${CADENAS.length} cadenas del módulo matchea /\\bsegur|peligr|riesg|habitab/i`
    : `hay cadenas con juicio de seguridad: ${JSON.stringify(CULPABLES.slice(0, 3))}`,
  CULPABLES.length === 0
);

// El microcopy tiene que seguir justificando cada campo: una pista vacía es
// una etiqueta suelta, que es exactamente lo que hace que la gente se salte
// los campos opcionales.
verificar(
  "los once campos tienen microcopy que los justifica",
  Object.values(COPY_INMUEBLE).every((c) => c.pista.trim().length > 20)
);
verificar("el bloque tiene once campos", Object.keys(COPY_INMUEBLE).length === 11);

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Bloque de datos del inmueble verificado sin errores.");
