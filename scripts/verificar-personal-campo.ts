/**
 * Verifica el renombrado de interfaz de leaf-1.2: «Obrero» → «Personal de
 * Campo» y «Personas externas» → «Personal del proyecto», SOLO texto
 * visible — el modelo de datos, las rutas y los nombres de símbolos no
 * cambian. Cubre únicamente las rutas bajo el OWNS de este leaf:
 *   - src/components/dashboard/**
 *   - src/app/(dashboard)/dashboard/equipo/**
 *   - src/app/(dashboard)/dashboard/obreros/**
 *   - src/components/personal/**
 *   - src/app/o/**
 *
 * No hay test runner configurado en el proyecto — este script es la suite
 * de verificación, en asserts planos. Uso:
 *   npx tsx scripts/verificar-personal-campo.ts
 * Sale con código 1 si algo falla.
 *
 * ── Heurística del detector de texto visible (extraerTextosVisibles) ──────
 * Escanea cada .tsx línea por línea (no hace parseo real de JSX/TS) y junta
 * candidatos a "texto visible" por estas vías:
 *   1. Atributos JSX conocidos: label, placeholder, title, aria-label, alt
 *      — en forma `attr="valor"` (JSX) o `attr: "valor"` (objeto), y también
 *      `attr={cond ? "A" : "B"}` (expresión con strings literales).
 *   2. Texto plano entre tags en la misma línea, p.ej. `<th>Obrero</th>`.
 *   3. Líneas `CLAVE: "valor"` donde CLAVE es un identificador en mayúsculas
 *      (p.ej. `OBRERO: "Personal de campo"` en un Record<NivelAcceso, string>)
 *      — se revisa SOLO el valor, nunca la clave (la clave es un símbolo del
 *      enum NivelAcceso y no debe tocarse).
 *   4. Líneas "sueltas" de prosa (un párrafo de JSX partido en su propia
 *      línea, sin tags ni llaves) — común en este código porque el texto
 *      largo de un <p> suele quedar en su propia línea entre la apertura y
 *      el cierre del tag.
 *
 * Se ignoran explícitamente (para no bloquear con falsos positivos):
 *   - Líneas `import`/`export`/`type`/`interface`/`const`/`let`/`var`/
 *     `function`/`class` y comentarios (`//`, `/*`, `*`) — ahí viven los
 *     nombres de símbolos, tipos y rutas de módulo.
 *   - Claves de objeto en minúscula/camelCase (`href`, `key`, `icon`, campos
 *     de interfaz como `direccion?:`) — nunca se revisa su valor por esta
 *     vía, así que una ruta como `href: "/contratista/obreros"` no dispara
 *     una falla.
 *   - Cualquier línea con `{`, `}`, `<`, `>`, `=` o una llamada tipo `fn(...)`
 *     que no calce con los patrones 1-3 de arriba: se asume código, no prosa.
 *
 * Limitación conocida y deliberada: un texto JSX-hijo dentro de una
 * expresión ternaria sin atributo conocido (p.ej. `{cond ? "Editar obrero"
 * : "Agregar obrero"}` como children directo, no como valor de `title=`)
 * NO se detecta, porque distinguirlo de código arbitrario entre llaves
 * requiere parseo real de JSX y cualquier heurística por línea que lo
 * intente empieza a atrapar rutas de API entre comillas dentro de objetos
 * (`fetch(url, { method: "DELETE" })`, `"/api/obreros"` en la misma línea
 * que un `{`). Ante esa disyuntiva, este verificador prefiere el falso
 * negativo — según el encargo explícito de este leaf — y esos casos se
 * revisaron a mano durante la implementación.
 *
 * Segunda limitación conocida: la vía 3 (CLAVE: "valor") asume que toda
 * clave en MAYÚSCULAS es un símbolo de enum cuyo valor-string es una
 * etiqueta visible (el caso real en este código: NIVEL_LABELS/NIVEL_COLORS
 * en RolesManager.tsx). Una clave en mayúsculas que por convención rara
 * guardara una ruta (`OBRERO_HREF: "/x/obreros"`) daría un falso positivo;
 * no ocurre hoy en el código bajo OWNS.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

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

// ─── Recolección de archivos bajo OWNS ──────────────────────────────────────

// Alcance ENSANCHADO tras leaf-1.2: el script nació cubriendo solo el OWNS de
// ese leaf, así que un «Obreros» reintroducido en super-admin o en el panel de
// contratista pasaba sin que nadie se enterara — lo comprobé con un control
// positivo que NO falló. Un verificador que no cubre donde vive el texto da una
// falsa sensación de que el renombrado está protegido.
const RUTAS_OWNS = [
  "src/components/dashboard",
  "src/app/(dashboard)/dashboard/equipo",
  "src/app/(dashboard)/dashboard/obreros",
  "src/app/(dashboard)/dashboard/proyectos",
  "src/app/(super-admin)/super-admin/obreros",
  "src/app/(super-admin)/super-admin/proyectos",
  "src/app/(contratista)/contratista/obreros",
  "src/components/personal",
  "src/app/o",
];

function listarTsx(dir: string): string[] {
  let out: string[] = [];
  let entradas: string[];
  try {
    entradas = readdirSync(dir);
  } catch {
    return out; // la ruta no existe — no es asunto de este verificador
  }
  for (const nombre of entradas) {
    const ruta = join(dir, nombre);
    const info = statSync(ruta);
    if (info.isDirectory()) {
      out = out.concat(listarTsx(ruta));
    } else if (nombre.endsWith(".tsx")) {
      out.push(ruta);
    }
  }
  return out;
}

const archivos = RUTAS_OWNS.flatMap((r) => listarTsx(r));

// ─── Detector de texto visible ──────────────────────────────────────────────

const ATRIBUTOS = ["label", "placeholder", "title", "aria-label", "alt"];
const ATRIBUTOS_ALTERNADOS = ATRIBUTOS.join("|");
const RE_ATRIBUTO_STRING = new RegExp(`\\b(${ATRIBUTOS_ALTERNADOS})\\s*[:=]\\s*"([^"]*)"`, "gi");
const RE_ATRIBUTO_EXPR = new RegExp(`\\b(${ATRIBUTOS_ALTERNADOS})\\s*=\\s*\\{([^{}]*)\\}`, "gi");
const RE_TEXTO_ENTRE_TAGS = />([^<>{}\n]+)</g;
const RE_CLAVE_VALOR = /^([A-Za-z_$][\w$]*)\??\s*:\s*(.*)$/;
const RE_CLAVE_ENUM = /^[A-Z][A-Z0-9_]*$/;
/**
 * Identificador suelto en una desestructuración o en una lista de props:
 * `obreros,` en `}: Props) {`. Es un NOMBRE DE SÍMBOLO, no texto que alguien
 * lea en pantalla — y renombrarlo rompería el código, que es justo lo que este
 * leaf tiene prohibido. Sin esta regla el detector produce un falso positivo
 * que empuja a "arreglar" lo que no está roto.
 */
