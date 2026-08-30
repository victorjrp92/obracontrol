/**
 * Guardia de seguridad de la superficie nueva: RLS, aislamiento de las rutas,
 * privacidad de la línea Juntos y validación de las subidas.
 *
 * Comprueba, SIN base de datos, cinco cosas que hoy solo sostiene la disciplina
 * de quien escribe el código:
 *
 *   1. Toda tabla creada DESPUÉS del barrido de RLS nace con
 *      `ENABLE ROW LEVEL SECURITY` en su propia migración. El barrido de
 *      `20260815140000_rls_todas_las_tablas` cerró las 41 que existían aquel
 *      día recorriendo `pg_tables`; una tabla creada después NO la toca, así
 *      que queda publicada por PostgREST con la llave que viaja en el HTML.
 *   2. Ninguna ruta API nueva omite `requireUser()`. Las dos excepciones
 *      públicas están declaradas Y se comprueban por lo que hacen (freno por
 *      IP, familia de folio, token como única fuente del proyecto), no por
 *      estar en una lista.
 *   3. La cédula y la dirección no son columnas de las tablas de Juntos. Es la
 *      promesa explícita de la línea: viajan en la petición del PDF, se
 *      imprimen y se descartan.
 *   4. Ningún `console.*` serializa el cuerpo de una petición. Un `console.error
 *      ("...", body)` en una ruta de Juntos manda la cédula y la dirección a
 *      los logs del proveedor, que es exactamente lo que se prometió no hacer.
 *   5. La subida valida TIPO (por los primeros bytes) y TAMAÑO en el servidor,
 *      no en el cliente. Se ejecuta el código real contra cabeceras fabricadas.
 *
 * CONTROL POSITIVO. Cada comprobación se corre además contra una entrada rota a
 * propósito, y se exige que la marque. Un guardia que no puede fallar no es un
 * guardia: en este mismo trabajo aparecieron cinco oráculos ciegos, dos de ellos
 * en verde sin comprobar absolutamente nada.
 *
 * Uso: `npx tsx scripts/verificar-rls.ts`. Sale con código 1 si algo falla.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { formatoDeFirma, extensionCoincideConFormato } from "@/lib/documentos/perfil-firma";
import { detectarFormato, validarArchivo, BYTES_CABECERA } from "@/lib/productos-tecnicos/formatos";
import { verificarTamanoArchivo, MAX_BYTES_POR_ARCHIVO } from "@/lib/productos-tecnicos/cupo";

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

function verificarLanza(descripcion: string, fn: () => void) {
  total++;
  try {
    fn();
    fallos++;
    console.error(`  FAIL ${descripcion} (no lanzó)`);
  } catch {
    console.log(`  OK   ${descripcion}`);
  }
}

function verificarNoLanza(descripcion: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  OK   ${descripcion}`);
  } catch (err) {
    fallos++;
    console.error(`  FAIL ${descripcion} (lanzó: ${err instanceof Error ? err.message : err})`);
  }
}

function recorrer(dir: string, filtro: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return recorrer(p, filtro);
    return filtro.test(p) ? [p] : [];
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · RLS en toda tabla nueva
// ═════════════════════════════════════════════════════════════════════════════
//
// El barrido cerró de una vez todas las tablas que existían. La regla que hay
// que sostener a partir de ahí es puntual: si una migración POSTERIOR crea una
// tabla, esa misma migración (o una posterior) tiene que activarle RLS.

console.log("1 — RLS: toda tabla nueva nace cerrada\n");

interface Migracion {
  nombre: string;
  sql: string;
}

const DIR_MIGRACIONES = "prisma/migrations";

function leerMigraciones(): Migracion[] {
  return readdirSync(DIR_MIGRACIONES)
    .filter((d) => statSync(join(DIR_MIGRACIONES, d)).isDirectory())
    .sort()
    .map((nombre) => ({
      nombre,
      // `rollback.sql` NO se lee: describe cómo deshacer, y contarlo como parte
      // de la migración haría pasar por «cerrada» una tabla que solo aparece en
      // el guion de vuelta atrás.
      sql: readFileSync(join(DIR_MIGRACIONES, nombre, "migration.sql"), "utf8"),
    }));
}

/** ¿Esta migración cierra TODAS las tablas del esquema de una pasada? */
export function esBarridoDeRls(sql: string): boolean {
  return (
    /FROM\s+pg_tables/i.test(sql) &&
    /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql) &&
    /LOOP/i.test(sql)
  );
}

/** Tablas que una migración CREA. */
export function tablasCreadas(sql: string): string[] {
  return [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi)].map(
    (m) => m[1],
  );
}

/**
 * Tablas a las que una migración ACTIVA RLS de forma explícita.
 *
 * `IF EXISTS` cuenta: es la forma idempotente de cerrar una tabla que pudo
 * entrar por `db push` y que puede no estar todavía en este entorno.
 */
