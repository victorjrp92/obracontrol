/**
 * Crea el rol «Personal de campo» (nivel PERSONAL_CAMPO) en las constructoras
 * que no lo tengan.
 *
 * POR QUÉ HACE FALTA UN SCRIPT Y NO BASTA LA MIGRACIÓN. La migración
 * `20260913120000_personal_campo_role` solo añade el valor al enum: Postgres
 * prohíbe USAR un valor de enum en la misma transacción en que se crea, y
 * Prisma envuelve cada fichero de migración en una transacción. Aparte de eso,
 * los roles por defecto no viven en el esquema: los siembra
 * `provisionarUsuario()` al registrarse una empresa y el POST de
 * /api/super-admin/constructoras al crearla a mano. Las constructoras que YA
 * existían nacieron antes de que el rol existiera y se quedarían sin él: sin
 * rol no hay a quién asignárselo, y el nivel nuevo sería inalcanzable.
 *
 * IDEMPOTENTE. Se puede correr las veces que haga falta:
 *   - Salta la constructora que ya tenga CUALQUIER rol de nivel PERSONAL_CAMPO,
 *     se llame como se llame (alguien pudo crearlo con otro nombre desde
 *     /dashboard/configuracion).
 *   - Salta también la que ya tenga un rol llamado «Personal de campo» con otro
 *     nivel: hay un @@unique([constructora_id, nombre]) y crearlo reventaría con
 *     P2002. Ese caso se reporta por consola para que lo mire un humano.
 *
 * Uso:  npx tsx scripts/backfill-rol-personal-campo.ts
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** El nombre que ve el usuario. Debe coincidir con el de las dos semillas. */
const NOMBRE_ROL = "Personal de campo";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const constructoras = await prisma.constructora.findMany({
    select: { id: true, nombre: true },
    orderBy: { created_at: "asc" },
  });

  // Una sola consulta para las dos razones de saltar: ya tiene el nivel, o el
  // nombre está ocupado por otro rol.
  const rolesRelevantes = await prisma.rol.findMany({
    where: {
      OR: [{ nivel_acceso: "PERSONAL_CAMPO" }, { nombre: NOMBRE_ROL }],
    },
    select: { constructora_id: true, nombre: true, nivel_acceso: true },
  });

  const yaTieneNivel = new Set(
    rolesRelevantes.filter((r) => r.nivel_acceso === "PERSONAL_CAMPO").map((r) => r.constructora_id),
  );
  const nombreOcupado = new Set(
    rolesRelevantes
      .filter((r) => r.nombre === NOMBRE_ROL && r.nivel_acceso !== "PERSONAL_CAMPO")
      .map((r) => r.constructora_id),
  );

  const aCrear = constructoras.filter(
    (c) => !yaTieneNivel.has(c.id) && !nombreOcupado.has(c.id),
  );

  for (const c of constructoras) {
    if (nombreOcupado.has(c.id)) {
      console.warn(
        `⚠️  «${c.nombre}» (${c.id}) ya tiene un rol llamado «${NOMBRE_ROL}» con otro nivel. ` +
          `Se salta: hay que renombrarlo o cambiarle el nivel a mano.`,
      );
    }
  }

  if (aCrear.length === 0) {
    console.log(
      `Nada que hacer: ${yaTieneNivel.size} constructora(s) ya tienen el rol, ` +
        `${nombreOcupado.size} con el nombre ocupado, ${constructoras.length} en total.`,
    );
  } else {
    // skipDuplicates es el segundo cinturón: si dos corridas se solapan, la
    // segunda no revienta con P2002.
    const { count } = await prisma.rol.createMany({
      data: aCrear.map((c) => ({
        constructora_id: c.id,
        nombre: NOMBRE_ROL,
        nivel_acceso: "PERSONAL_CAMPO" as const,
        es_default: true,
      })),
      skipDuplicates: true,
    });
    console.log(`${count} rol(es) «${NOMBRE_ROL}» creados de ${constructoras.length} constructoras.`);
    for (const c of aCrear) console.log(`  · ${c.nombre} (${c.id})`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
