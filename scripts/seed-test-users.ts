import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Carga ambos archivos por compatibilidad (.env.local es la convención del repo,
// pero el setup actual usa .env)
config({ path: ".env.local" });
config({ path: ".env" });

const TEST_CONTRATISTA_EMAIL = "contratista.test@obracontrol.local";
const TEST_CONTRATISTA_PASSWORD = "Test1234!";
const TEST_OBRERO_NAME = "Obrero de prueba";
const TEST_OBRERO_TOKEN = "obrero-test-token-001";
const REASSIGN_LIMIT = 5;

async function main() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!databaseUrl || databaseUrl.includes("localhost:5432")) {
    throw new Error(
      "DIRECT_URL/DATABASE_URL no apunta a un Postgres real. Pega tus credenciales de Supabase en .env"
    );
  }
  if (!supabaseUrl || supabaseUrl.includes("your-project")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no está configurado en .env");
  }
  if (!serviceRoleKey || serviceRoleKey === "your-service-role-key") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurado en .env");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log("🌱 Creando usuarios de prueba...\n");

    // 1. Constructora — usa la del seed o crea una mínima si no existe
    let constructora = await prisma.constructora.findUnique({
      where: { nit: "800123456-1" },
    });
    if (!constructora) {
      constructora = await prisma.constructora.create({
        data: {
          nombre: "Constructora Jaramillo Mora",
          nit: "800123456-1",
          plan_suscripcion: "PROYECTO",
        },
      });
      console.log("✓ Constructora creada:", constructora.nombre);
    } else {
      console.log("✓ Constructora existente:", constructora.nombre);
    }

    // 2. Rol con nivel_acceso CONTRATISTA — reutiliza el primero o crea uno
    let rolContratista = await prisma.rol.findFirst({
      where: { constructora_id: constructora.id, nivel_acceso: "CONTRATISTA" },
    });
    if (!rolContratista) {
      rolContratista = await prisma.rol.create({
        data: {
          constructora_id: constructora.id,
          nombre: "Contratista de prueba",
          nivel_acceso: "CONTRATISTA",
          es_default: true,
        },
      });
      console.log("✓ Rol Contratista creado");
    } else {
      console.log(`✓ Rol Contratista existente: ${rolContratista.nombre}`);
    }

    // 3. Auth user en Supabase (idempotente)
    const { data: list, error: listErr } =
      await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw new Error(`listUsers: ${listErr.message}`);
    let authUser = list?.users.find((u) => u.email === TEST_CONTRATISTA_EMAIL);

    if (!authUser) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: TEST_CONTRATISTA_EMAIL,
        password: TEST_CONTRATISTA_PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      authUser = data.user;
      console.log("✓ Auth user creado en Supabase:", TEST_CONTRATISTA_EMAIL);
    } else {
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: TEST_CONTRATISTA_PASSWORD,
      });
      console.log("✓ Auth user existente, password reseteado");
    }

    // 4. Usuario record en Postgres
    const usuario = await prisma.usuario.upsert({
      where: { email: TEST_CONTRATISTA_EMAIL },
      update: {
        constructora_id: constructora.id,
        rol_id: rolContratista.id,
      },
      create: {
        email: TEST_CONTRATISTA_EMAIL,
        nombre: "Contratista de Prueba",
        constructora_id: constructora.id,
        rol_id: rolContratista.id,
        invitado: true,
      },
    });
    console.log("✓ Usuario contratista listo");

    // 5. Perfil Contratista (scoring)
    await prisma.contratista.upsert({
      where: { usuario_id: usuario.id },
      update: {},
      create: {
        usuario_id: usuario.id,
        score_cumplimiento: 0,
        score_calidad: 0,
        score_velocidad_correccion: 0,
        score_total: 0,
      },
    });
    console.log("✓ Perfil contratista listo");

    // 6. Obrero con token predecible
    const obrero = await prisma.obrero.upsert({
      where: { token: TEST_OBRERO_TOKEN },
      update: {
        activo: true,
        fecha_expiracion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        contratista_id: usuario.id,
        constructora_id: constructora.id,
      },
      create: {
        nombre: TEST_OBRERO_NAME,
        token: TEST_OBRERO_TOKEN,
        contratista_id: usuario.id,
        constructora_id: constructora.id,
        fecha_inicio: new Date(),
        fecha_expiracion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        activo: true,
      },
    });
    console.log("✓ Obrero listo (token: " + obrero.token + ")");

    // 7. Reasignar algunas tareas existentes al test contratista para que
    //    tenga algo visible inmediatamente
    const tareasOtros = await prisma.tarea.findMany({
      where: {
        asignado_a: { not: usuario.id },
        estado: { in: ["PENDIENTE", "REPORTADA", "NO_APROBADA"] },
        espacio: {
          unidad: {
            piso: {
              edificio: { proyecto: { constructora_id: constructora.id } },
            },
          },
        },
      },
      take: REASSIGN_LIMIT,
      select: { id: true, nombre: true },
    });

    if (tareasOtros.length > 0) {
      await prisma.tarea.updateMany({
        where: { id: { in: tareasOtros.map((t) => t.id) } },
        data: { asignado_a: usuario.id },
      });
      console.log(
        `✓ ${tareasOtros.length} tareas reasignadas al test contratista`
      );
    } else {
      console.log(
        "⚠ No se encontraron tareas para reasignar. ¿Corriste 'npx tsx prisma/seed.ts' antes?"
      );
    }

    console.log("\n✅ Listo. Credenciales de prueba:\n");
    console.log("── CONTRATISTA ─────────────────────────────────────");
    console.log(`  URL:      ${siteUrl}/login`);
    console.log(`  Email:    ${TEST_CONTRATISTA_EMAIL}`);
    console.log(`  Password: ${TEST_CONTRATISTA_PASSWORD}`);
    console.log("\n── OBRERO ──────────────────────────────────────────");
    console.log(`  URL:      ${siteUrl}/o/${TEST_OBRERO_TOKEN}`);
    console.log(`  Token:    ${TEST_OBRERO_TOKEN}`);
    console.log(`  Nombre:   ${TEST_OBRERO_NAME}`);
    console.log("\nFlujo de prueba:");
    console.log("  1. Abrir URL del obrero, elegir una tarea, subir 2+ fotos y reportar");
    console.log("  2. Login como contratista, ir a /contratista");
    console.log("  3. Click en la tarea reportada → revisar fotos → aprobar o rechazar");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