const RE_IDENTIFICADOR_SUELTO = /^[A-Za-z_$][\w$]*\s*,?$/;
const RE_STRING_LITERAL = /"([^"]*)"/g;
const PREFIJOS_IGNORADOS = [
  "import ", "export ", "//", "/*", "*", "interface ", "type ",
  "const ", "let ", "var ", "function ", "async function", "class ",
];

function extraerTextosVisibles(contenido: string): string[] {
  const textos: string[] = [];

  for (const lineaCruda of contenido.split("\n")) {
    const linea = lineaCruda.trim();
    if (!linea) continue;
    if (PREFIJOS_IGNORADOS.some((p) => linea.startsWith(p))) continue;
    if (RE_IDENTIFICADOR_SUELTO.test(linea)) continue;

    // 1a. attr="valor" o attr: "valor"
    for (const m of linea.matchAll(RE_ATRIBUTO_STRING)) textos.push(m[2]);

    // 1b. attr={expresión con strings literales} — p.ej. title={a ? "X" : "Y"}
    for (const m of linea.matchAll(RE_ATRIBUTO_EXPR)) {
      for (const s of m[2].matchAll(RE_STRING_LITERAL)) textos.push(s[1]);
    }

    // 2. Texto plano entre tags en la misma línea: <th>Obrero</th>
    for (const m of linea.matchAll(RE_TEXTO_ENTRE_TAGS)) textos.push(m[1]);

    // 3. Línea "CLAVE: valor" — solo si CLAVE es un identificador en
    //    MAYÚSCULAS (símbolo de enum, p.ej. OBRERO), y solo se mira el valor.
    //    Claves en minúscula/camelCase (href, key, direccion?, ...) se
    //    ignoran por completo: pueden ser rutas o nombres de campo.
    const claveValor = linea.match(RE_CLAVE_VALOR);
    if (claveValor) {
      const [, clave, resto] = claveValor;
      if (RE_CLAVE_ENUM.test(clave)) {
        const s = resto.match(/"([^"]*)"/);
        if (s) textos.push(s[1]);
      }
      continue; // una línea clave:valor no es prosa suelta
    }

    // 4. Prosa suelta (JSX partido en varias líneas): solo si la línea no
    //    tiene pinta de código. Se excluye si trae {, }, <, >, =, ; (fin de
    //    sentencia JS/TS), una llamada `algo(`, o empieza con una palabra
    //    clave de control de flujo (if/return/throw/...) — el texto JSX no
    //    termina en `;` ni arranca así.
    const pareceCodigo =
      /[{}<>=;]|\w\(/.test(linea) ||
      /^(if|else|return|throw|for|while|switch|case|await|break|continue)\b/.test(linea);
    if (!pareceCodigo && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(linea)) {
      textos.push(linea);
    }
  }

  return textos;
}

