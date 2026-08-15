/**
 * SEC-02 — Rota los tokens de acceso de los obreros a tokens aleatorios de
 * verdad (`randomBytes`, 192 bits) y reporta los enlaces nuevos.
 *
 * POR QUÉ HACE FALTA
 * Hasta ahora `Obrero.token` se generaba con `@default(cuid())`. Un cuid lleva
 * marca de tiempo, un contador secuencial y una huella del proceso: a partir de
 * un token válido se pueden adivinar los vecinos. Como ese token es la
 * credencial COMPLETA de /o/[token] —permite ver las tareas del contratista,
 * reportarlas y subir evidencias—, los tokens viejos hay que reemplazarlos, no
 * solo dejar de crearlos así.
 *
 * ⚠️ ROTAR INVALIDA LOS ENLACES ACTUALES. Todo obrero rotado necesita que le
 *    reenvíen el suyo. Coordínalo con quien atiende a las constructoras ANTES
 *    de aplicar.
 *
 * Uso:
 *   npx tsx scripts/rotar-tokens-obrero.ts              → simulacro (no escribe)
 *   npx tsx scripts/rotar-tokens-obrero.ts --aplicar    → rota de verdad
 *   npx tsx scripts/rotar-tokens-obrero.ts --aplicar --todos
 *        rota TAMBIÉN los que ya son seguros (p. ej. si sospechas una fuga)
 *
 * La salida trae una tabla por constructora con el enlace nuevo de cada obrero,
 * lista para repartir.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { randomBytes } from "crypto";

config({ path: ".env.local" });
config({ path: ".env" });

/** Mismo generador que src/lib/tokens.ts (los scripts no importan de src/). */
function generarTokenAcceso(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * ¿El token es de los viejos? Un cuid v1 son 25 caracteres que empiezan por `c`
 * y solo usan minúsculas y dígitos. Los tokens nuevos son 32 caracteres
 * base64url y casi siempre traen mayúsculas, `-` o `_`. Los tokens fijos de los
 * seeds (`obrero-test-token-001`) también caen aquí, y está bien que se roten.
 */
function esTokenDebil(token: string): boolean {
  if (/^c[a-z0-9]{24}$/.test(token)) return true; // cuid v1
  if (token.length < 24) return true; // seeds y cualquier cosa corta
  return false;
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const todos = process.argv.includes("--todos");

  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL/DIRECT_URL en .env");

  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const obreros = await prisma.obrero.findMany({
      select: {
        id: true,
        nombre: true,
        token: true,
        activo: true,
        constructora: { select: { nombre: true } },
      },
      orderBy: [{ constructora_id: "asc" }, { nombre: "asc" }],
    });

    const objetivo = todos ? obreros : obreros.filter((o) => esTokenDebil(o.token));

    console.log(`\n${obreros.length} obreros en total.`);
    console.log(`${objetivo.length} con token que hay que rotar${todos ? " (--todos)" : " (débil)"}.`);

    if (objetivo.length === 0) {
      console.log("\nNada que hacer.\n");
      return;
    }

    if (!aplicar) {
      console.log("\n── SIMULACRO — no se escribe nada. Añade --aplicar para rotar. ──\n");
      for (const o of objetivo) {
        console.log(`  ${o.constructora.nombre} · ${o.nombre}${o.activo ? "" : " (inactivo)"}`);
      }
      console.log("");
      return;
    }

    console.log("\n── ROTANDO ──\n");

    const nuevos: { constructora: string; nombre: string; activo: boolean; enlace: string }[] = [];

    for (const o of objetivo) {
      // Reintento por si el token nuevo chocara con uno existente (la
      // probabilidad es despreciable, pero la columna es @unique).
      let token = generarTokenAcceso();
      for (let intento = 0; intento < 5; intento++) {
        const choque = await prisma.obrero.findUnique({ where: { token }, select: { id: true } });
        if (!choque) break;
        token = generarTokenAcceso();
      }

      await prisma.obrero.update({ where: { id: o.id }, data: { token } });

      nuevos.push({
        constructora: o.constructora.nombre,
        nombre: o.nombre,
        activo: o.activo,
        enlace: `${sitio}/o/${token}`,
      });
    }

    // Agrupado por constructora para repartir.
    const porConstructora = new Map<string, typeof nuevos>();
    for (const n of nuevos) {
      const lista = porConstructora.get(n.constructora) ?? [];
      lista.push(n);
      porConstructora.set(n.constructora, lista);
    }

    for (const [constructora, lista] of porConstructora) {
      console.log(`\n### ${constructora}`);
      for (const n of lista) {
        console.log(`  ${n.nombre}${n.activo ? "" : "  (INACTIVO — no hace falta enviarlo)"}`);
        console.log(`  ${n.enlace}`);
      }
    }

    console.log(`\n✓ ${nuevos.length} tokens rotados.`);
    console.log("  Los enlaces anteriores ya no funcionan. Reparte los de arriba.\n");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
