import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Recuperación: las tareas que quedaron en REPORTADA pero sin ninguna evidencia
 * en el servidor (artefacto del bug de subida) se devuelven a PENDIENTE para que
 * el obrero las pueda reportar de nuevo (ya con la subida arreglada).
 */
async function main() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const reportadas = await prisma.tarea.findMany({
      where: { estado: "REPORTADA" },
      select: { id: true, nombre: true, _count: { select: { evidencias: true } } },
    });
    const sinEvidencia = reportadas.filter((t) => t._count.evidencias === 0);

    console.log(`REPORTADAS totales: ${reportadas.length} · sin evidencia: ${sinEvidencia.length}`);
    for (const t of sinEvidencia) {
      await prisma.tarea.update({
        where: { id: t.id },
        data: { estado: "PENDIENTE", nota_reporte: null },
      });
      console.log(`  ↩  "${t.nombre}" (${t.id}) → PENDIENTE`);
    }
    console.log(sinEvidencia.length ? "✅ Listo." : "Nada que recuperar.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