export function tablasConRlsExplicito(sql: string): string[] {
  return [
    ...sql.matchAll(
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?"([^"]+)"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi,
    ),
  ].map((m) => m[1]);
}

/**
 * Tablas creadas después del barrido que se quedaron sin RLS.
 *
 * Devuelve la lista de infractoras: vacía significa que la regla se cumple.
 */
export function tablasNuevasSinRls(migraciones: readonly Migracion[]): string[] {
  const indiceBarrido = migraciones.findIndex((m) => esBarridoDeRls(m.sql));
  if (indiceBarrido < 0) {
    // Sin barrido no hay línea de corte: TODA tabla necesita RLS explícito.
    // Es el caso conservador a propósito.
    return migraciones
      .flatMap((m) => tablasCreadas(m.sql))
      .filter((t) => !migraciones.some((m) => tablasConRlsExplicito(m.sql).includes(t)));
  }

  const posteriores = migraciones.slice(indiceBarrido + 1);
  const cerradasDespues = new Set(posteriores.flatMap((m) => tablasConRlsExplicito(m.sql)));

  const infractoras: string[] = [];
  for (const m of posteriores) {
    for (const tabla of tablasCreadas(m.sql)) {
      if (!cerradasDespues.has(tabla)) infractoras.push(`${tabla} (${m.nombre})`);
    }
  }
  return infractoras;
}

const MIGRACIONES = leerMigraciones();

verificar(
  "existe la migración de barrido que cerró las tablas anteriores",
  MIGRACIONES.some((m) => esBarridoDeRls(m.sql)),
);

const sinRls = tablasNuevasSinRls(MIGRACIONES);
verificar(
  sinRls.length === 0
    ? "ninguna tabla creada tras el barrido se quedó sin ENABLE ROW LEVEL SECURITY"
    : `tablas nuevas sin RLS: ${sinRls.join(", ")}`,
  sinRls.length === 0,
);

// Las dos tablas de esta tanda, nombradas: si alguien renombra la migración o
// borra la línea, esto lo dice con el nombre de la tabla y no con un conteo.
const SQL_TODAS = MIGRACIONES.map((m) => m.sql).join("\n");
for (const tabla of ["productos_tecnicos", "documentos_firmables"]) {
  verificar(
    `${tabla} se crea y se cierra con RLS en la misma tanda`,
    tablasCreadas(SQL_TODAS).includes(tabla) && tablasConRlsExplicito(SQL_TODAS).includes(tabla),
  );
}

/** Los nombres de tabla del esquema (`@@map("…")`). */
export function tablasDelEsquema(schema: string): string[] {
  return [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);
}

/**
 * Tablas del esquema sobre las que NADA garantiza RLS.
 *
 * Hay dos formas de estar cubierta, y solo dos:
 *   · nacer antes del barrido, que las cerró recorriendo `pg_tables`;
 *   · tener un `ENABLE ROW LEVEL SECURITY` propio en alguna migración.
 *
 * Una tabla que solo existe en `schema.prisma` —creada con `prisma db push`, sin
 * migración— no cumple ninguna de las dos: si un `db push` la recrea después del
 * barrido, queda abierta. Es exactamente lo que pasaba con `audit_logs`,
 * `mensajes_contacto` y `consentimientos_datos` antes de
 * `20260830120000_rls_tablas_sin_migracion`.
 */
export function tablasDelEsquemaSinGarantiaDeRls(
  schema: string,
  migraciones: readonly Migracion[],
): string[] {
  const indiceBarrido = migraciones.findIndex((m) => esBarridoDeRls(m.sql));
  const creadasAntesDelBarrido = new Set(
    (indiceBarrido < 0 ? [] : migraciones.slice(0, indiceBarrido + 1)).flatMap((m) =>
      tablasCreadas(m.sql),
    ),
  );
  const conRlsExplicito = new Set(migraciones.flatMap((m) => tablasConRlsExplicito(m.sql)));

  return tablasDelEsquema(schema).filter(
    (t) => !creadasAntesDelBarrido.has(t) && !conRlsExplicito.has(t),
  );
}

const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");
const TABLAS_ESQUEMA = tablasDelEsquema(SCHEMA);
const sinGarantia = tablasDelEsquemaSinGarantiaDeRls(SCHEMA, MIGRACIONES);

verificar(
  sinGarantia.length === 0
    ? `las ${TABLAS_ESQUEMA.length} tablas del esquema tienen RLS garantizado (barrido o ALTER propio)`
    : `tablas del esquema sin garantía de RLS: ${sinGarantia.join(", ")}`,
  sinGarantia.length === 0,
);

