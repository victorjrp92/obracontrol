import { PrismaClient } from "../src/generated/prisma";
import type { TipoCuenta } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Carga ambos archivos por compatibilidad (.env.local es la convención del repo,
// pero el setup actual usa .env)
config({ path: ".env.local" });
config({ path: ".env" });

const PASSWORD = "Test1234!";

const PERFILES = [
  {
    email: "propietario.test@obracontrol.local",
    nombre: "Pedro Propietario",
    tipoCuenta: "PROPIETARIO" as const,
    estudioNombre: undefined as string | undefined,
  },
  {
    email: "arquitecto.test@obracontrol.local",
    nombre: "Ana Arquitecta",
    tipoCuenta: "ARQUITECTO" as const,
    estudioNombre: "Estudio Ana",
  },
];

async function ensurePerfil(
  prisma: PrismaClient,
  supabaseAdmin: SupabaseClient,
  perfil: { email: string; nombre: string; tipoCuenta: Extract<TipoCuenta, "ARQUITECTO" | "PROPIETARIO">; estudioNombre?: string },
) {
  const { email, nombre, tipoCuenta, estudioNombre } = perfil;
  const esArquitecto = tipoCuenta === "ARQUITECTO";

  // 1. Auth user en Supabase (idempotente, ya confirmado para poder loguear)
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);
  const existente = list?.users.find((u) => u.email === email);
  if (!existente) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nombre, tipo_cuenta: tipoCuenta, estudio_nombre: estudioNombre },
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    console.log(`✓ Auth user creado: ${email}`);
  } else {
    await supabaseAdmin.auth.admin.updateUserById(existente.id, { password: PASSWORD });
    console.log(`✓ Auth user existente, password reseteado: ${email}`);
  }

  // 2. Usuario en Postgres (si ya existe, solo aseguramos tipo_cuenta/plan)
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { constructora: true },
  });

  if (usuario) {
    await prisma.constructora.update({
      where: { id: usuario.constructora_id },
      data: { tipo_cuenta: tipoCuenta, plan_suscripcion: "PERSONAL" },
    });
    console.log(`✓ Cuenta personal actualizada: ${email} (${tipoCuenta})`);
    return;
  }

  // 3. Crear constructora + rol(es) + usuario (espejo de provisionarPersonal)
  const constructora = await prisma.constructora.create({
    data: {
      nombre: estudioNombre?.trim() || (esArquitecto ? `Estudio de ${nombre}` : `Obra de ${nombre}`),
      plan_suscripcion: "PERSONAL",
      tipo_cuenta: tipoCuenta,
    },
  });

  const rolAdmin = await prisma.rol.create({
    data: {
      constructora_id: constructora.id,
      nombre: esArquitecto ? "Arquitecto" : "Propietario",
      nivel_acceso: "ADMIN_GENERAL",
      es_default: true,
    },
  });

  if (esArquitecto) {
    await prisma.rol.create({
      data: {
        constructora_id: constructora.id,
        nombre: "Contratista",
        nivel_acceso: "CONTRATISTA",
        es_default: true,
      },
    });
  }

  await prisma.usuario.create({
    data: { email, nombre, constructora_id: constructora.id, rol_id: rolAdmin.id },
  });
  console.log(`✓ Cuenta personal creada: ${email} (${tipoCuenta})`);
}

async function main() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!databaseUrl || databaseUrl.includes("localhost:5432")) {
    throw new Error("DIRECT_URL/DATABASE_URL no apunta a un Postgres real. Pega tus credenciales de Supabase en .env");
  }
  if (!supabaseUrl || supabaseUrl.includes("your-project")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no está configurado en .env");
  }
  if (!serviceRoleKey || serviceRoleKey === "your-service-role-key") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurado en .env");
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log("🌱 Creando usuarios de prueba (perfiles personales)...\n");
    for (const perfil of PERFILES) {
      await ensurePerfil(prisma, supabaseAdmin, perfil);
    }

    console.log("\n✅ Listo. Credenciales de prueba:\n");
    console.log("── PROPIETARIO (persona natural) ───────────────────");
    console.log(`  URL:      ${siteUrl}/login`);
    console.log(`  Email:    propietario.test@obracontrol.local`);
    console.log(`  Password: ${PASSWORD}`);
    console.log("\n── ARQUITECTO ──────────────────────────────────────");
    console.log(`  URL:      ${siteUrl}/login`);
    console.log(`  Email:    arquitecto.test@obracontrol.local`);
    console.log(`  Password: ${PASSWORD}`);
    console.log("\nAl entrar (sin obras) caen directo en el asistente /empezar.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
