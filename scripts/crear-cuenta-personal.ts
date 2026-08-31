/**
 * ALTA DE UNA CUENTA PERSONAL (ARQUITECTO / CONTRATISTA / PROPIETARIO).
 *
 * Crea las dos mitades que hacen falta para que alguien pueda entrar:
 *   1. El login en Supabase Auth, con contraseña y correo ya confirmado.
 *   2. La cuenta, los roles y el usuario en Postgres.
 *
 * Uso:
 *   npx tsx scripts/crear-cuenta-personal.ts \
 *     --email jc.arquitecto@obracontrol.local \
 *     --nombre "Juan Carlos Rincón" \
 *     --tipo ARQUITECTO \
 *     --estudio "Estudio Juan Carlos Rincón"
 *
 * La contraseña se genera al azar y se imprime UNA vez, al final. Con
 * `--password <clave>` se fija a mano.
 *
 * Por qué existe pudiendo usar `seed-personal-users.ts`: ese tiene los perfiles
 * escritos en el código y su tipo es `Extract<TipoCuenta, "CONTRATISTA" |
 * "PROPIETARIO">`, así que no admite ARQUITECTO — es la misma lista blanca
 * incompleta que ya apareció en `actions.ts`, en el callback y en los tours.
 * Este toma el perfil por argumento y no puede quedarse corto otra vez.
 *
 * La parte de Postgres NO se reimplementa: llama a `provisionarPersonal`, la
 * misma función que usa el registro real. Duplicarla es justo lo que hizo que
 * los perfiles se desincronizaran.
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: ".env" });

const TIPOS_PERSONALES = ["ARQUITECTO", "CONTRATISTA", "PROPIETARIO"] as const;
type TipoPersonal = (typeof TIPOS_PERSONALES)[number];

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Contraseña legible pero no adivinable. Símbolo y dígito garantizados. */
function generarPassword(): string {
  return `${randomBytes(9).toString("base64url")}7!`;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const nombre = arg("nombre")?.trim();
  const tipo = arg("tipo")?.trim().toUpperCase() as TipoPersonal | undefined;
  const estudio = arg("estudio")?.trim();
  const password = arg("password") ?? generarPassword();

  if (!email || !nombre || !tipo) {
    console.error("Faltan argumentos. Uso:");
    console.error("  npx tsx scripts/crear-cuenta-personal.ts --email <correo> --nombre <nombre> --tipo <ARQUITECTO|CONTRATISTA|PROPIETARIO> [--estudio <nombre>] [--password <clave>]");
    process.exit(1);
  }
  if (!TIPOS_PERSONALES.includes(tipo)) {
    console.error(`Tipo no válido: ${tipo}. Debe ser uno de ${TIPOS_PERSONALES.join(", ")}.`);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!supabaseUrl || !serviceKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  if (!dbUrl) throw new Error("Falta DIRECT_URL (o DATABASE_URL) en .env.local");

  // Importación dinámica: `@/lib/prisma` construye su cliente al cargarse
  // leyendo DATABASE_URL, así que tiene que ser DESPUÉS de dotenv.
  const { prisma } = await import("@/lib/prisma");
  const { provisionarPersonal } = await import("@/lib/onboarding");

  try {
    // ── Comprobación previa ────────────────────────────────────────────────
    // `provisionarPersonal` inserta en `constructoras`, y Prisma devuelve TODAS
    // las columnas del modelo. Si falta la migración de suscripciones, revienta
    // con un error de columna inexistente que no dice nada útil. Mejor avisar.
    const columnas = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'constructoras'
        AND column_name = 'estado_suscripcion'
    `;
    if (columnas.length === 0) {
      console.error("\n✋ Falta la migración de suscripciones en esta base.");
      console.error("   `constructoras` no tiene la columna `estado_suscripcion`, y el");
      console.error("   cliente de Prisma la espera. Corre antes:\n");
      console.error("     npm run db:migrate-deploy\n");
      process.exit(1);
    }

    const yaExiste = await prisma.usuario.findUnique({ where: { email } });

    // ── 1. El login ────────────────────────────────────────────────────────
    const sa = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: lista, error: errLista } = await sa.auth.admin.listUsers();
    if (errLista) throw new Error(`listUsers: ${errLista.message}`);
    const authExistente = lista.users.find((u) => u.email?.toLowerCase() === email);

    if (authExistente) {
      const { error } = await sa.auth.admin.updateUserById(authExistente.id, { password });
      if (error) throw new Error(`updateUserById: ${error.message}`);
      console.log(`✓ El login ya existía — contraseña restablecida.`);
    } else {
      const { error } = await sa.auth.admin.createUser({
        email,
        password,
        // Sin esto queda pendiente de confirmar por correo, y un dominio
        // `.local` no recibe correo: nunca podría entrar.
        email_confirm: true,
        user_metadata: { nombre, tipo_cuenta: tipo, estudio_nombre: estudio },
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      console.log(`✓ Login creado en Supabase Auth.`);
    }

    // ── 2. La cuenta en Postgres ───────────────────────────────────────────
    if (yaExiste) {
      console.log(`✓ La cuenta en la base ya existía — no se toca.`);
    } else {
      await provisionarPersonal(email, nombre, tipo, { estudioNombre: estudio });
      console.log(`✓ Cuenta, roles y usuario creados.`);
    }

    // ── 3. Resumen ─────────────────────────────────────────────────────────
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: {
        nombre: true,
        rol_ref: { select: { nombre: true, nivel_acceso: true } },
        constructora: { select: { nombre: true, tipo_cuenta: true, plan_suscripcion: true } },
      },
    });
    if (!usuario) throw new Error("La cuenta no quedó creada. Revisa el error anterior.");

    console.log("\n─── Cuenta lista ─────────────────────────────────────────");
    console.log(`  Correo      ${email}`);
    console.log(`  Contraseña  ${password}`);
    console.log(`  Nombre      ${usuario.nombre}`);
    console.log(`  Rol         ${usuario.rol_ref.nombre} (${usuario.rol_ref.nivel_acceso})`);
    console.log(`  Cuenta      ${usuario.constructora.nombre}`);
    console.log(`  Perfil      ${usuario.constructora.tipo_cuenta}`);
    console.log(`  Plan        ${usuario.constructora.plan_suscripcion}`);
    console.log("──────────────────────────────────────────────────────────");
    console.log("\n  Que cambie la contraseña al entrar.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("\nFalló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
