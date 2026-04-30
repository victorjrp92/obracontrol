/**
 * Crea usuarios de prueba uno por cada rol del sistema.
 * Idempotente — re-ejecutarlo solo resetea passwords y reasigna proyectos.
 *
 * Uso:  npm run db:seed-roles
 *
 * Requiere en .env:
 *   - DATABASE_URL  (Postgres real, no localhost)
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: ".env" });

const PASSWORD = "Test1234!";

const USERS = {
  superAdmin: { email: "super.admin@obracontrol.local", nombre: "Karen Cortés (Super Admin)" },
  superAdmin2: { email: "victor.super@obracontrol.local", nombre: "Victor (Super Admin)" },
  adminGeneral: { email: "admin.general@obracontrol.local", nombre: "Admin General · Cali" },
  adminJunior: { email: "admin.junior@obracontrol.local", nombre: "Admin Junior · Proyecto Olivo" },
  directivo: { email: "directivo.test@obracontrol.local", nombre: "Directivo de Prueba" },
  contratista: { email: "contratista.test@obracontrol.local", nombre: "Contratista de Prueba" },
};

async function main() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!databaseUrl) throw new Error("Falta DATABASE_URL en .env");
  if (!supabaseUrl) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env");
  if (!serviceRoleKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env");

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("\n🌱 Sembrando usuarios de prueba (uno por rol)\n");

  try {
    // ── Constructora "sistema" donde vive el SUPER_ADMIN ─────────────────────
    let sistema = await prisma.constructora.findFirst({
      where: { nombre: "Sistema Seiricon" },
    });
    if (!sistema) {
      sistema = await prisma.constructora.create({
        data: { nombre: "Sistema Seiricon", plan_suscripcion: "EMPRESA" },
      });
      console.log("✓ Constructora 'Sistema Seiricon' creada (host del Super Admin)");
    }

    // Rol Super Admin (vive en la constructora "Sistema Seiricon")
    let rolSuper = await prisma.rol.findFirst({
      where: { constructora_id: sistema.id, nivel_acceso: "SUPER_ADMIN" },
    });
    if (!rolSuper) {
      rolSuper = await prisma.rol.create({
        data: {
          constructora_id: sistema.id,
          nombre: "Super Admin",
          nivel_acceso: "SUPER_ADMIN",
          es_default: true,
        },
      });
    }

    // ── Constructora demo donde se prueba la jerarquía completa ──────────────
    let demo = await prisma.constructora.findFirst({
      where: { nombre: "Constructora Demo Cali" },
    });
    if (!demo) {
      demo = await prisma.constructora.create({
        data: {
          nombre: "Constructora Demo Cali",
          ciudad: "Cali",
          plan_suscripcion: "PROYECTO",
        },
      });
      console.log("✓ Constructora 'Constructora Demo Cali' creada");
    }

    // Roles default en demo
    const rolesDemoNeed = [
      { nombre: "Administrador", nivel: "ADMIN_GENERAL" as const },
      { nombre: "Administrador Proyectos", nivel: "ADMIN_PROYECTO" as const },
      { nombre: "Director de obra", nivel: "DIRECTIVO" as const },
      { nombre: "Contratista instalador", nivel: "CONTRATISTA" as const },
      { nombre: "Auxiliar de obra", nivel: "OBRERO" as const },
    ];
    const rolesDemoMap: Record<string, string> = {};
    for (const r of rolesDemoNeed) {
      const found = await prisma.rol.upsert({
        where: { constructora_id_nombre: { constructora_id: demo.id, nombre: r.nombre } },
        update: {},
        create: {
          constructora_id: demo.id,
          nombre: r.nombre,
          nivel_acceso: r.nivel,
          es_default: true,
        },
      });
      rolesDemoMap[r.nivel] = found.id;
    }

    // Proyecto demo (si no hay ninguno en la demo, crear uno mínimo)
    let proyecto = await prisma.proyecto.findFirst({
      where: { constructora_id: demo.id },
    });
    if (!proyecto) {
      proyecto = await prisma.proyecto.create({
        data: {
          constructora_id: demo.id,
          nombre: "Proyecto Demo Cali",
          subtipo: "APARTAMENTOS",
          dias_habiles_semana: 5,
          fecha_inicio: new Date(),
          fecha_fin_estimada: new Date(Date.now() + 180 * 86400000),
          estado: "ACTIVO",
        },
      });
      console.log("✓ Proyecto demo creado en Constructora Demo Cali");
    }

    async function ensureUser(opts: {
      email: string;
      nombre: string;
      constructora_id: string;
      rol_id: string;
    }) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === opts.email);
      if (existing) {
        await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: PASSWORD });
      } else {
        const { error } = await supabaseAdmin.auth.admin.createUser({
          email: opts.email,
          password: PASSWORD,
          email_confirm: true,
        });
        if (error) throw new Error(`Supabase createUser ${opts.email}: ${error.message}`);
      }

      const usuario = await prisma.usuario.upsert({
        where: { email: opts.email },
        update: { constructora_id: opts.constructora_id, rol_id: opts.rol_id, nombre: opts.nombre },
        create: {
          email: opts.email,
          nombre: opts.nombre,
          constructora_id: opts.constructora_id,
          rol_id: opts.rol_id,
        },
      });
      return usuario;
    }

    // ── 1. SUPER ADMIN (Karen + Victor) ──────────────────────────────────────
    await ensureUser({ ...USERS.superAdmin, constructora_id: sistema.id, rol_id: rolSuper.id });
    await ensureUser({ ...USERS.superAdmin2, constructora_id: sistema.id, rol_id: rolSuper.id });
    console.log("✓ Super Admins creados");

    // ── 2. ADMIN GENERAL ─────────────────────────────────────────────────────
    await ensureUser({
      ...USERS.adminGeneral,
      constructora_id: demo.id,
      rol_id: rolesDemoMap.ADMIN_GENERAL,
    });
    console.log("✓ Admin General creado en Constructora Demo Cali");

    // ── 3. ADMIN JUNIOR (ADMIN_PROYECTO) ─────────────────────────────────────
    const adminJunior = await ensureUser({
      ...USERS.adminJunior,
      constructora_id: demo.id,
      rol_id: rolesDemoMap.ADMIN_PROYECTO,
    });
    await prisma.adminProyectoAccess.upsert({
      where: { usuario_id_proyecto_id: { usuario_id: adminJunior.id, proyecto_id: proyecto.id } },
      update: {},
      create: { usuario_id: adminJunior.id, proyecto_id: proyecto.id },
    });
    console.log(`✓ Admin Junior creado y asignado a "${proyecto.nombre}"`);

    // ── 4. DIRECTIVO ─────────────────────────────────────────────────────────
    await ensureUser({
      ...USERS.directivo,
      constructora_id: demo.id,
      rol_id: rolesDemoMap.DIRECTIVO,
    });
    console.log("✓ Directivo creado");

    // ── 5. CONTRATISTA ───────────────────────────────────────────────────────
    const contratista = await ensureUser({
      ...USERS.contratista,
      constructora_id: demo.id,
      rol_id: rolesDemoMap.CONTRATISTA,
    });
    await prisma.contratista.upsert({
      where: { usuario_id: contratista.id },
      update: {},
      create: {
        usuario_id: contratista.id,
        score_cumplimiento: 0,
        score_calidad: 0,
        score_velocidad_correccion: 0,
        score_total: 0,
      },
    });
    console.log("✓ Contratista creado");

    // ── Resumen ──────────────────────────────────────────────────────────────
    console.log("\n✅ Listo. Credenciales (password único: Test1234!)\n");
    const rows = [
      ["🔴 SUPER ADMIN", USERS.superAdmin.email, "/super-admin"],
      ["🔴 SUPER ADMIN", USERS.superAdmin2.email, "/super-admin"],
      ["🟠 ADMIN GENERAL", USERS.adminGeneral.email, "/dashboard"],
      ["🟡 ADMIN JUNIOR", USERS.adminJunior.email, "/dashboard"],
      ["🟣 DIRECTIVO", USERS.directivo.email, "/directivo"],
      ["🟢 CONTRATISTA", USERS.contratista.email, "/contratista"],
    ];
    for (const [rol, email, ruta] of rows) {
      console.log(`  ${rol.padEnd(20)}  ${email.padEnd(45)}  ${siteUrl}${ruta}`);
    }
    console.log(`\n  Login URL: ${siteUrl}/login`);
    console.log("  Password:  Test1234!\n");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
