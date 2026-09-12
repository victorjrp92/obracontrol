/**
 * Cuentas de prueba del perfil ARQUITECTO.
 *
 *   · arquitecto.test@obracontrol.local  — Victor. Dos obras ya montadas:
 *     una torre de 5 pisos en Cali al 50% y un local de 2 pisos en Jamundí
 *     al 70%. Con dos obras activas el mapa aparece solo (regla de
 *     `dashboard/page.tsx`: las cuentas personales lo ven a partir de dos).
 *   · jc.arquitecto@obracontrol.local    — Juan Carlos. VACÍA a propósito:
 *     entra y cae en `/empezar` para crear obras reales.
 *
 * IDEMPOTENTE: se puede correr varias veces. Si la cuenta existe, resetea la
 * contraseña y deja las obras como están; si falta, la crea entera.
 *
 * El avance se construye aprobando tareas, no escribiendo un número:
 * `calcularProgreso` es aprobadas ÷ total, así que un 50% real son la mitad
 * de las tareas en APROBADA. Un porcentaje inventado en una columna se vería
 * bien en la tarjeta y mal en cuanto alguien abriera un espacio.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: ".env" });

const PASSWORD = "Test1234!";

// Determinista: dos corridas producen la misma obra.
const rnd = (s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)(20260831);

const ESP_VIV = ["Sala-comedor", "Cocina", "Baño social", "Habitación principal", "Habitación 2"];
const TAREAS_ESP = ["Resanar y alisar paredes", "Estuco pared", "Pintura", "Acabado de piso", "Detalles y limpieza"];

interface Espacio { nombre: string; tareas: string[] }
interface Unidad  { nombre: string; espacios: Espacio[] }
interface Piso    { nombre: string; unidades: Unidad[] }

function torreLimona(): Piso[] {
  const pisos: Piso[] = [];
  for (let p = 1; p <= 5; p++) {
    const unidades: Unidad[] = [];
    for (let u = 1; u <= 4; u++) {
      unidades.push({
        nombre: `Apto ${p}0${u}`,
        espacios: ESP_VIV.map(e => ({ nombre: e, tareas: [...TAREAS_ESP] })),
      });
    }
    pisos.push({ nombre: `Piso ${p}`, unidades });
  }
  return pisos;
}

function localJamundi(): Piso[] {
  return [
    { nombre: "Piso 1", unidades: [{ nombre: "Farmacia", espacios:
        ["Zona de atención al público", "Bodega / depósito", "Baño de clientes"]
          .map(e => ({ nombre: e, tareas: [...TAREAS_ESP] })) }] },
    { nombre: "Piso 2", unidades: [{ nombre: "Peluquería", espacios:
        ["Zona de atención al público", "Zona de caja", "Baño de personal"]
          .map(e => ({ nombre: e, tareas: [...TAREAS_ESP] })) }] },
  ];
}

async function cuenta(
  prisma: PrismaClient, sb: SupabaseClient,
  email: string, nombre: string, estudio: string,
) {
  const { data: list, error } = await sb.auth.admin.listUsers();
  if (error) throw new Error(`listUsers: ${error.message}`);
  const ya = list?.users.find(u => u.email === email);
  if (!ya) {
    const { error: e2 } = await sb.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { nombre, tipo_cuenta: "ARQUITECTO", estudio_nombre: estudio },
    });
    if (e2) throw new Error(`createUser: ${e2.message}`);
    console.log(`  auth creado: ${email}`);
  } else {
    await sb.auth.admin.updateUserById(ya.id, { password: PASSWORD });
    console.log(`  auth existente, contraseña reseteada: ${email}`);
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    await prisma.constructora.update({
      where: { id: existente.constructora_id },
      data: { tipo_cuenta: "ARQUITECTO", plan_suscripcion: "PERSONAL" },
    });
    console.log(`  cuenta ya existía, tipo asegurado a ARQUITECTO`);
    return existente.constructora_id;
  }

  const c = await prisma.constructora.create({
    data: { nombre: estudio, plan_suscripcion: "PERSONAL", tipo_cuenta: "ARQUITECTO" },
  });
  const rolAdmin = await prisma.rol.create({
    data: { constructora_id: c.id, nombre: "Dueño", nivel_acceso: "ADMIN_GENERAL", es_default: true },
  });
  // El arquitecto contrata: necesita el rol de contratista como el B2C de oficio.
  await prisma.rol.create({
    data: { constructora_id: c.id, nombre: "Contratista", nivel_acceso: "CONTRATISTA" },
  });
  await prisma.usuario.create({
    data: { email, nombre, constructora_id: c.id, rol_id: rolAdmin.id },
  });
  console.log(`  cuenta creada: ${estudio}`);
  return c.id;
}

async function obra(
  prisma: PrismaClient, constructoraId: string,
  nombre: string, subtipo: "APARTAMENTOS" | "CASAS", ciudad: string,
  lat: number, lng: number, pisos: Piso[], objetivo: number,
  extra: Record<string, unknown>,
) {
  const ya = await prisma.proyecto.findFirst({ where: { constructora_id: constructoraId, nombre } });
  if (ya) { console.log(`  obra ya existía: ${nombre}`); return; }

  const p = await prisma.proyecto.create({
    data: {
      constructora_id: constructoraId, nombre, subtipo,
      ciudad, ubicacion_lat: lat, ubicacion_lng: lng,
      estado: "ACTIVO", dias_habiles_semana: 6,
      fecha_inicio: new Date("2026-06-01"),
      ...extra,
    },
  });
  const ed = await prisma.edificio.create({
    data: { proyecto_id: p.id, nombre: "Principal", num_pisos: pisos.length },
  });
  // `Tarea.fase_id` es obligatorio: una tarea sin fase no se puede ordenar en
  // el cronograma. Se crea la fase de acabados, que es donde caen las tareas
  // que siembro.
  const fase = await prisma.fase.create({
    data: { proyecto_id: p.id, nombre: "Acabados", orden: 1 },
  });

  let total = 0, aprobadas = 0;
  for (const [i, pi] of pisos.entries()) {
    const piso = await prisma.piso.create({ data: { edificio_id: ed.id, numero: i + 1 } });
    for (const un of pi.unidades) {
      const unidad = await prisma.unidad.create({
        data: { piso_id: piso.id, nombre: un.nombre, nombre_personalizado: un.nombre },
      });
      for (const es of un.espacios) {
        const espacio = await prisma.espacio.create({ data: { unidad_id: unidad.id, nombre: es.nombre } });
        for (const tn of es.tareas) {
          total++;
          // Los pisos bajos van más adelantados, como una obra real. El sesgo
          // tiene que ser SIMÉTRICO alrededor de cero o el promedio se desplaza:
          // con (n-i)/n - 0.5 y dos pisos daba +0.5 y 0, es decir un sesgo medio
          // de +0.25 que empujaba el total del 70% al 90%.
          const sesgo = pisos.length > 1 ? 0.5 - i / (pisos.length - 1) : 0;
          const aprobar = rnd() < Math.min(0.97, Math.max(0.03, objetivo / 100 + sesgo * 0.45));
          if (aprobar) aprobadas++;
          await prisma.tarea.create({
            data: {
              espacio_id: espacio.id, fase_id: fase.id, nombre: tn,
              tiempo_acordado_dias: 2,
              estado: aprobar ? "APROBADA" : "PENDIENTE",
              ...(aprobar ? { fecha_inicio: new Date("2026-06-15"), fecha_fin_real: new Date("2026-06-18") } : {}),
            },
          });
        }
      }
    }
  }
  console.log(`  obra creada: ${nombre} — ${aprobadas}/${total} tareas aprobadas = ${Math.round(aprobadas / total * 100)}%`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  console.log("\nVictor — arquitecto con dos obras");
  const cv = await cuenta(prisma, sb, "arquitecto.test@obracontrol.local", "Victor Ramos", "Estudio Victor");
  await obra(prisma, cv, "Limona Prueba 1", "APARTAMENTOS", "Cali", 3.4516, -76.5320,
    torreLimona(), 50, { tipo_obra: "OBRA_NUEVA", tipo_propiedad: "EDIFICIO", metraje_total: 1400 });
  await obra(prisma, cv, "Local Jamundí", "CASAS", "Jamundí", 3.2611, -76.5386,
    localJamundi(), 70, { tipo_obra: "REFORMA", tipo_propiedad: "LOCAL", metraje_total: 180 });

  console.log("\nJuan Carlos — arquitecto desde cero");
  await cuenta(prisma, sb, "jc.arquitecto@obracontrol.local", "Juan Carlos Ordoñez", "JCO Arquitectura");
  console.log("  sin obras a propósito: entra y cae en /empezar");

  console.log(`\nContraseña de las dos: ${PASSWORD}`);
  await prisma.$disconnect(); await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
