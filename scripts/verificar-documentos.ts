/**
 * Verifica el módulo compartido de documentos verificables (`src/lib/documentos/`)
 * después de sacarlo de dentro de la línea Juntos.
 *
 * LO QUE ESTÁ EN JUEGO: hay actas, informes de grietas y derechos de petición
 * YA EMITIDOS Y DESCARGADOS, con su folio y su huella impresos en el pie de un
 * PDF que hoy está en manos de una persona o de su aseguradora. Si el algoritmo
 * cambia un ápice, o si la consulta deja de mirar donde están esos documentos,
 * papeles auténticos empiezan a dar «no encontramos este folio». Por eso este
 * script congela los valores esperados en vez de limitarse a comprobar que el
 * código corre: reimplementa el algoritmo ORIGINAL, anterior al refactor, y
 * compara contra él; y además fija huellas literales calculadas antes de mover
 * nada, para que ni siquiera un cambio simultáneo en las dos partes pase.
 *
 * No toca la base de datos. Importar un módulo que usa Prisma no abre ninguna
 * conexión —Prisma conecta en la primera consulta— y aquí no se hace ninguna.
 *
 * No hay test runner en el proyecto: este script es la suite, en asserts planos.
 *
 * Uso: `npx tsx scripts/verificar-documentos.ts`. Sale con código 1 si algo falla.
 */
import { createHash, randomBytes } from "crypto";
import { readFileSync, readdirSync } from "fs";
import path from "path";

import {
  esFolioDeFamilia,
  generarFolio,
  hashContenido,
  hashCorto,
  normalizarFolio,
  LARGO_HUELLA_CORTA,
  PATRON_FOLIO,
  PATRON_HUELLA,
  type PrefijoFolio,
} from "@/lib/documentos/folio";
import { cotejarHuella, fechaEmision, resolverVerificacion, LARGO_MINIMO_HUELLA } from "@/lib/documentos/cotejo";
import { construirFilaRegistro, CAMPOS_REGISTRADOS } from "@/lib/documentos/fila-registro";
import { FUENTES_VERIFICACION } from "@/lib/documentos/verificacion";
import { TIPO_LEGADO } from "@/lib/documentos/legado-juntos";
import type { Hallazgo, RegistroDocumento } from "@/lib/documentos/tipos";
import { TIPO_FIRMABLE, TIPO_JUNTOS } from "@/lib/juntos/registro-documento";
import type { TipoDocumentoFirmable } from "@/generated/prisma";

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

function verificarIgual(descripcion: string, obtenido: unknown, esperado: unknown) {
  const iguales = JSON.stringify(obtenido) === JSON.stringify(esperado);
  verificar(
    iguales ? descripcion : `${descripcion} → esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(obtenido)}`,
    iguales
  );
}

// ════════════════════════════════════════════════════════════════════════════
// El algoritmo ORIGINAL, copiado tal cual del código anterior al refactor
// (`src/lib/juntos/folio.ts`, `registro-documento.ts` y la ruta de verificación
// antes de moverlos). No se importa: se reimplementa a propósito, porque si se
// importara del mismo sitio que el nuevo, la comparación no probaría nada.
// ════════════════════════════════════════════════════════════════════════════