// Las tres que entraron por `db push` y no tenían migración: se nombran para que
// un borrado de la migración defensiva salga con su nombre, no con un conteo.
for (const tabla of ["audit_logs", "mensajes_contacto", "consentimientos_datos"]) {
  verificar(
    `${tabla} (sin CREATE TABLE en ninguna migración) tiene ALTER … ENABLE ROW LEVEL SECURITY propio`,
    !tablasCreadas(SQL_TODAS).includes(tabla) && tablasConRlsExplicito(SQL_TODAS).includes(tabla),
  );
}

console.log("\n  Control positivo — el detector de RLS tiene que poder fallar");

const BARRIDO_FALSO: Migracion = {
  nombre: "20260101000000_barrido",
  sql: `DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename); END LOOP; END $$;`,
};

verificar(
  "una tabla creada tras el barrido SIN RLS se marca",
  tablasNuevasSinRls([
    BARRIDO_FALSO,
    { nombre: "20260202000000_nueva", sql: `CREATE TABLE "tabla_olvidada" ("id" TEXT NOT NULL);` },
  ]).length === 1,
);
verificar(
  "…y con RLS en la misma migración NO se marca",
  tablasNuevasSinRls([
    BARRIDO_FALSO,
    {
      nombre: "20260202000000_nueva",
      sql: `CREATE TABLE "tabla_cerrada" ("id" TEXT NOT NULL);
            ALTER TABLE "tabla_cerrada" ENABLE ROW LEVEL SECURITY;`,
    },
  ]).length === 0,
);
verificar(
  "…y con RLS en una migración POSTERIOR tampoco se marca",
  tablasNuevasSinRls([
    BARRIDO_FALSO,
    { nombre: "20260202000000_nueva", sql: `CREATE TABLE "tabla_tardia" ("id" TEXT NOT NULL);` },
    { nombre: "20260303000000_cierre", sql: `ALTER TABLE "tabla_tardia" ENABLE ROW LEVEL SECURITY;` },
  ]).length === 0,
);
verificar(
  "una tabla creada ANTES del barrido no necesita RLS explícito",
  tablasNuevasSinRls([
    { nombre: "20250101000000_init", sql: `CREATE TABLE "tabla_vieja" ("id" TEXT NOT NULL);` },
    BARRIDO_FALSO,
  ]).length === 0,
);
verificar(
  "sin migración de barrido, TODA tabla sin RLS se marca",
  tablasNuevasSinRls([
    { nombre: "20250101000000_init", sql: `CREATE TABLE "tabla_vieja" ("id" TEXT NOT NULL);` },
  ]).length === 1,
);
verificar(
  "el barrido se reconoce por lo que hace, no por su nombre",
  !esBarridoDeRls(`ALTER TABLE "una_sola" ENABLE ROW LEVEL SECURITY;`),
);
verificar(
  "una tabla que solo existe en el esquema (db push) se marca sin garantía",
  tablasDelEsquemaSinGarantiaDeRls(`model X {\n  @@map("solo_en_esquema")\n}`, [BARRIDO_FALSO])
    .length === 1,
);
verificar(
  "…y con un ALTER … ENABLE propio deja de marcarse",
  tablasDelEsquemaSinGarantiaDeRls(`model X {\n  @@map("solo_en_esquema")\n}`, [
    BARRIDO_FALSO,
    {
      nombre: "20260303000000_cierre",
      sql: `ALTER TABLE IF EXISTS "solo_en_esquema" ENABLE ROW LEVEL SECURITY;`,
    },
  ]).length === 0,
);
verificar(
  "`ALTER TABLE IF EXISTS` cuenta como RLS explícito",
  tablasConRlsExplicito(`ALTER TABLE IF EXISTS "t" ENABLE ROW LEVEL SECURITY;`).includes("t"),
);
verificar(
  "un DROP … DISABLE ROW LEVEL SECURITY no cuenta como cierre",
  !tablasConRlsExplicito(`ALTER TABLE "t" DISABLE ROW LEVEL SECURITY;`).includes("t"),
);

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Ninguna ruta API nueva sin requireUser()
// ═════════════════════════════════════════════════════════════════════════════

console.log("\n2 — Aislamiento: toda ruta nueva empieza por requireUser()\n");

/**
 * Las dos rutas públicas POR DISEÑO, y por qué cada una lo es.
 *
 * Estar en esta lista NO exime de nada: cada una tiene abajo su propia
 * comprobación de comportamiento. Una lista sin eso sería la forma más rápida
 * de convertir este guardia en un sello de goma.
 */
const PUBLICAS_DECLARADAS: Record<string, string> = {
  "src/app/api/documentos/verificar/route.ts":
    "consulta pública de un folio: quien la usa es una aseguradora o un juzgado con el PDF en la mano",
  "src/app/api/documentos/c/[token]/[folio]/recibido/route.ts":
    "el cliente no tiene cuenta: la credencial es el token del enlace",
};

const DIRS_NUEVOS = ["src/app/api/productos-tecnicos", "src/app/api/documentos"];

