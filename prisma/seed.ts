import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DIRECT_URL!,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed — Jaramillo Mora / Proyecto Olivo...");

  // ── Constructora ────────────────────────────────────────────
  const constructora = await prisma.constructora.upsert({
    where: { nit: "800123456-1" },
    update: {},
    create: {
      nombre: "Constructora Jaramillo Mora",
      nit: "800123456-1",
      plan_suscripcion: "PROYECTO",
    },
  });
  console.log("✓ Constructora:", constructora.nombre);

  // ── Usuarios ────────────────────────────────────────────────
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@jaramillomora.co" },
    update: {},
    create: {
      email: "admin@jaramillomora.co",
      nombre: "Área Administrativa",
      constructora_id: constructora.id,
      rol: "ADMIN",
    },
  });

  const coordinador = await prisma.usuario.upsert({
    where: { email: "coordinador@jaramillomora.co" },
    update: {},
    create: {
      email: "coordinador@jaramillomora.co",
      nombre: "Pedro Restrepo",
      constructora_id: constructora.id,
      rol: "COORDINADOR",
    },
  });

  const contratista1User = await prisma.usuario.upsert({
    where: { email: "carlos.rincon@contratista.co" },
    update: {},
    create: {
      email: "carlos.rincon@contratista.co",
      nombre: "Carlos Rincón",
      constructora_id: constructora.id,
      rol: "CONTRATISTA_INSTALADOR",
    },
  });

  const contratista2User = await prisma.usuario.upsert({
    where: { email: "mauricio.soto@contratista.co" },
    update: {},
    create: {
      email: "mauricio.soto@contratista.co",
      nombre: "Mauricio Soto",
      constructora_id: constructora.id,
      rol: "CONTRATISTA_LUSTRADOR",
    },
  });

  // Perfiles contratista
  await prisma.contratista.upsert({
    where: { usuario_id: contratista1User.id },
    update: {},
    create: {
      usuario_id: contratista1User.id,
      score_cumplimiento: 92,
      score_calidad: 88,
      score_velocidad_correccion: 90,
      score_total: 91,
    },
  });

  await prisma.contratista.upsert({
    where: { usuario_id: contratista2User.id },
    update: {},
    create: {
      usuario_id: contratista2User.id,
      score_cumplimiento: 70,
      score_calidad: 80,
      score_velocidad_correccion: 72,
      score_total: 74,
    },
  });

  console.log("✓ Usuarios y contratistas creados");

  // ── Proyecto Olivo ──────────────────────────────────────────
  const proyecto = await prisma.proyecto.upsert({
    where: { id: "proyecto-olivo-seed" },
    update: {},
    create: {
      id: "proyecto-olivo-seed",
      constructora_id: constructora.id,
      nombre: "Proyecto Olivo",
      subtipo: "APARTAMENTOS",
      dias_habiles_semana: 5,
      checklists_habilitados: true,
      fecha_inicio: new Date("2026-01-15"),
      fecha_fin_estimada: new Date("2026-12-15"),
      estado: "ACTIVO",
    },
  });
  console.log("✓ Proyecto:", proyecto.nombre);

  // ── Tipos de apartamento ────────────────────────────────────
  const tipo1 = await prisma.tipoUnidad.upsert({
    where: { id: "tipo1-olivo-seed" },
    update: {},
    create: {
      id: "tipo1-olivo-seed",
      proyecto_id: proyecto.id,
      nombre: "Tipo 1 — 3 habitaciones",
    },
  });

  const tipo2 = await prisma.tipoUnidad.upsert({
    where: { id: "tipo2-olivo-seed" },
    update: {},
    create: {
      id: "tipo2-olivo-seed",
      proyecto_id: proyecto.id,
      nombre: "Tipo 2 — 2 habitaciones",
    },
  });

  // ── Fases ───────────────────────────────────────────────────
  const faseMadera = await prisma.fase.upsert({
    where: { id: "fase-madera-seed" },
    update: {},
    create: {
      id: "fase-madera-seed",
      proyecto_id: proyecto.id,
      nombre: "Madera",
      orden: 1,
    },
  });

  const faseObraBlanca = await prisma.fase.upsert({
    where: { id: "fase-obra-blanca-seed" },
    update: {},
    create: {
      id: "fase-obra-blanca-seed",
      proyecto_id: proyecto.id,
      nombre: "Obra Blanca",
      orden: 2,
    },
  });

  console.log("✓ Fases creadas");

  // ── Torre 5 — 3 pisos, 4 apartamentos por piso ──────────────
  const torre5 = await prisma.edificio.upsert({
    where: { id: "torre5-olivo-seed" },
    update: {},
    create: {
      id: "torre5-olivo-seed",
      proyecto_id: proyecto.id,
      nombre: "Torre 5",
      num_pisos: 3,
    },
  });

  // Pisos y apartamentos (3 pisos, 4 aptos por piso)
  const apartamentos: { id: string; nombre: string; tipo: typeof tipo1 }[] = [];

  for (let p = 1; p <= 3; p++) {
    const pisoId = `piso${p}-torre5-seed`;
    const piso = await prisma.piso.upsert({
      where: { id: pisoId },
      update: {},
      create: { id: pisoId, edificio_id: torre5.id, numero: p },
    });

    for (let u = 1; u <= 4; u++) {
      const unidadId = `apto${p}0${u}-torre5-seed`;
      const nombre = `${p}0${u}`;
      const tipoUnidad = u <= 2 ? tipo1 : tipo2;

      const unidad = await prisma.unidad.upsert({
        where: { id: unidadId },
        update: {},
        create: {
          id: unidadId,
          piso_id: piso.id,
          nombre,
          tipo_unidad_id: tipoUnidad.id,
        },
      });

      apartamentos.push({ id: unidad.id, nombre, tipo: tipoUnidad });
    }
  }

  console.log(`✓ Torre 5: ${apartamentos.length} apartamentos`);

  // ── Espacios y tareas por apartamento ───────────────────────
  // Piezas reales de la fase Madera (basado en Excel Jaramillo Mora)
  const piezasMadera = [
    { espacio: "Cocina", nombre: "Mueble bajo cocina", codigo: "MBK01", marca: "SAGANO", componentes: "estructura + naves", tiempo: 3, asignado: contratista1User.id },
    { espacio: "Cocina", nombre: "Mueble alto cocina", codigo: "MBC01", marca: "SAGANO", componentes: "estructura + puertas", tiempo: 3, asignado: contratista1User.id },
    { espacio: "Baño principal", nombre: "Mueble flotante lavamanos", codigo: "PUM01", marca: "AUSTRAL", componentes: "estructura + puerta", tiempo: 2, asignado: contratista1User.id },
    { espacio: "Habitación principal", nombre: "Closet tipo 1", codigo: "CLP01", marca: "GRAFFO", componentes: "estructura + correderas", tiempo: 4, asignado: contratista1User.id },
    { espacio: "Habitación 2", nombre: "Closet tipo 2", codigo: "CLP02", marca: "GRAFFO", componentes: "estructura + correderas", tiempo: 3, asignado: contratista2User.id },
  ];

  const tareasOblaBlanca = [
    { espacio: "Sala-comedor", nombre: "Estuco paredes sala", tiempo: 2, asignado: contratista2User.id },
    { espacio: "Sala-comedor", nombre: "Pintura base sala", tiempo: 1, asignado: contratista2User.id },
    { espacio: "Sala-comedor", nombre: "Pintura final sala", tiempo: 1, asignado: contratista2User.id },
    { espacio: "Cocina", nombre: "Estuco paredes cocina", tiempo: 1, asignado: contratista2User.id },
    { espacio: "Cocina", nombre: "Pintura cocina", tiempo: 1, asignado: contratista2User.id },
  ];

  let tareasCreadas = 0;
  const estadosCiclo: ("APROBADA" | "REPORTADA" | "PENDIENTE" | "NO_APROBADA")[] =
    ["APROBADA", "APROBADA", "REPORTADA", "PENDIENTE", "NO_APROBADA"];

  for (let i = 0; i < apartamentos.length; i++) {
    const apto = apartamentos[i];
    const estadoBase = estadosCiclo[i % estadosCiclo.length];

    // Espacios de madera
    for (const pieza of piezasMadera) {
      const espacioId = `espacio-${pieza.espacio.replace(/ /g, "-")}-${apto.id}-seed`;
      const espacio = await prisma.espacio.upsert({
        where: { id: espacioId },
        update: {},
        create: {
          id: espacioId,
          unidad_id: apto.id,
          nombre: pieza.espacio,
          metraje: 12,
        },
      });

      await prisma.tarea.upsert({
        where: { id: `tarea-${pieza.codigo}-${apto.id}-seed` },
        update: {},
        create: {
          id: `tarea-${pieza.codigo}-${apto.id}-seed`,
          espacio_id: espacio.id,
          fase_id: faseMadera.id,
          nombre: pieza.nombre,
          codigo_referencia: pieza.codigo,
          marca_linea: pieza.marca,
          componentes: pieza.componentes,
          tiempo_acordado_dias: pieza.tiempo,
          asignado_a: pieza.asignado,
          estado: estadoBase,
          fecha_inicio: estadoBase !== "PENDIENTE" ? new Date("2026-03-01") : null,
          fecha_fin_real: estadoBase === "APROBADA" ? new Date("2026-03-05") : null,
        },
      });
      tareasCreadas++;
    }

    // Espacios de obra blanca
    for (const t of tareasOblaBlanca) {
      const espacioId = `espacio-ob-${t.espacio.replace(/ /g, "-")}-${apto.id}-seed`;
      const espacio = await prisma.espacio.upsert({
        where: { id: espacioId },
        update: {},
        create: {
          id: espacioId,
          unidad_id: apto.id,
          nombre: t.espacio,
          metraje: 20,
        },
      });

      await prisma.tarea.upsert({
        where: { id: `tarea-ob-${t.nombre.replace(/ /g, "-")}-${apto.id}-seed` },
        update: {},
        create: {
          id: `tarea-ob-${t.nombre.replace(/ /g, "-")}-${apto.id}-seed`,
          espacio_id: espacio.id,
          fase_id: faseObraBlanca.id,
          nombre: t.nombre,
          tiempo_acordado_dias: t.tiempo,
          asignado_a: t.asignado,
          cantidad_material_planeada: 25,
          unidad_material: "kg",
          estado: estadoBase,
          fecha_inicio: estadoBase !== "PENDIENTE" ? new Date("2026-02-15") : null,
          fecha_fin_real: estadoBase === "APROBADA" ? new Date("2026-02-18") : null,
        },
      });
      tareasCreadas++;
    }
  }

  console.log(`✓ ${tareasCreadas} tareas creadas`);

  // ── Aprobaciones para tareas aprobadas ──────────────────────
  const tareasAprobadas = await prisma.tarea.findMany({
    where: { estado: "APROBADA", id: { endsWith: "-seed" } },
    take: 10,
  });

  for (const tarea of tareasAprobadas) {
    await prisma.aprobacion.upsert({
      where: { id: `aprobacion-${tarea.id}` },
      update: {},
      create: {
        id: `aprobacion-${tarea.id}`,
        tarea_id: tarea.id,
        aprobador_id: coordinador.id,
        estado: "APROBADA",
        fecha: new Date("2026-03-06"),
      },
    });
  }

  console.log("✓ Aprobaciones creadas");
  console.log("\n✅ Seed completado exitosamente");
  console.log(`   Constructora: ${constructora.nombre}`);
  console.log(`   Proyecto: ${proyecto.nombre}`);
  console.log(`   Apartamentos: ${apartamentos.length}`);
  console.log(`   Tareas: ${tareasCreadas}`);
  console.log(`\n   Admin: admin@jaramillomora.co`);
  console.log(`   Coordinador: coordinador@jaramillomora.co`);
  console.log(`   Contratista 1: carlos.rincon@contratista.co`);
  console.log(`   Contratista 2: mauricio.soto@contratista.co`);
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