// El prefijo se tipa `string`, no `PrefijoFolio`: esta función congela el
// ALGORITMO de folio de antes del refactor, y el algoritmo trata el prefijo
// como opaco (solo lo concatena). Atarla al catálogo hizo que ampliar los
// prefijos de 2 a 4 rompiera la compilación de un test que no tenía nada que
// ver con ese cambio.
function generarFolioOriginal(prefijo: string, fecha = new Date()): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${prefijo}-${y}${m}${d}-${randomBytes(3).toString("hex")}`;
}

function hashContenidoOriginal(contenidoSerializado: string, folio: string): string {
  return createHash("sha256").update(contenidoSerializado).update(folio).digest("hex");
}

function hashCortoOriginal(hashCompleto: string): string {
  return hashCompleto.slice(0, 12);
}

const FOLIO_RE_ORIGINAL = /^(JT|DP)-\d{8}-[0-9a-f]{6}$/;
const HUELLA_RE_ORIGINAL = /^[0-9a-f]{8,64}$/;

function normalizarFolioOriginal(crudo: string): string {
  const partes = crudo.trim().split("-");
  if (partes.length !== 3) return crudo.trim();
  return `${partes[0].toUpperCase()}-${partes[1]}-${partes[2].toLowerCase()}`;
}

function cotejarHuellaOriginal(hashGuardado: string, huella?: string | null): boolean | null {
  if (!huella) return null;
  const limpia = huella.trim().toLowerCase();
  return hashGuardado.toLowerCase().startsWith(limpia) && limpia.length >= 8;
}

/** El folio sin sus 6 hex aleatorios: la parte que SÍ es comparable. */
function sinAleatorio(folio: string): string {
  return folio.slice(0, -6);
}

const RAIZ = path.resolve(__dirname, "..");
const DIR_DOCUMENTOS = path.join(RAIZ, "src", "lib", "documentos");

function leer(rutaRelativa: string): string {
  return readFileSync(path.join(RAIZ, rutaRelativa), "utf8");
}

/** Quita comentarios: lo que importa es lo que el código HACE, no lo que dice. */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

console.log("Documentos verificables — módulo compartido\n");

// ════════════════════════════════════════════════════════════════════════════
console.log("1. Folio — mismo valor que antes del refactor para las mismas entradas");
// ════════════════════════════════════════════════════════════════════════════

const FECHAS: Array<{ fecha: Date; prefijo: PrefijoFolio; esperado: string }> = [
  { fecha: new Date(2026, 7, 15, 12, 0, 0), prefijo: "JT", esperado: "JT-20260815-" },
  { fecha: new Date(2026, 0, 1, 0, 0, 0), prefijo: "JT", esperado: "JT-20260101-" },
  { fecha: new Date(2026, 11, 31, 23, 59, 59), prefijo: "DP", esperado: "DP-20261231-" },
  // Mes y día de un solo dígito: el padStart es parte del formato impreso.
  { fecha: new Date(2026, 1, 9, 5, 0, 0), prefijo: "JT", esperado: "JT-20260209-" },
  // Casi medianoche: la fecha es LOCAL. Con UTC este caso se iría al día
  // siguiente en Colombia y el folio no coincidiría con el del documento.
  { fecha: new Date(2026, 7, 15, 23, 59, 59), prefijo: "DP", esperado: "DP-20260815-" },
];

for (const { fecha, prefijo, esperado } of FECHAS) {
  verificarIgual(
    `generarFolio("${prefijo}", ${fecha.toDateString()}) — parte fija`,
    sinAleatorio(generarFolio(prefijo, fecha)),
    esperado
  );
  verificarIgual(
    `generarFolio("${prefijo}", ${fecha.toDateString()}) === algoritmo original`,
    sinAleatorio(generarFolio(prefijo, fecha)),
    sinAleatorio(generarFolioOriginal(prefijo, fecha))
  );
}

verificar(
  "el folio generado cumple el patrón que la consulta acepta",
  PATRON_FOLIO.test(generarFolio("JT")) && FOLIO_RE_ORIGINAL.test(generarFolio("JT"))
);
verificar(
  "la parte aleatoria son 6 hex en minúscula (3 bytes), como siempre",
  /^[0-9a-f]{6}$/.test(generarFolio("DP").slice(-6))
);
verificar(
  "dos folios seguidos no se repiten (la parte aleatoria es aleatoria)",
  generarFolio("JT") !== generarFolio("JT")
);

// ════════════════════════════════════════════════════════════════════════════
console.log("\n2. Huella — valores fijos, calculados ANTES de mover el código");
// ════════════════════════════════════════════════════════════════════════════

/** Vectores congelados: contenido, folio y el SHA-256 exacto que daba antes. */
const VECTORES: Array<{ contenido: string; folio: string; hash: string }> = [
  {
    contenido: '{"a":1}',
    folio: "JT-20260815-a3f9c1",
    hash: "d733bdb6056f19a507d7a97cca32bdacc3b21d5231d43490b4772771103133cf",
  },
  // Mismo folio, UN SOLO BYTE distinto en el contenido.
  {
    contenido: '{"a":2}',
    folio: "JT-20260815-a3f9c1",
    hash: "73974698f32066886ce453d8bdf2c15eb611b27fd9f76ad1ee0d8c30290f6bac",
  },
  // Mismo contenido, UN SOLO BYTE distinto en el folio.
  {
    contenido: '{"a":1}',
    folio: "JT-20260815-a3f9c2",
    hash: "5de49eec196445245646a1e0843a49758c961cf96039e79cd46f63d5a243b590",
  },
  {
    contenido: '{"a":1}',
    folio: "DP-20260815-a3f9c1",
    hash: "ea4da45bc847d30ae8d79ddbf3a1323154e5cc0a65ec6ea9e729fe534ff2ad83",
  },
  {
    contenido: "",
    folio: "JT-20260101-000000",
    hash: "f6963339758d4b98c7d1edd0b83ccf02a0a9e2fc9d7876af11edd2b52995e024",
  },
  // Un payload como los de verdad: lo personal entra en la HUELLA (por eso el
  // documento es cotejable) pero jamás en el registro.
  {
    contenido: '{"identidad":{"ciudad":"Cali"},"espacios":[{"nombre":"Sala"}]}',
    folio: "JT-20260815-0f1e2d",
    hash: "adc26fab5bf2ea437e3e32998bc8c1fec3c999bf1995786c2b2864b8eda840f7",
  },
  // Acentos y guion largo: el encoding tampoco puede haber cambiado.
  {
    contenido: "ñÁé — acentos y guion largo",
    folio: "DP-20261231-ffffff",
    hash: "d64febf2bb3270743afdadcfbeeda95dda882f143809c7aa89fc04ba8587df89",
  },
];

for (const v of VECTORES) {
  verificarIgual(`hashContenido(${JSON.stringify(v.contenido)}, ${v.folio})`, hashContenido(v.contenido, v.folio), v.hash);
  verificar(
    `hashContenido(${JSON.stringify(v.contenido)}, ${v.folio}) === algoritmo original`,
    hashContenido(v.contenido, v.folio) === hashContenidoOriginal(v.contenido, v.folio)
  );
}

console.log("  Un byte distinto cambia la huella — que es lo único que hace útil el sello");
verificar(
  "un byte distinto en el CONTENIDO da otra huella",
  hashContenido(VECTORES[0].contenido, VECTORES[0].folio) !==
    hashContenido(VECTORES[1].contenido, VECTORES[0].folio)
);
verificar(
  "un byte distinto en el FOLIO da otra huella (el folio entra en el hash)",
  hashContenido(VECTORES[0].contenido, VECTORES[0].folio) !==
    hashContenido(VECTORES[0].contenido, VECTORES[2].folio)
);
verificar(
  "un byte cambiado en medio de un payload largo también cambia la huella",
  hashContenido('{"identidad":{"ciudad":"Cali"},"espacios":[{"nombre":"Sala"}]}', "JT-20260815-0f1e2d") !==
    hashContenido('{"identidad":{"ciudad":"Cali"},"espacios":[{"nombre":"Sela"}]}', "JT-20260815-0f1e2d")
);
verificar(
  "la huella CORTA impresa también cambia con un byte distinto",
  hashCorto(hashContenido(VECTORES[0].contenido, VECTORES[0].folio)) !==
    hashCorto(hashContenido(VECTORES[1].contenido, VECTORES[0].folio))
);

console.log("  Huella corta — es la que se imprime en el pie y la que la gente copia");
verificar("LARGO_HUELLA_CORTA sigue siendo 12", LARGO_HUELLA_CORTA === 12);
for (const v of VECTORES) {
  verificar(
    `hashCorto(${v.hash.slice(0, 8)}…) === los 12 primeros hex, igual que el original`,
    hashCorto(v.hash) === v.hash.slice(0, 12) && hashCorto(v.hash) === hashCortoOriginal(v.hash)
  );
}
verificar(
  "la huella completa sigue siendo 64 hex en minúscula",
  VECTORES.every((v) => /^[0-9a-f]{64}$/.test(hashContenido(v.contenido, v.folio)))
);

// ════════════════════════════════════════════════════════════════════════════
console.log("\n3. Formato y normalización — la consulta acepta exactamente lo de siempre");
// ════════════════════════════════════════════════════════════════════════════

const PREFIJOS_JUNTOS: readonly PrefijoFolio[] = ["JT", "DP"];

const FOLIOS_PRUEBA = [
  "JT-20260815-a3f9c1",
  "DP-20261231-ffffff",
  "JT-20260815-A3F9C1", // hex en mayúscula: nunca fue válido
  "jt-20260815-a3f9c1", // prefijo en minúscula: nunca fue válido
  "XX-20260815-a3f9c1", // familia desconocida
  "JT-2026081-a3f9c1", // fecha corta
  "JT-20260815-a3f9c", // aleatorio corto
  "JT-20260815-a3f9c12", // aleatorio largo
  "JT-20260815-a3f9c1 ", // sin normalizar
  "",
  "basura",
];

for (const f of FOLIOS_PRUEBA) {
  verificar(
    `esFolioDeFamilia(${JSON.stringify(f)}) === la expresión regular original`,
    esFolioDeFamilia(f, PREFIJOS_JUNTOS) === FOLIO_RE_ORIGINAL.test(f)
  );
}

console.log("  El patrón compartido es agnóstico de familia; los prefijos los pone cada línea");
verificar(
  "un folio de otra línea cumple el patrón general pero NO es de Juntos",
  PATRON_FOLIO.test("AI-20260830-abc123") && !esFolioDeFamilia("AI-20260830-abc123", PREFIJOS_JUNTOS)
);

const NORMALIZACION: Array<[string, string]> = [
  [" jt-20260815-A3F9C1 ", "JT-20260815-a3f9c1"],
  ["JT-20260815-a3f9c1", "JT-20260815-a3f9c1"],
  ["dp-20261231-FFFFFF", "DP-20261231-ffffff"],
  ["basura", "basura"],
  ["   ", ""],
  ["a-b-c-d", "a-b-c-d"],
];

for (const [crudo, esperado] of NORMALIZACION) {
  verificarIgual(`normalizarFolio(${JSON.stringify(crudo)})`, normalizarFolio(crudo), esperado);
  verificar(
    `normalizarFolio(${JSON.stringify(crudo)}) === algoritmo original`,
    normalizarFolio(crudo) === normalizarFolioOriginal(crudo)
  );
}

verificar(
  "el camino real (copiar el folio del PDF a mano, como sea) sigue pasando el filtro",
  esFolioDeFamilia(normalizarFolio("  jt-20260815-A3F9C1  "), PREFIJOS_JUNTOS)
);

for (const h of ["a1b2c3d4e5f6", "a".repeat(64), "a1b2c3d", "A1B2C3D4", "zzzzzzzz", "", "a".repeat(65)]) {
  verificar(
    `PATRON_HUELLA(${JSON.stringify(h)}) === la expresión regular original`,
    PATRON_HUELLA.test(h) === HUELLA_RE_ORIGINAL.test(h)
  );
}

// ════════════════════════════════════════════════════════════════════════════
console.log("\n4. Cotejo de la huella — mismas respuestas que antes, incluidos los bordes");
// ════════════════════════════════════════════════════════════════════════════

const HASH_FIJO = VECTORES[0].hash;

const HUELLAS: Array<[string | null | undefined, boolean | null, string]> = [
  ["d733bdb6056f", true, "la huella corta impresa en el pie"],
  [HASH_FIJO, true, "la huella completa"],
  ["D733BDB6056F", true, "en mayúsculas (la gente la copia como sea)"],
  ["  d733bdb6056f  ", true, "con espacios alrededor"],
  ["d733bdb6", true, `exactamente el mínimo de ${LARGO_MINIMO_HUELLA} hex`],
  ["d733bdb", false, "un prefijo correcto pero por debajo del mínimo"],
  ["0000000000", false, "una huella que no corresponde"],
  ["", null, "sin huella: no es 'no coincide', es 'no la mandó'"],
  [null, null, "huella nula"],
  [undefined, null, "huella ausente"],
  ["   ", false, "solo espacios"],
];

for (const [huella, esperado, descripcion] of HUELLAS) {
  verificarIgual(`cotejarHuella — ${descripcion}`, cotejarHuella(HASH_FIJO, huella), esperado);
  verificar(
    `cotejarHuella — ${descripcion} === algoritmo original`,
    cotejarHuella(HASH_FIJO, huella) === cotejarHuellaOriginal(HASH_FIJO, huella)
  );
}

verificar(`LARGO_MINIMO_HUELLA sigue siendo 8`, LARGO_MINIMO_HUELLA === 8);
verificarIgual(
  "la fecha de emisión se sigue devolviendo como AAAA-MM-DD",
  fechaEmision(new Date(Date.UTC(2026, 7, 15, 13, 45, 0))),
  "2026-08-15"
);

// ════════════════════════════════════════════════════════════════════════════
console.log("\n5. Histórico — un documento emitido antes del refactor sigue verificando");
// ════════════════════════════════════════════════════════════════════════════

const EMITIDO = new Date(Date.UTC(2026, 7, 15, 13, 45, 0));

function hallado(tipo: TipoDocumentoFirmable, hash = HASH_FIJO): Hallazgo {
  return { estado: "encontrado", documento: { tipo, hash, emitido: EMITIDO } };
}
const AUSENTE: Hallazgo = { estado: "ausente" };
const INDISPONIBLE: Hallazgo = { estado: "indisponible" };

verificarIgual(
  "documento nuevo (está en documentos_firmables)",
  resolverVerificacion([hallado("ACTA_DANOS")], null),
  { existe: true, tipo: "ACTA_DANOS", emitido: "2026-08-15", huellaCoincide: null }
);
verificarIgual(
  "documento VIEJO: no está en la tabla nueva pero sí en la vieja → sigue verificando",
  resolverVerificacion([AUSENTE, hallado("INFORME_GRIETAS")], "d733bdb6056f"),
  { existe: true, tipo: "INFORME_GRIETAS", emitido: "2026-08-15", huellaCoincide: true }
);
verificarIgual(
  "ninguna de las dos tablas lo tiene → no existe",
  resolverVerificacion([AUSENTE, AUSENTE], null),
  { existe: false }
);
verificarIgual(
  "la tabla nueva no responde pero la vieja lo tiene → existe (encontrarlo manda)",
  resolverVerificacion([INDISPONIBLE, hallado("DERECHO_PETICION")], null),
  { existe: true, tipo: "DERECHO_PETICION", emitido: "2026-08-15", huellaCoincide: null }
);
verificarIgual(
  "una tabla no responde y la otra no lo tiene → indisponible, NUNCA 'no existe'",
  resolverVerificacion([INDISPONIBLE, AUSENTE], null),
  { indisponible: true }
);
verificarIgual(
  "la tabla vieja no responde y la nueva no lo tiene → indisponible",
  resolverVerificacion([AUSENTE, INDISPONIBLE], null),
  { indisponible: true }
);
verificarIgual(
  "ninguna tabla responde → indisponible",
  resolverVerificacion([INDISPONIBLE, INDISPONIBLE], null),
  { indisponible: true }
);
verificarIgual(
  "existe pero la huella no cuadra → se dice, no se calla",
  resolverVerificacion([hallado("ACTA_DANOS")], "0000000000"),
  { existe: true, tipo: "ACTA_DANOS", emitido: "2026-08-15", huellaCoincide: false }
);

console.log("  Las dos fuentes están declaradas, en orden, y la vieja se quita borrando una línea");
verificar("la verificación consulta exactamente 2 fuentes", FUENTES_VERIFICACION.length === 2);
verificarIgual(
  "orden de las fuentes: primero la tabla nueva, después la vieja",
  FUENTES_VERIFICACION.map((f) => f.name),
  ["buscarEnDocumentosFirmables", "buscarEnDocumentosJuntos"]
);
verificar(
  "la fuente vieja vive en su propio archivo, para poder borrarla entera",
  readdirSync(DIR_DOCUMENTOS).includes("legado-juntos.ts")
);
verificar(
  "la fuente vieja está marcada como LEGADO en el punto donde se declara",
  /buscarEnDocumentosJuntos,\s*\/\/\s*LEGADO/.test(leer("src/lib/documentos/verificacion.ts"))
);

console.log("  Traducción de tipos: lo viejo se lee, y lo de otras líneas no se filtra");
verificarIgual("tipo viejo ACTA se lee como ACTA_DANOS", TIPO_LEGADO.ACTA, "ACTA_DANOS");
verificarIgual("tipo viejo INFORME se lee como INFORME_GRIETAS", TIPO_LEGADO.INFORME, "INFORME_GRIETAS");
verificarIgual("tipo viejo PETICION se lee como DERECHO_PETICION", TIPO_LEGADO.PETICION, "DERECHO_PETICION");
verificar(
  "el mapa de lectura del legado y el que usa Juntos hoy siguen de acuerdo",
  JSON.stringify(TIPO_LEGADO) === JSON.stringify(TIPO_FIRMABLE)
);
for (const tipo of ["ACTA", "INFORME", "PETICION"] as const) {
  verificarIgual(`ida y vuelta ${tipo} → firmable → ${tipo}`, TIPO_JUNTOS[TIPO_FIRMABLE[tipo]], tipo);
}
verificar(
  "un documento de otra línea NO se traduce a un tipo de Juntos (no se filtra por esta consulta)",
  TIPO_JUNTOS.ACTA_ESTADO_INICIAL === undefined && TIPO_JUNTOS.INFORME_TECNICO === undefined
);

// ════════════════════════════════════════════════════════════════════════════
console.log("\n6. Privacidad — al registro no llega ni un dato personal");
// ════════════════════════════════════════════════════════════════════════════

/**
 * Lo que NUNCA puede aparecer en el registro. La cédula y la dirección tienen
 * además una promesa explícita en pantalla de que no se guardan.
 */
const PROHIBIDOS = [
  "nombre",
  "apellido",
  "cedula",
  "cédula",
  "documento_identidad",
  "direccion",
  "dirección",
  "telefono",
  "teléfono",
  "celular",
  "whatsapp",
  "correo",
  "email",
  "foto",
];

const VALORES_PERSONALES = {
  nombre: "María Pérez Gutiérrez",
  cedula: "1144055123",
  direccion: "Calle 5 #10-20, Cali",
  telefono: "3001234567",
  email: "maria@example.com",
  fotos: ["data:image/jpeg;base64,AAAAQUJD"],
  coordenadas: { lat: 3.4516, lng: -76.532 },
};

// Un llamador descuidado que pega el payload entero encima de lo que sí toca.
const ENTRADA_CONTAMINADA = {
  folio: "JT-20260815-a3f9c1",
  hash: HASH_FIJO,
  tipo: "ACTA_DANOS",
  ciudad: "  Cali  ",
  nivel: null,
  piezas: 3,
  ...VALORES_PERSONALES,
} as unknown as RegistroDocumento;

const fila = construirFilaRegistro(ENTRADA_CONTAMINADA);
const filaSerializada = JSON.stringify(fila).toLowerCase();

verificarIgual(
  "la fila escrita tiene EXACTAMENTE los campos declarados, ni uno más",
  Object.keys(fila).sort(),
  [...CAMPOS_REGISTRADOS].sort()
);
verificar(
  "ninguna clave de la fila es un dato personal",
  Object.keys(fila).every((k) => !PROHIBIDOS.some((p) => k.toLowerCase().includes(p)))
);
for (const [campo, valor] of Object.entries(VALORES_PERSONALES)) {
  const rastro = typeof valor === "string" ? valor.toLowerCase() : JSON.stringify(valor).toLowerCase();
  verificar(`«${campo}» no deja rastro en la fila aunque venga en la entrada`, !filaSerializada.includes(rastro));
}
verificar(
  "el objeto que se persiste no arrastra claves extra por referencia",
  Object.keys(fila).length === CAMPOS_REGISTRADOS.length
);
verificarIgual(
  "lo que sí se guarda se guarda bien: ciudad normalizada, nivel y piezas",
  { ciudad: fila.ciudad, nivel: fila.nivel, piezas: fila.piezas, tipo: fila.tipo },
  { ciudad: "Cali", nivel: null, piezas: 3, tipo: "ACTA_DANOS" }
);
verificarIgual(
  "sin proyecto ni constructora (línea Juntos) las columnas quedan nulas, no vacías",
  { proyecto_id: fila.proyecto_id, constructora_id: fila.constructora_id },
  { proyecto_id: null, constructora_id: null }
);

const filaMinima = construirFilaRegistro({ folio: "DP-20260815-a3f9c1", hash: HASH_FIJO, tipo: "DERECHO_PETICION" });
verificarIgual(
  "con lo mínimo indispensable, el resto queda en null (nunca undefined)",
  filaMinima,
  {
    folio: "DP-20260815-a3f9c1",
    hash: HASH_FIJO,
    tipo: "DERECHO_PETICION",
    ciudad: null,
    nivel: null,
    piezas: null,
    proyecto_id: null,
    constructora_id: null,
  }
);
verificarIgual(
  "una ciudad de una sola letra no se guarda (ruido, no dato)",
  construirFilaRegistro({ folio: "x", hash: "y", tipo: "ACTA_DANOS", ciudad: "C" }).ciudad,
  null
);

console.log("  Y el código, no solo el resultado: nada en estos módulos escribe un campo personal");
const FUENTES_A_REVISAR = [
  ...readdirSync(DIR_DOCUMENTOS)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `src/lib/documentos/${f}`),
  "src/lib/juntos/registro-documento.ts",
];
for (const archivo of FUENTES_A_REVISAR) {
  const codigo = sinComentarios(leer(archivo)).toLowerCase();
  const encontrados = PROHIBIDOS.filter((p) => codigo.includes(p));
  verificar(
    encontrados.length === 0
      ? `${archivo} no menciona ningún dato personal fuera de los comentarios`
      : `${archivo} menciona datos personales en el código: ${encontrados.join(", ")}`,
    encontrados.length === 0
  );
}
verificar(
  "la fila se construye campo por campo, sin spread del objeto de entrada",
  !/\.\.\.\s*datos/.test(sinComentarios(leer("src/lib/documentos/fila-registro.ts")))
);

// ════════════════════════════════════════════════════════════════════════════
console.log("\n7. Desacople — el módulo compartido no sabe que Juntos existe");
// ════════════════════════════════════════════════════════════════════════════

const ARCHIVOS_DOCUMENTOS = readdirSync(DIR_DOCUMENTOS).filter((f) => f.endsWith(".ts"));
verificar("el módulo compartido existe y tiene archivos", ARCHIVOS_DOCUMENTOS.length > 0);

for (const archivo of ARCHIVOS_DOCUMENTOS) {
  const fuente = leer(`src/lib/documentos/${archivo}`);
  verificar(
    `src/lib/documentos/${archivo} no importa ni menciona el módulo de Juntos`,
    !fuente.includes("lib/juntos") && !/from\s+["'][^"']*juntos\//.test(fuente)
  );
}

verificar(
  "la dependencia va al revés: Juntos sí importa el módulo compartido",
  leer("src/lib/juntos/registro-documento.ts").includes("@/lib/documentos") &&
    leer("src/lib/juntos/folio.ts").includes("@/lib/documentos")
);
verificar(
  "Juntos ya no tiene su propia copia del algoritmo (createHash / randomBytes)",
  !/createHash|randomBytes/.test(leer("src/lib/juntos/folio.ts"))
);
verificar(
  "Juntos ya no escribe directamente en la base: delega en el módulo compartido",
  !/prisma\./.test(leer("src/lib/juntos/registro-documento.ts"))
);
verificar(
  "los documentos nuevos se registran en documentos_firmables",
  /prisma\.documentoFirmable\.create/.test(leer("src/lib/documentos/registro.ts"))
);

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Módulo de documentos verificables comprobado sin errores.");
