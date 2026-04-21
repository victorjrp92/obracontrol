#!/usr/bin/env node
import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
dotenv.config({ path: envPath });

/**
 * CLI script to provision an existing Supabase Auth user with a full Prisma data set.
 * Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx src/scripts/provision-user.ts <email> <nombre> <empresa>
 */

async function main() {
  const email = process.argv[2];
  const nombre = process.argv[3];
  const empresa = process.argv[4];

  if (!email || !nombre || !empresa) {
    console.error(
      "Usage: npx tsx src/scripts/provision-user.ts <email> <nombre> <empresa>"
    );
    process.exit(1);
  }

  // Create Prisma client with PrismaPg adapter — use DATABASE_URL (pooler) for connectivity
  const connectionString = process.env.DATABASE_URL!;
  console.log(`Connecting via pooler...`);
  const adapter = new PrismaPg({
    connectionString,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    // ── Check if user already exists ──────────────────────────────────────────
    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) {
      console.log(`✓ Usuario ${email} ya existe. Abortando.`);
      process.exit(0);
    }

    console.log(`→ Provisionando usuario: ${email}`);

    // ── Constructora ──────────────────────────────────────────────────────────
    const constructora = await prisma.constructora.create({
      data: {
        nombre: empresa,
        nit: `demo-${Date.now()}`,
        plan_suscripcion: "PROYECTO",
      },
    });
    console.log(`  • Constructora creada: ${constructora.nombre}`);

    // ── Default roles ──────────────────────────────────────────────────────────
    const defaultRoles = [
      { nombre: "Administrador", nivel_acceso: "ADMIN_GENERAL" as const, es_default: true },
      { nombre: "Director de obra", nivel_acceso: "DIRECTIVO" as const, es_default: true },
      { nombre: "Coordinador", nivel_acceso: "DIRECTIVO" as const, es_default: true },
      { nombre: "Asistente", nivel_acceso: "DIRECTIVO" as const, es_default: true },
      { nombre: "Auxiliar de obra", nivel_acceso: "DIRECTIVO" as const, es_default: true },
      { nombre: "Contratista instalador", nivel_acceso: "CONTRATISTA" as const, es_default: true },
      { nombre: "Contratista lustrador", nivel_acceso: "CONTRATISTA" as const, es_default: true },
      { nombre: "Obrero", nivel_acceso: "OBRERO" as const, es_default: true },
    ];

    const rolesCreados: Record<string, string> = {};
    for (const rolDef of defaultRoles) {
      const rol = await prisma.rol.create({
        data: {
          constructora_id: constructora.id,
          nombre: rolDef.nombre,
          nivel_acceso: rolDef.nivel_acceso,
          es_default: rolDef.es_default,
        },
      });
      rolesCreados[rolDef.nombre] = rol.id;
    }
    console.log(`  • Roles creados: ${Object.keys(rolesCreados).length}`);

    // ── Admin (el usuario que se registró) ────────────────────────────────────
    const admin = await prisma.usuario.create({
      data: {
        email,
        nombre,
        constructora_id: constructora.id,
        rol_id: rolesCreados["Administrador"],
      },
    });
    console.log(`  • Admin creado: ${admin.nombre} (${admin.email})`);

    // ── Contratistas demo ─────────────────────────────────────────────────────
    const uid = constructora.id.slice(0, 8);

    const c1 = await prisma.usuario.create({
      data: {
        email: `carlos.rincon.${uid}@demo.co`,
        nombre: "Carlos Rincón",
        constructora_id: constructora.id,
        rol_id: rolesCreados["Contratista instalador"],
      },
    });

    const c2 = await prisma.usuario.create({
      data: {
        email: `mauricio.soto.${uid}@demo.co`,
        nombre: "Mauricio Soto",
        constructora_id: constructora.id,
        rol_id: rolesCreados["Contratista lustrador"],
      },
    });

    await prisma.contratista.create({
      data: {
        usuario_id: c1.id,
        score_cumplimiento: 92,
        score_calidad: 88,
        score_velocidad_correccion: 90,
        score_total: 91,
      },
    });

    await prisma.contratista.create({
      data: {
        usuario_id: c2.id,
        score_cumplimiento: 70,
        score_calidad: 80,
        score_velocidad_correccion: 72,
        score_total: 74,
      },
    });

    console.log(
      `  • Contratistas creados: Carlos Rincón (91), Mauricio Soto (74)`
    );

    // ── Proyecto ──────────────────────────────────────────────────────────────
    const proyecto = await prisma.proyecto.create({
      data: {
        constructora_id: constructora.id,
        nombre: "Proyecto Olivo",
        subtipo: "APARTAMENTOS",
        dias_habiles_semana: 5,
        checklists_habilitados: false,
        fecha_inicio: new Date("2026-01-15"),
        fecha_fin_estimada: new Date("2026-12-15"),
        estado: "ACTIVO",
      },
    });
    console.log(`  • Proyecto creado: Proyecto Olivo`);

    // ── Tipos de Unidad ───────────────────────────────────────────────────────
    const tipo1 = await prisma.tipoUnidad.create({
      data: { proyecto_id: proyecto.id, nombre: "Tipo 1 — 3 habitaciones" },
    });
    const tipo2 = await prisma.tipoUnidad.create({
      data: { proyecto_id: proyecto.id, nombre: "Tipo 2 — 2 habitaciones" },
    });

    // ── Fases ─────────────────────────────────────────────────────────────────
    const faseMadera = await prisma.fase.create({
      data: { proyecto_id: proyecto.id, nombre: "Madera", orden: 1 },
    });
    const faseObraBlanca = await prisma.fase.create({
      data: { proyecto_id: proyecto.id, nombre: "Obra Blanca", orden: 2 },
    });
    console.log(`  • Fases creadas: Madera, Obra Blanca`);

    // ── Edificio (Torre 5) con 4 pisos ────────────────────────────────────────
    const torre = await prisma.edificio.create({
      data: { proyecto_id: proyecto.id, nombre: "Torre 5", num_pisos: 4 },
    });
    console.log(`  • Edificio creado: Torre 5 (4 pisos)`);

    // ── Tareas template (5 madera + 5 obra blanca = 10 per apto) ───────────────
    const piezasMadera = [
      {
        espacio: "Cocina",
        nombre: "Mueble bajo cocina",
        codigo: "MBK01",
        marca: "SAGANO",
        componentes: "estructura + naves",
        tiempo: 3,
        asignado: c1.id,
      },
      {
        espacio: "Cocina",
        nombre: "Mueble alto cocina",
        codigo: "MBC01",
        marca: "SAGANO",
        componentes: "estructura + puertas",
        tiempo: 3,
        asignado: c1.id,
      },
      {
        espacio: "Baño principal",
        nombre: "Mueble flotante lavamanos",
        codigo: "PUM01",
        marca: "AUSTRAL",
        componentes: "estructura + puerta",
        tiempo: 2,
        asignado: c1.id,
      },
      {
        espacio: "Habitación principal",
        nombre: "Closet tipo 1",
        codigo: "CLP01",
        marca: "GRAFFO",
        componentes: "estructura + correderas",
        tiempo: 4,
        asignado: c1.id,
      },
      {
        espacio: "Habitación 2",
        nombre: "Closet tipo 2",
        codigo: "CLP02",
        marca: "GRAFFO",
        componentes: "estructura + correderas",
        tiempo: 3,
        asignado: c2.id,
      },
    ];

    const tareasObraBlanca = [
      { espacio: "Sala-comedor", nombre: "Estuco paredes sala", tiempo: 2, asignado: c2.id },
      {
        espacio: "Sala-comedor",
        nombre: "Pintura base sala",
        tiempo: 1,
        asignado: c2.id,
      },
      {
        espacio: "Sala-comedor",
        nombre: "Pintura final sala",
        tiempo: 1,
        asignado: c2.id,
      },
      { espacio: "Cocina", nombre: "Estuco paredes cocina", tiempo: 1, asignado: c2.id },
      { espacio: "Cocina", nombre: "Pintura cocina", tiempo: 1, asignado: c2.id },
    ];

    // ── Task states cycle ─────────────────────────────────────────────────────
    const estadosCiclo: ("APROBADA" | "REPORTADA" | "PENDIENTE" | "NO_APROBADA")[] = [
      "APROBADA",
      "APROBADA",
      "REPORTADA",
      "PENDIENTE",
      "NO_APROBADA",
      "APROBADA",
      "REPORTADA",
      "APROBADA",
      "PENDIENTE",
      "NO_APROBADA",
    ];

    const fechaInicioMadera = new Date("2026-03-01");
    const fechaFinMadera = new Date("2026-03-05");
    const fechaInicioOB = new Date("2026-02-15");
    const fechaFinOB = new Date("2026-02-18");

    // ── Create 4 pisos × 4 aptos × 10 tareas ─────────────────────────────────
    let taskIndex = 0;
    for (let p = 1; p <= 4; p++) {
      const piso = await prisma.piso.create({
        data: { edificio_id: torre.id, numero: p },
      });

      for (let u = 1; u <= 4; u++) {
        const tipoUnidad = u <= 2 ? tipo1 : tipo2;
        const estadoBase = estadosCiclo[taskIndex % estadosCiclo.length];
        taskIndex++;

        const unidad = await prisma.unidad.create({
          data: {
            piso_id: piso.id,
            nombre: `${p}0${u}`,
            tipo_unidad_id: tipoUnidad.id,
          },
        });

        // 5 Madera + 5 Obra Blanca = 10 tasks per apartment
        for (const pieza of piezasMadera) {
          const espacio = await prisma.espacio.create({
            data: { unidad_id: unidad.id, nombre: pieza.espacio, metraje: 12 },
          });
          await prisma.tarea.create({
            data: {
              espacio_id: espacio.id,
              fase_id: faseMadera.id,
              nombre: pieza.nombre,
              codigo_referencia: pieza.codigo,
              marca_linea: pieza.marca,
              componentes: pieza.componentes,
              tiempo_acordado_dias: pieza.tiempo,
              asignado_a: pieza.asignado,
              estado: estadoBase,
              fecha_inicio:
                estadoBase !== "PENDIENTE" ? fechaInicioMadera : null,
              fecha_fin_real:
                estadoBase === "APROBADA" ? fechaFinMadera : null,
            },
          });
        }

        for (const t of tareasObraBlanca) {
          const espacio = await prisma.espacio.create({
            data: { unidad_id: unidad.id, nombre: t.espacio, metraje: 20 },
          });
          await prisma.tarea.create({
            data: {
              espacio_id: espacio.id,
              fase_id: faseObraBlanca.id,
              nombre: t.nombre,
              tiempo_acordado_dias: t.tiempo,
              asignado_a: t.asignado,
              estado: estadoBase,
              fecha_inicio:
                estadoBase !== "PENDIENTE" ? fechaInicioOB : null,
              fecha_fin_real: estadoBase === "APROBADA" ? fechaFinOB : null,
            },
          });
        }
      }
    }

    console.log(`  • Torre 5: 4 pisos × 4 aptos = 16 unidades creadas`);
    console.log(
      `  • Tareas: 160 tareas creadas (10 por apto: 5 madera + 5 obra blanca)`
    );

    console.log(`\n✓ Provisión completada para ${email}`);
  } catch (error) {
    console.error("✗ Error durante la provisión:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