interface Archivo {
  ruta: string;
  texto: string;
}

function leerArchivos(rutas: readonly string[]): Archivo[] {
  return rutas.map((ruta) => ({ ruta, texto: readFileSync(ruta, "utf8") }));
}

/** Rutas que ni llaman a `requireUser()` ni están declaradas públicas. */
export function rutasSinGuarda(
  archivos: readonly Archivo[],
  declaradas: Readonly<Record<string, unknown>>,
): string[] {
  return archivos
    .filter((a) => !/\brequireUser\s*\(/.test(a.texto))
    .filter((a) => !(a.ruta.split("\\").join("/") in declaradas))
    .map((a) => a.ruta);
}

const RUTAS_NUEVAS = DIRS_NUEVOS.flatMap((d) => recorrer(d, /route\.ts$/)).map((r) =>
  r.split("\\").join("/"),
);
const ARCHIVOS_RUTAS = leerArchivos(RUTAS_NUEVAS);

verificar(
  `se encontraron rutas nuevas que auditar (${RUTAS_NUEVAS.length})`,
  RUTAS_NUEVAS.length >= 10,
);

const desprotegidas = rutasSinGuarda(ARCHIVOS_RUTAS, PUBLICAS_DECLARADAS);
verificar(
  desprotegidas.length === 0
    ? "ninguna ruta nueva omite requireUser() sin estar declarada pública"
    : `rutas sin requireUser(): ${desprotegidas.join(", ")}`,
  desprotegidas.length === 0,
);

// Las declaradas tienen que existir de verdad: una entrada que apunta a un
// fichero borrado deja de tapar nada y nadie se entera.
for (const ruta of Object.keys(PUBLICAS_DECLARADAS)) {
  verificar(`la excepción declarada ${ruta} existe`, existsSync(ruta));
}

const textoVerificar = readFileSync("src/app/api/documentos/verificar/route.ts", "utf8");
verificar(
  "la verificación pública lleva freno por IP",
  /permitirPeticion\s*\(/.test(textoVerificar) && /claveDesdeHeaders\s*\(/.test(textoVerificar),
);
verificar(
  "la verificación pública solo responde por su familia de folios",
  /esFolioDeFamilia\s*\(/.test(textoVerificar) &&
    /PREFIJOS_PROFESIONAL/.test(textoVerificar),
);
verificar(
  "la verificación pública no devuelve la fila: pasa por verificarDocumento()",
  /verificarDocumento\s*\(/.test(textoVerificar) && !/prisma\./.test(textoVerificar),
);

const textoRecibido = readFileSync(
  "src/app/api/documentos/c/[token]/[folio]/recibido/route.ts",
  "utf8",
);
verificar(
  "el «recibido conforme» valida el token antes de nada",
  /validarClienteToken\s*\(/.test(textoRecibido),
);
verificar(
  "…y el proyecto sale del TOKEN, nunca del cuerpo ni de la URL",
  !/proyecto_id/.test(textoRecibido) && /valido\.proyectoId/.test(textoRecibido),
);
verificar(
  "…y el folio se filtra por familia antes de tocar la base",
  /esFolioDeFamilia\s*\(/.test(textoRecibido),
);

// El aislamiento de fondo: la vista del cliente se construye por proyección
// explícita y el acotado pasa por `asegurarEnAlcance`.
const textoVista = readFileSync("src/lib/documentos/vista-cliente.ts", "utf8");
verificar(
  "la vista del cliente no devuelve la fila entera (sin spread del documento)",
  !/\.\.\.doc\b/.test(textoVista),
);
verificar(
  "…y no publica proyecto_id, constructora_id ni firmado_por_id",
  !/proyecto_id:/.test(textoVista) &&
    !/constructora_id:/.test(textoVista) &&
    !/firmado_por_id:/.test(textoVista),
);

// El listado de productos técnicos no puede filtrar la ruta del bucket.
const textoConsultas = readFileSync("src/lib/productos-tecnicos/consultas.ts", "utf8");
const bloqueCamposPublicos = textoConsultas.slice(
  textoConsultas.indexOf("CAMPOS_PUBLICOS = {"),
  textoConsultas.indexOf("} satisfies"),
);
verificar(
  "storage_path NO está en CAMPOS_PUBLICOS: no sale en ningún listado",
  bloqueCamposPublicos.length > 0 && !/storage_path/.test(bloqueCamposPublicos),
);

console.log("\n  Control positivo — el detector de rutas tiene que poder fallar");

verificar(
  "una ruta sin requireUser() ni declarar se marca",
  rutasSinGuarda(
    [{ ruta: "src/app/api/inventada/route.ts", texto: "export async function GET() {}" }],
    {},
  ).length === 1,
);
verificar(
  "…con requireUser() no se marca",
  rutasSinGuarda(
    [
      {
        ruta: "src/app/api/inventada/route.ts",
        texto: "const ctx = await requireUser();",
      },
    ],
    {},
  ).length === 0,
);
verificar(
  "…y declarada pública tampoco",
  rutasSinGuarda([{ ruta: "src/app/api/publica/route.ts", texto: "" }], {
    "src/app/api/publica/route.ts": "declarada",
  }).length === 0,
);
verificar(
  "un comentario que MENCIONA requireUser no cuenta como llamada",
  rutasSinGuarda(
    [{ ruta: "src/app/api/x/route.ts", texto: "// aquí iría requireUser sin paréntesis" }],
    {},
  ).length === 1,
);

// ═════════════════════════════════════════════════════════════════════════════
// 3 · La cédula y la dirección no se persisten en la línea Juntos
// ═════════════════════════════════════════════════════════════════════════════

console.log("\n3 — Privacidad: la cédula y la dirección nunca llegan a una tabla\n");

/** El cuerpo de un `model X { … }` del esquema, o `null` si no está. */
export function cuerpoDeModelo(schema: string, modelo: string): string | null {
  const inicio = schema.indexOf(`model ${modelo} {`);
  if (inicio < 0) return null;
  const fin = schema.indexOf("\n}", inicio);
  return fin < 0 ? null : schema.slice(inicio, fin);
}

/** Nombres de columna prohibidos que aparecen en el cuerpo de un modelo. */
export function columnasProhibidas(cuerpo: string, prohibidas: readonly RegExp[]): string[] {
  // Solo las líneas de CAMPO: los comentarios de este esquema NOMBRAN la cédula
  // y la dirección para explicar por qué no están, y contarlos daría un fallo
  // permanente por leer prosa.
  const campos = cuerpo
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("/") && !l.startsWith("*"))
    .map((l) => l.split(/\s+/)[0]);
  return campos.filter((c) => prohibidas.some((p) => p.test(c)));
}

/** Lo que la promesa de Juntos dice que NUNCA se guarda. */
const PROHIBIDAS_JUNTOS: readonly RegExp[] = [
  /^cedula/i,
  /^c[eé]dula/i,
  /^documento_identidad/i,
  /^direccion/i,
  /^direcci[oó]n/i,
  /^foto/i,
  /^fotos/i,
  /^imagen/i,
];

for (const modelo of ["ContactoJuntos", "DocumentoJuntos", "DocumentoFirmable"]) {
  const cuerpo = cuerpoDeModelo(SCHEMA, modelo);
  verificar(`el modelo ${modelo} existe en el esquema`, cuerpo !== null);
  if (!cuerpo) continue;
  const malas = columnasProhibidas(cuerpo, PROHIBIDAS_JUNTOS);
  verificar(
    malas.length === 0
      ? `${modelo} no tiene columnas de cédula, dirección ni fotos`
      : `${modelo} persiste: ${malas.join(", ")}`,
    malas.length === 0,
  );
}

/**
 * Quita comentarios de bloque y de línea. Un guardia que busca una cadena
 * prohibida dentro de un comentario marca como infracción justo la línea que
 * documenta la regla — y entrena a quien lo lea a ignorar el fallo.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}


// La escritura del registro enumera campo por campo. Un spread aquí metería el
// cuerpo entero de la petición del PDF —cédula y dirección incluidas— en la
// tabla, y ningún tipo lo impediría.
// Se quitan los comentarios antes de buscar: el propio archivo documenta la
// regla escribiendo «NUNCA `...datos`», y buscarla en el comentario marcaba
// como infracción la frase que la prohíbe.
const textoFila = sinComentarios(
  readFileSync("src/lib/documentos/fila-registro.ts", "utf8")
);
verificar(
  "construirFilaRegistro no hace spread de su entrada",
  !/\.\.\.datos\b/.test(textoFila),
);
verificar(
  "…y no escribe ningún campo de identidad",
  columnasProhibidas(
    textoFila.slice(textoFila.indexOf("export function construirFilaRegistro")),
    PROHIBIDAS_JUNTOS,
  ).length === 0,
);

console.log("\n  Control positivo — el detector de columnas tiene que poder fallar");

verificar(
  "un modelo con `cedula String` se marca",
  columnasProhibidas(
    `model Falso {\n  id String @id\n  cedula String\n`,
    PROHIBIDAS_JUNTOS,
  ).length === 1,
);
verificar(
  "un modelo con `direccion String?` se marca",
  columnasProhibidas(
    `model Falso {\n  id String @id\n  direccion String?\n`,
    PROHIBIDAS_JUNTOS,
  ).length === 1,
);
verificar(
  "un modelo con `fotos Json` se marca",
  columnasProhibidas(`model Falso {\n  fotos Json\n`, PROHIBIDAS_JUNTOS).length === 1,
);
verificar(
  "un COMENTARIO que nombra la cédula NO se marca (si no, el guardia lee prosa)",
  columnasProhibidas(
    `model Falso {\n  // la cedula y la direccion nunca se guardan\n  id String @id\n`,
    PROHIBIDAS_JUNTOS,
  ).length === 0,
);
verificar(
  "un campo legítimo como `ciudad` NO se marca",
  columnasProhibidas(`model Falso {\n  ciudad String?\n`, PROHIBIDAS_JUNTOS).length === 0,
);
verificar(
  "cuerpoDeModelo no se lleva por delante el modelo siguiente",
  (cuerpoDeModelo(`model A {\n  id String\n}\n\nmodel B {\n  cedula String\n}\n`, "A") ?? "").includes(
    "cedula",
  ) === false,
);

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Ningún log serializa el cuerpo de una petición
// ═════════════════════════════════════════════════════════════════════════════

console.log("\n4 — Logs: ningún console.* manda el cuerpo de la petición al proveedor\n");

/**
 * Nombres con los que el cuerpo de una petición viaja en este repo. Un
 * `console.error("...", body)` en una ruta de Juntos escribe la cédula y la
 * dirección en los logs de Vercel — que es persistirlas, solo que en otro sitio.
 */
const NOMBRES_DE_CUERPO = [
  "body",
  "cuerpo",
  "payload",
  "formData",
  "formulario",
  "datosPersonales",
  "entrada",
];

/** Llamadas a `console.*` que pasan el cuerpo de la petición. */
export function logsQueSerializanCuerpo(archivos: readonly Archivo[]): string[] {
  const hallazgos: string[] = [];
  const patron = new RegExp(
    `console\\.(?:log|warn|error|info|debug|trace)\\s*\\(([^;]*?)\\)\\s*;`,
    "gs",
  );
  for (const a of archivos) {
    for (const m of a.texto.matchAll(patron)) {
      const args = m[1];
      for (const nombre of NOMBRES_DE_CUERPO) {
        // Como identificador suelto o como `JSON.stringify(body)`.
        if (new RegExp(`(^|[^\\w.])${nombre}\\b`).test(args)) {
          hallazgos.push(`${a.ruta}: console con «${nombre}»`);
        }
      }
    }
  }
  return hallazgos;
}

/**
 * Rutas atadas a la promesa de Juntos: por su cuerpo viajan la cédula, la
 * dirección y las fotos. Aquí un `console.*` solo puede llevar un literal.
 */
export function logsConMasDeUnArgumento(archivos: readonly Archivo[]): string[] {
  const hallazgos: string[] = [];
  for (const a of archivos) {
    for (const m of a.texto.matchAll(/console\.(?:log|warn|error|info|debug)\s*\(([^;]*?)\)\s*;/g)) {
      const args = m[1].trim();
      const empiezaPorLiteral = /^["'`]/.test(args);
      // Una coma FUERA de la cadena literal significa un segundo argumento.
      const soloUnLiteral = /^(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1$/.test(args);
      // Una plantilla con interpolación pasa el test de «un solo literal» y sin
      // embargo `console.error(`fallo ${cuerpo.cedula}`)` filtra la cédula igual
      // que un segundo argumento. Interpolar es concatenar.
      const interpola = args.startsWith("`") && /\$\{/.test(args);
      if (!empiezaPorLiteral || !soloUnLiteral || interpola) {
        hallazgos.push(`${a.ruta}: console con más de un literal → «${args.slice(0, 60)}»`);
      }
    }
  }
  return hallazgos;
}

const ARCHIVOS_JUNTOS = leerArchivos([
  ...recorrer("src/app/api/juntos", /\.ts$/),
  ...recorrer("src/lib/juntos", /\.ts$/),
]);

verificar(`se encontraron ficheros de Juntos (${ARCHIVOS_JUNTOS.length})`, ARCHIVOS_JUNTOS.length >= 5);

const logsGordos = logsConMasDeUnArgumento(ARCHIVOS_JUNTOS);
verificar(
  logsGordos.length === 0
    ? "en la línea Juntos todo console.* lleva un solo literal"
    : `logs de Juntos con argumentos: ${logsGordos.join(" | ")}`,
  logsGordos.length === 0,
);

// Regla general del repo: en ninguna parte se loguea el cuerpo por su nombre.
const ARCHIVOS_SERVIDOR = leerArchivos([
  ...recorrer("src/app/api", /\.ts$/),
  ...recorrer("src/lib", /\.ts$/),
]);

const logsConCuerpo = logsQueSerializanCuerpo(ARCHIVOS_SERVIDOR);
verificar(
  logsConCuerpo.length === 0
    ? `ningún console.* de las ${ARCHIVOS_SERVIDOR.length} fuentes de servidor pasa el cuerpo`
    : `logs que serializan el cuerpo: ${logsConCuerpo.join(" | ")}`,
  logsConCuerpo.length === 0,
);

console.log("\n  Control positivo — el detector de logs tiene que poder fallar");

verificar(
  "console.error('x', body) se marca",
  logsQueSerializanCuerpo([
    { ruta: "f.ts", texto: `console.error("POST /api/x", body);` },
  ]).length === 1,
);
verificar(
  "console.log(JSON.stringify(cuerpo)) se marca",
  logsQueSerializanCuerpo([
    { ruta: "f.ts", texto: `console.log(JSON.stringify(cuerpo));` },
  ]).length === 1,
);
verificar(
  "console.error('x') a secas NO se marca",
  logsQueSerializanCuerpo([{ ruta: "f.ts", texto: `console.error("POST /api/x");` }]).length === 0,
);
verificar(
  "una propiedad llamada `.body` de otro objeto NO se marca",
  logsQueSerializanCuerpo([{ ruta: "f.ts", texto: `console.error(res.body);` }]).length === 0,
);
verificar(
  "en Juntos, console.error('x', err) se marca",
  logsConMasDeUnArgumento([{ ruta: "f.ts", texto: `console.error("fallo", err);` }]).length === 1,
);
verificar(
  "en Juntos, console.error('x') a secas NO se marca",
  logsConMasDeUnArgumento([{ ruta: "f.ts", texto: `console.error("fallo");` }]).length === 0,
);
verificar(
  "en Juntos, una plantilla con interpolación se marca",
  logsConMasDeUnArgumento([
    { ruta: "f.ts", texto: "console.error(`fallo ${cuerpo.cedula}`);" },
  ]).length === 1,
);

// ═════════════════════════════════════════════════════════════════════════════
// 5 · La subida valida tipo y tamaño EN EL SERVIDOR
// ═════════════════════════════════════════════════════════════════════════════

console.log("\n5 — Subida: el tipo se decide por los primeros bytes, no por el nombre\n");

/** Cabecera de un archivo real, rellenada hasta `BYTES_CABECERA`. */
function cabecera(...bytes: number[]): Uint8Array {
  const buf = new Uint8Array(BYTES_CABECERA);
  buf.set(bytes.slice(0, BYTES_CABECERA));
  return buf;
}

const PNG = cabecera(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = cabecera(0xff, 0xd8, 0xff, 0xe0);
const PDF = cabecera(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37);
const WEBP = cabecera(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
// "<!DOCTYPE " — un HTML con `<script>` disfrazado de imagen.
const HTML = cabecera(0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45, 0x20);
// "RIFF" sin "WEBP": un .wav, que comparte los cuatro primeros bytes.
const WAV = cabecera(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45);

verificar("detectarFormato reconoce un PNG real", detectarFormato(PNG)?.formato === "png");
verificar("detectarFormato reconoce un JPEG real", detectarFormato(JPEG)?.formato === "jpeg");
verificar("detectarFormato reconoce un PDF real", detectarFormato(PDF)?.formato === "pdf");
verificar("detectarFormato reconoce un WEBP real", detectarFormato(WEBP)?.formato === "webp");
verificar("un HTML no es ningún formato conocido", detectarFormato(HTML) === null);
verificar("un RIFF que no es WEBP (un .wav) NO pasa por WEBP", detectarFormato(WAV) === null);

verificarLanza("un HTML llamado plano.png se rechaza (415)", () =>
  validarArchivo("PLANO", {
    nombre: "plano.png",
    mimeDeclarado: "image/png",
    bytes: 1024,
    cabecera: HTML,
  }),
);
verificarLanza("un PDF llamado foto.png se rechaza: la extensión miente", () =>
  validarArchivo("PLANO", {
    nombre: "foto.png",
    mimeDeclarado: "image/png",
    bytes: 1024,
    cabecera: PDF,
  }),
);
verificarLanza("un PNG enviado como application/pdf se rechaza: el MIME miente", () =>
  validarArchivo("PLANO", {
    nombre: "plano.png",
    mimeDeclarado: "application/pdf",
    bytes: 1024,
    cabecera: PNG,
  }),
);
verificarLanza("un PDF en el REGISTRO_INICIAL se rechaza: ahí solo entra imagen", () =>
  validarArchivo("REGISTRO_INICIAL", {
    nombre: "registro.pdf",
    mimeDeclarado: "application/pdf",
    bytes: 1024,
    cabecera: PDF,
  }),
);
verificarNoLanza("un PNG de verdad llamado plano.png se acepta", () =>
  validarArchivo("PLANO", {
    nombre: "plano.png",
    mimeDeclarado: "image/png",
    bytes: 1024,
    cabecera: PNG,
  }),
);
verificar(
  "el MIME que se persiste sale de la TABLA, no del cliente",
  validarArchivo("PLANO", {
    nombre: "plano.png",
    mimeDeclarado: "",
    bytes: 1024,
    cabecera: PNG,
  }).mime === "image/png",
);

verificarLanza("un archivo de 0 bytes se rechaza", () => verificarTamanoArchivo(0));
verificarLanza("un tamaño negativo se rechaza", () => verificarTamanoArchivo(-1));
verificarLanza("un tamaño no entero se rechaza", () => verificarTamanoArchivo(1.5));
verificarLanza("un tamaño NaN se rechaza", () => verificarTamanoArchivo(Number.NaN));
verificarLanza("por encima del tope por archivo se rechaza", () =>
  verificarTamanoArchivo(MAX_BYTES_POR_ARCHIVO + 1),
);
verificarNoLanza("justo en el tope se acepta", () =>
  verificarTamanoArchivo(MAX_BYTES_POR_ARCHIVO),
);

// El orden importa: el tamaño y el contenido se comprueban ANTES de consultar,
// para que un archivo falsificado no llegue a costar una consulta.
const textoSubida = readFileSync("src/lib/productos-tecnicos/subida.ts", "utf8");
const posTamano = textoSubida.indexOf("verificarTamanoArchivo(");
const posTipo = textoSubida.indexOf("validarArchivo(");
const posPuerto = textoSubida.indexOf("await puertos.");
verificar(
  "prepararSubida comprueba tamaño y tipo ANTES de la primera consulta",
  posTamano > 0 && posTipo > 0 && posPuerto > 0 && posTamano < posPuerto && posTipo < posPuerto,
);

// Las dos rutas de subida leen la cabecera del servidor: sin eso, `validarArchivo`
// recibiría lo que el cliente quisiera contarle.
for (const ruta of [
  "src/app/api/productos-tecnicos/route.ts",
  "src/app/api/productos-tecnicos/acta/foto/route.ts",
]) {
  const texto = readFileSync(ruta, "utf8");
  verificar(
    `${ruta} lee los primeros bytes en el servidor`,
    /slice\(0,\s*BYTES_CABECERA\)/.test(texto) && /prepararSubida\(/.test(texto),
  );
  verificar(
    `${ruta} sube con el MIME canónico (plan.mime), no con el del cliente`,
    /subirProductoTecnico\(archivo,\s*storagePath,\s*plan\.mime\)/.test(texto),
  );
}

// La imagen de firma: la misma regla, en la otra puerta de subida.
verificar("una firma HTML disfrazada de PNG no pasa", formatoDeFirma(HTML) === null);
verificar("una firma PNG real se reconoce", formatoDeFirma(PNG)?.mime === "image/png");
verificar("una firma JPEG real se reconoce", formatoDeFirma(JPEG)?.mime === "image/jpeg");
verificar("un PDF no vale como firma", formatoDeFirma(PDF) === null);
verificar(
  "jpg y jpeg son la misma familia",
  extensionCoincideConFormato("jpeg", { extension: "jpg", mime: "image/jpeg" }),
);
verificar(
  "declarar png sobre un contenido jpeg es contradicción",
  !extensionCoincideConFormato("png", { extension: "jpg", mime: "image/jpeg" }),
);

const textoAlmacenFirma = readFileSync("src/lib/documentos/almacen-firma.ts", "utf8");
verificar(
  "la firma se sube con el MIME deducido del contenido, no con archivo.type",
  /contentType:\s*real\.mime/.test(textoAlmacenFirma) &&
    !/contentType:\s*archivo\.type/.test(textoAlmacenFirma),
);
verificar(
  "…y la extensión del objeto también sale del contenido",
  /rutaImagenFirma\(usuarioId,\s*real\.extension\)/.test(textoAlmacenFirma),
);
verificar(
  "…y el tamaño se comprueba en el servidor",
  /archivo\.size\s*>\s*MAX_BYTES_FIRMA/.test(textoAlmacenFirma),
);

console.log("\n  Control positivo — el detector de subidas tiene que poder fallar");

verificar(
  "una cabecera vacía no se reconoce como ningún formato",
  detectarFormato(new Uint8Array(BYTES_CABECERA)) === null,
);
verificar(
  "un PNG truncado a 4 bytes no pasa por PNG",
  detectarFormato(new Uint8Array([0x89, 0x50, 0x4e, 0x47])) === null,
);
verificar(
  "el aserto de orden se rompe si la consulta se adelanta",
  (() => {
    const roto = "await puertos.ubicacionPertenece(u); verificarTamanoArchivo(b); validarArchivo(t);";
    const a = roto.indexOf("verificarTamanoArchivo(");
    const b = roto.indexOf("await puertos.");
    return !(a < b);
  })(),
);
verificar(
  "el aserto del MIME canónico se rompe si se reenvía el del cliente",
  !/contentType:\s*real\.mime/.test("upload(destino, archivo, { contentType: archivo.type });"),
);

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log(
  "RLS, aislamiento de rutas, privacidad de Juntos y validación de subidas verificados sin errores.",
);
