/**
 * Guardia: ningún componente `"use client"` puede arrastrar el servidor al
 * bundle del navegador.
 *
 * Es un defecto que ya se coló dos veces en este repo, y las dos por el mismo
 * camino: un BARRIL. `src/lib/productos-tecnicos/index.ts` reexportaba
 * `consultas.ts` y `puertos-prisma.ts` —los dos importan `@/lib/prisma`, que
 * INSTANCIA el cliente en el propio módulo— así que cuatro componentes de
 * cliente que solo querían `formatearBytes` o `FIRMAS` se llevaban Prisma y
 * `pg` al navegador. Un barril con un módulo con efectos secundarios dentro no
 * se puede podar: el import existe aunque no se use el símbolo.
 *
 * `tsc` no lo ve (los tipos cuadran), `eslint` tampoco, y `next build` está
 * prohibido en esta máquina. Así que se comprueba con el grafo.
 *
 * REGLA: desde cualquier fichero con `"use client"`, siguiendo solo imports de
 * VALOR y parando en las fronteras `"use server"` (Next las sustituye por un
 * stub RPC), no se puede llegar a un módulo de servidor.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = "src";

/** Lo que jamás puede acabar en el navegador, y por qué. */
const PROHIBIDOS: Record<string, string> = {
  "@/lib/prisma": "instancia PrismaClient en el módulo",
  "@/generated/prisma": "el cliente Prisma generado",
  "@prisma/client": "el cliente Prisma",
  "@prisma/adapter-pg": "arrastra el driver pg",
  pg: "driver de PostgreSQL",
  "next/headers": "solo existe en el servidor",
  "server-only": "marcador explícito de servidor",
  "node:fs": "módulo de Node",
  fs: "módulo de Node",
};

function recorrer(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return p.endsWith("generated") ? [] : recorrer(p);
    return /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

const TODOS = recorrer(RAIZ);

/** `@/x` → `src/x`; `./x` → relativo. Devuelve el fichero real o null. */
function resolver(especificador: string, desde: string): string | null {
  let base: string;
  if (especificador.startsWith("@/")) base = join(RAIZ, especificador.slice(2));
  else if (especificador.startsWith(".")) base = join(desde, "..", especificador);
  else return null; // paquete de node_modules: no se recorre
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

/**
 * Imports de VALOR de un fichero, `export … from` INCLUIDO: un reexport de
 * barril mete el módulo en el grafo exactamente igual que un import, y fue el
 * camino de las dos fugas que ha tenido este repo.
 *
 * Se descartan los de tipo: `import type {...}` / `export type {...}` y también
 * `import { type A, type B }` donde TODOS los especificadores llevan `type` —
 * TypeScript los borra al compilar y no llegan a ningún bundle.
 */
export function importsDeValor(fuente: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export)\s+(type\s+)?([^;'"]*?)from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;
  for (const m of fuente.matchAll(re)) {
    if (m[4]) {
      out.push(m[4]); // import "modulo" — efecto secundario puro
      continue;
    }
    if (m[1]) continue; // import type ... from
    const clausula = (m[2] ?? "").trim();
    const llaves = clausula.match(/\{([^}]*)\}/);
    if (llaves && !/^\s*(\*|\w)/.test(clausula)) {
      const specs = llaves[1].split(",").map((x) => x.trim()).filter(Boolean);
      if (specs.length > 0 && specs.every((x) => x.startsWith("type "))) continue;
    }
    out.push(m[3]);
  }
  return out;
}

const cacheFuente = new Map<string, string>();
function fuenteDe(f: string): string {
  let s = cacheFuente.get(f);
  if (s === undefined) {
    s = readFileSync(f, "utf8");
    cacheFuente.set(f, s);
  }
  return s;
}

const esCliente = (s: string) => /^\s*["']use client["']/m.test(s.slice(0, 400));
const esServerAction = (s: string) => /^\s*["']use server["']/m.test(s.slice(0, 400));

interface Fuga {
  raiz: string;
  cadena: string[];
  modulo: string;
}

/** Primera fuga alcanzable desde `raiz`, con la cadena de imports que la causa. */
function buscarFuga(raiz: string): Fuga | null {
  const visto = new Set<string>();
  const cola: { fichero: string; cadena: string[] }[] = [{ fichero: raiz, cadena: [raiz] }];
  while (cola.length > 0) {
    const { fichero, cadena } = cola.shift()!;
    if (visto.has(fichero)) continue;
    visto.add(fichero);
    const fuente = fuenteDe(fichero);
    // Una server action se convierte en un stub RPC: la travesía para aquí.
    if (fichero !== raiz && esServerAction(fuente)) continue;
    for (const esp of importsDeValor(fuente)) {
      if (PROHIBIDOS[esp]) return { raiz, cadena, modulo: esp };
      const destino = resolver(esp, fichero);
      if (destino && !visto.has(destino)) cola.push({ fichero: destino, cadena: [...cadena, destino] });
    }
  }
  return null;
}

let total = 0;
let fallos = 0;
function verificar(descripcion: string, condicion: boolean) {
  total++;
  if (condicion) console.log(`  OK   ${descripcion}`);
  else {
    fallos++;
    console.error(`  FAIL ${descripcion}`);
  }
}

console.log("Seiricon — el servidor no entra en el bundle del cliente\n");

const raices = TODOS.filter((f) => esCliente(fuenteDe(f)));
console.log(`  ficheros "use client": ${raices.length}`);
console.log(`  módulos vetados: ${Object.keys(PROHIBIDOS).join(", ")}\n`);

const fugas = raices.map(buscarFuga).filter((f): f is Fuga => f !== null);
for (const f of fugas) {
  console.error(`  FAIL ${f.raiz}`);
  console.error(`       ${f.cadena.join("\n         → ")}`);
  console.error(`         → ${f.modulo}   (${PROHIBIDOS[f.modulo]})`);
}
verificar(
  `ningún componente de cliente alcanza un módulo de servidor (fugas: ${fugas.length})`,
  fugas.length === 0,
);

// ── Controles del detector ─────────────────────────────────────────────────
console.log("\nControl positivo — el detector DEBE ver estas fugas");
verificar(
  "un import de valor de @/lib/prisma se detecta",
  importsDeValor(`import { prisma } from "@/lib/prisma";`).includes("@/lib/prisma"),
);
verificar(
  "un reexport de barril cuenta como import de valor",
  importsDeValor(`export { puertosPrisma } from "./puertos-prisma";`).includes("./puertos-prisma"),
);
verificar(
  "un import solo por efecto secundario cuenta",
  importsDeValor(`import "@/lib/prisma";`).includes("@/lib/prisma"),
);
verificar(
  "un import de valor de @/generated/prisma se detecta (los enums son runtime)",
  importsDeValor(`import { EspecialidadObrero } from "@/generated/prisma";`).includes("@/generated/prisma"),
);

console.log("\nControl negativo — el detector NO puede marcar lo que se borra al compilar");
verificar(
  "import type ... from se ignora",
  !importsDeValor(`import type { Prisma } from "@/generated/prisma";`).includes("@/generated/prisma"),
);
verificar(
  "import { type A, type B } se ignora",
  !importsDeValor(`import { type Prisma, type Tarea } from "@/generated/prisma";`).includes("@/generated/prisma"),
);
verificar(
  "…pero import { type A, B } NO se ignora: B viaja",
  importsDeValor(`import { type Prisma, PrismaClient } from "@/generated/prisma";`).includes("@/generated/prisma"),
);

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Ningún módulo de servidor llega al bundle del navegador.");