const PATRON_OBRERO = /\bobrero(s)?\b/i;
const PATRON_PERSONAS_EXTERNAS = /personas\s+externas/i;

function tieneViolacion(texto: string): boolean {
  return PATRON_OBRERO.test(texto) || PATRON_PERSONAS_EXTERNAS.test(texto);
}

console.log("Seiricon — verificación de «Personal de Campo» / «Personal del proyecto» (leaf-1.2)\n");

// ─── G1: ningún texto visible dice Obrero/obrero/Personas externas ─────────

console.log(`Archivos .tsx bajo OWNS: ${archivos.length}`);
const violaciones: { archivo: string; texto: string }[] = [];
for (const archivo of archivos) {
  const contenido = readFileSync(archivo, "utf8");
  for (const texto of extraerTextosVisibles(contenido)) {
    if (tieneViolacion(texto)) violaciones.push({ archivo, texto });
  }
}

console.log("\nG1 — ningún texto visible dice «Obrero» / «obrero» / «Personas externas»");
if (violaciones.length > 0) {
  for (const v of violaciones) console.error(`  · ${v.archivo}: "${v.texto}"`);
}
verificar(
  `0 textos visibles con «Obrero» o «Personas externas» bajo OWNS (encontrados: ${violaciones.length})`,
  violaciones.length === 0,
);

// ─── Control positivo: el detector debe poder fallar ────────────────────────

console.log("\nControl positivo — el detector SÍ debe marcar un fixture con «Obrero»");
const FIXTURE_CON_VIOLACION = `
export default function Fixture() {
  return (
    <div>
      <h3 title="Detalle">
        Agrega un Obrero para continuar.
      </h3>
    </div>
  );
}
`;
const textosFixture = extraerTextosVisibles(FIXTURE_CON_VIOLACION);
verificar(
  "el detector marca el fixture de control (contiene «Obrero» en texto visible)",
  textosFixture.some(tieneViolacion),
);

const FIXTURE_LIMPIO = `
  { key: "sa-obreros", icon: HardHat, label: "Personal de campo", href: "/super-admin/obreros" },
`;
const textosFixtureLimpio = extraerTextosVisibles(FIXTURE_LIMPIO);
verificar(
  "el detector NO marca una ruta de código (href a /super-admin/obreros, clave key: \"sa-obreros\") como texto visible",
  !textosFixtureLimpio.some(tieneViolacion),
);

// ─── G2: el modelo de datos no cambió ───────────────────────────────────────

console.log("\nG2 — el modelo de datos NO cambió (solo se lee schema.prisma, nunca se edita)");
const schema = readFileSync("prisma/schema.prisma", "utf8");
verificar('sigue existiendo "model Obrero {"', /model Obrero \{/.test(schema));
verificar('sigue existiendo @@map("obreros")', /@@map\("obreros"\)/.test(schema));

// ─── Resultado ───────────────────────────────────────────────────────────────

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Renombrado de interfaz de leaf-1.2 verificado sin errores.");
