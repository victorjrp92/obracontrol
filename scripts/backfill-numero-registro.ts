/**
 * Asigna numero_registro a proyectos legacy y a sus tareas.
 * Idempotente: si ya tienen número, no los toca.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL en .env");
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const proyectos = await prisma.proyecto.findMany({
      where: { numero_registro: null },
      orderBy: [{ constructora_id: "asc" }, { created_at: "asc" }],
      select: { id: true, constructora_id: true, created_at: true, nombre: true },
    });

    console.log(`📋 ${proyectos.length} proyectos sin número de registro`);

    const seqPorConstructora = new Map<string, number>();

    for (const p of proyectos) {
      if (!seqPorConstructora.has(p.constructora_id)) {
        const existentes = await prisma.proyecto.count({
          where: { constructora_id: p.constructora_id, numero_registro: { not: null } },
        });
        seqPorConstructora.set(p.constructora_id, existentes);
      }
      const next = (seqPorConstructora.get(p.constructora_id) ?? 0) + 1;
      seqPorConstructora.set(p.constructora_id, next);

      const year = p.created_at.getFullYear();
      const numero = `PR-${year}-${String(next).padStart(3, "0")}`;

      // 1) actualizar el proyecto (rápido, sin transacción para no bloquear)
      await prisma.proyecto.update({ where: { id: p.id }, data: { numero_registro: numero } });

      // 2) traer todas las tareas y actualizarlas en batches fuera de transacción
      const tareas = await prisma.tarea.findMany({
        where: { espacio: { unidad: { piso: { edificio: { proyecto_id: p.id } } } } },
        select: { id: true, created_at: true },
        orderBy: { created_at: "asc" },
      });

      let seq = 0;
      const BATCH = 50;
      for (let i = 0; i < tareas.length; i += BATCH) {
        const batch = tareas.slice(i, i + BATCH);
        await Promise.all(
          batch.map((t) => {
            seq++;
            return prisma.tarea.update({
              where: { id: t.id },
              data: { numero_registro: `${numero}-T${String(seq).padStart(4, "0")}` },
            });
          }),
        );
      }

      console.log(`✓ ${p.nombre} → ${numero} (${tareas.length} tareas)`);
    }

    console.log("\n✅ Backfill completo");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
