/**
 * Crea contenido mínimo para el demo:
 *   - 1 obrero (token "obrero-test-token-001")
 *   - Estructura del proyecto Demo Cali si está vacío:
 *     1 edificio, 1 piso, 1 unidad, 1 espacio, 1 fase, 3 tareas (estados variados)
 *
 * Idempotente: si ya existe, no duplica.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const TEST_OBRERO_TOKEN = "obrero-test-token-001";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const demo = await prisma.constructora.findFirst({
      where: { nombre: "Constructora Demo Cali" },
    });
    if (!demo) throw new Error("No existe Constructora Demo Cali. Corre db:seed-roles primero.");

    const proyecto = await prisma.proyecto.findFirst({
      where: { constructora_id: demo.id, nombre: "Proyecto Demo Cali" },
    });
    if (!proyecto) throw new Error("No existe Proyecto Demo Cali. Corre db:seed-roles.");

    const contratista = await prisma.usuario.findFirst({
      where: { constructora_id: demo.id, email: "contratista.test@obracontrol.local" },
    });
    if (!contratista) throw new Error("No existe contratista.test. Corre db:seed-roles.");

    // Asegurar que el proyecto tenga contratista_default
    if (!proyecto.contratista_default_id) {
      await prisma.proyecto.update({
        where: { id: proyecto.id },
        data: { contratista_default_id: contratista.id },
      });
      console.log("✓ Proyecto.contratista_default_id seteado");
    }

    // ── 1. Obrero ────────────────────────────────────────────────────────────
    const obreroExistente = await prisma.obrero.findUnique({
      where: { token: TEST_OBRERO_TOKEN },
    });
    if (!obreroExistente) {
      await prisma.obrero.create({
        data: {
          nombre: "Diego Muñoz (demo)",
          token: TEST_OBRERO_TOKEN,
          contratista_id: contratista.id,
          constructora_id: demo.id,
          fecha_inicio: new Date(),
          fecha_expiracion: new Date(Date.now() + 365 * 86400000),
          activo: true,
          cedula: "1144000111",
          telefono: "3001234567",
          especialidad: "INSTALADOR",
          eps: "SURA",
          arl: "POSITIVA",
          anos_experiencia: 5,
        },
      });
      console.log(`✓ Obrero creado (token: ${TEST_OBRERO_TOKEN})`);
    } else {
      console.log("✓ Obrero ya existe");
    }

    // ── 2. Estructura del proyecto si está vacío ─────────────────────────────
    const fasesExistentes = await prisma.fase.count({ where: { proyecto_id: proyecto.id } });
    const edificiosExistentes = await prisma.edificio.count({ where: { proyecto_id: proyecto.id } });

    if (fasesExistentes === 0 && edificiosExistentes === 0) {
      const fase = await prisma.fase.create({
        data: { proyecto_id: proyecto.id, nombre: "Madera", orden: 1, tiempo_estimado_dias: 30 },
      });

      const tipo = await prisma.tipoUnidad.create({
        data: { proyecto_id: proyecto.id, nombre: "Apto Tipo Demo" },
      });

      const edificio = await prisma.edificio.create({
        data: { proyecto_id: proyecto.id, nombre: "Torre 1", num_pisos: 1 },
      });

      const piso = await prisma.piso.create({
        data: { edificio_id: edificio.id, numero: 1 },
      });

      const unidad = await prisma.unidad.create({
        data: { piso_id: piso.id, nombre: "101", tipo_unidad_id: tipo.id, metraje_total: 65 },
      });

      const espacio = await prisma.espacio.create({
        data: { unidad_id: unidad.id, nombre: "Cocina", metraje: 12 },
      });

      const numeroProy = proyecto.numero_registro ?? "PR-2026-001";
      const tareasDemo = [
        {
          nombre: "Instalar mueble bajo cocina",
          numero: `${numeroProy}-T0001`,
          estado: "PENDIENTE" as const,
          dias: 3,
          precio: 850000,
        },
        {
          nombre: "Instalar mueble alto cocina",
          numero: `${numeroProy}-T0002`,
          estado: "REPORTADA" as const,
          dias: 3,
          precio: 720000,
        },
        {
          nombre: "Instalar mesón cocina",
          numero: `${numeroProy}-T0003`,
          estado: "APROBADA" as const,
          dias: 2,
          precio: 1_200_000,
        },
      ];

      const fechaInicio = new Date(Date.now() - 7 * 86400000);
      for (const t of tareasDemo) {
        await prisma.tarea.create({
          data: {
            espacio_id: espacio.id,
            fase_id: fase.id,
            numero_registro: t.numero,
            nombre: t.nombre,
            tiempo_acordado_dias: t.dias,
            precio: t.precio,
            asignado_a: contratista.id,
            estado: t.estado,
            fecha_inicio: t.estado === "PENDIENTE" ? null : fechaInicio,
            fecha_fin_real: t.estado === "APROBADA" ? new Date() : null,
            codigo_referencia: `MK${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
            marca_linea: "SAGANO",
            componentes: "Estructura + frente + naves",
          },
        });
      }
      console.log("✓ Estructura del proyecto creada: 1 edificio, 1 piso, 1 unidad, 1 espacio");
      console.log("✓ 3 tareas demo creadas (PENDIENTE, REPORTADA, APROBADA) con precios");
    } else {
      console.log(`✓ El proyecto ya tiene estructura (${fasesExistentes} fases, ${edificiosExistentes} edificios)`);
    }

    // ── Resumen ──────────────────────────────────────────────────────────────
    const [c, u, p, t, o] = await Promise.all([
      prisma.constructora.count(),
      prisma.usuario.count(),
      prisma.proyecto.count(),
      prisma.tarea.count(),
      prisma.obrero.count(),
    ]);
    console.log("\n📊 Estado final:");
    console.log(`   Constructoras: ${c}  |  Usuarios: ${u}  |  Proyectos: ${p}  |  Tareas: ${t}  |  Obreros: ${o}`);
    console.log("\n✅ Demo listo");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
