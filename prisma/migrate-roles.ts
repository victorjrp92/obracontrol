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

// Default roles per constructora
const DEFAULT_ROLES = [
  { nombre: "Administrador", nivel_acceso: "ADMINISTRADOR" as const, es_default: true },
  { nombre: "Director de obra", nivel_acceso: "DIRECTIVO" as const, es_default: true },
  { nombre: "Coordinador", nivel_acceso: "DIRECTIVO" as const, es_default: true },
  { nombre: "Asistente", nivel_acceso: "DIRECTIVO" as const, es_default: true },
  { nombre: "Auxiliar de obra", nivel_acceso: "DIRECTIVO" as const, es_default: true },
  { nombre: "Contratista instalador", nivel_acceso: "CONTRATISTA" as const, es_default: true },
  { nombre: "Contratista lustrador", nivel_acceso: "CONTRATISTA" as const, es_default: true },
  { nombre: "Obrero", nivel_acceso: "OBRERO" as const, es_default: true },
];

// Mapping from old RolUsuario enum to new Rol name
const ROL_MAPPING: Record<string, string> = {
  ADMIN: "Administrador",
  JEFE_OPERACIONES: "Director de obra",
  COORDINADOR: "Coordinador",
  ASISTENTE: "Asistente",
  AUXILIAR: "Auxiliar de obra",
  CONTRATISTA_INSTALADOR: "Contratista instalador",
  CONTRATISTA_LUSTRADOR: "Contratista lustrador",
};

async function main() {
  console.log("🔄 Starting role data migration...\n");

  // 1. Get all constructoras
  const constructoras = await prisma.constructora.findMany();
  console.log(`Found ${constructoras.length} constructora(s)\n`);

  for (const constructora of constructoras) {
    console.log(`── Constructora: ${constructora.nombre} ──`);

    // 2. Create 8 default roles for each constructora
    const createdRoles: Record<string, string> = {};
    for (const rolDef of DEFAULT_ROLES) {
      const rol = await prisma.rol.upsert({
        where: {
          constructora_id_nombre: {
            constructora_id: constructora.id,
            nombre: rolDef.nombre,
          },
        },
        update: {},
        create: {
          constructora_id: constructora.id,
          nombre: rolDef.nombre,
          nivel_acceso: rolDef.nivel_acceso,
          es_default: rolDef.es_default,
        },
      });
      createdRoles[rolDef.nombre] = rol.id;
    }
    console.log(`  ✓ Created/verified ${DEFAULT_ROLES.length} default roles`);

    // 3. Map existing users to new roles
    // Note: This script was designed to run BEFORE the second migration that removed the `rol` column.
    // After that migration, this script is no longer needed. We use raw SQL for forward-compatibility.
    const usuarios = await prisma.$queryRaw<Array<{ id: string; email: string; rol: string }>>`
      SELECT id, email, rol::text FROM usuarios WHERE constructora_id = ${constructora.id}
    `.catch(() => [] as Array<{ id: string; email: string; rol: string }>);

    let mapped = 0;
    for (const usuario of usuarios) {
      const newRolName = ROL_MAPPING[usuario.rol];
      if (newRolName && createdRoles[newRolName]) {
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: { rol_id: createdRoles[newRolName] },
        });
        mapped++;
      } else {
        console.log(`  ⚠ No mapping for user ${usuario.email} with rol ${usuario.rol}`);
      }
    }
    console.log(`  ✓ Mapped ${mapped}/${usuarios.length} users to new roles\n`);
  }

  console.log("✅ Role data migration completed successfully");
}

main()
  .catch((e) => {
    console.error("❌ Error in role migration:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
