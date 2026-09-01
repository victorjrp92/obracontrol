/**
 * PRUEBA DE LOGIN REAL, cuenta por cuenta.
 *
 * No comprueba que una fila exista: hace `signInWithPassword` contra Supabase
 * con la MISMA clave pública que usa el navegador, así que si aquí entra, entra
 * en el producto. Y después mira si esa sesión encuentra su cuenta en la base,
 * que es la otra mitad y la que suele faltar.
 *
 * Uso:
 *   npx tsx scripts/probar-login.ts correo:clave [correo:clave …]
 *   npx tsx scripts/probar-login.ts --seeds        (los @obracontrol.local)
 *
 * LAS CONTRASEÑAS NO SE PUEDEN AVERIGUAR. Supabase guarda un hash bcrypt en
 * `auth.users.encrypted_password`; no hay consulta que las devuelva. Este script
 * COMPRUEBA una contraseña que ya conoces, no la descubre. Para las que nadie
 * recuerda, el camino es restablecerlas — no leerlas.
 *
 * Los tres diagnósticos que distingue, que es de lo que se trata:
 *   LOGIN FALLA          — la contraseña no es esa, o el correo no está en Auth.
 *   ENTRA PERO SIN CUENTA — el login vale y no hay fila en `usuarios`. Es la
 *                          «cuenta fantasma»: el registro se creó en Supabase y
 *                          el aprovisionamiento falló en silencio (esos
 *                          `catch {}` de `actions.ts` y del callback). La
 *                          persona entra y el producto le dice que no existe.
 *   ENTRA Y TIENE CUENTA  — funciona de verdad.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** La que fijan los seeds del repo. No es un secreto: está en su código. */
const PASSWORD_SEEDS = "Test1234!";

const CUENTAS_SEED = [
  "super.admin@obracontrol.local",
  "victor.super@obracontrol.local",
  "admin.general@obracontrol.local",
  "admin.junior@obracontrol.local",
  "directivo.test@obracontrol.local",
  "contratista.test@obracontrol.local",
  "propietario.test@obracontrol.local",
];

async function main() {
  const args = process.argv.slice(2);

  const pares: { email: string; password: string }[] = args.includes("--seeds")
    ? CUENTAS_SEED.map((email) => ({ email, password: PASSWORD_SEEDS }))
    : args
        .filter((a) => !a.startsWith("--"))
        .map((a) => {
          // El correo no lleva `:`, así que el primero separa. Una contraseña
          // sí puede llevarlos, y por eso no se parte por todos.
          const i = a.indexOf(":");
          if (i < 0) throw new Error(`Formato esperado correo:clave — recibí "${a}"`);
          return { email: a.slice(0, i).trim().toLowerCase(), password: a.slice(i + 1) };
        });

  if (pares.length === 0) {
    console.error("Uso: npx tsx scripts/probar-login.ts correo:clave [correo:clave …]");
    console.error("     npx tsx scripts/probar-login.ts --seeds");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // La misma que usa el navegador (`src/lib/supabase/client.ts`). Con la de
  // servicio la prueba no valdría: esa se salta comprobaciones que el usuario
  // real sí atraviesa.
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url || !anon) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY en .env.local",
    );
  }
  if (!dbUrl) throw new Error("Falta DIRECT_URL (o DATABASE_URL) en .env.local");

  const { prisma } = await import("@/lib/prisma");

  let fallos = 0;
  try {
    for (const { email, password } of pares) {
      // Cliente nuevo por cuenta: uno compartido arrastraría la sesión anterior
      // y la segunda prueba diría que sí sin haber comprobado nada.
      const supabase = createClient(url, anon, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.session) {
        fallos++;
        console.log(`\n  ❌ ${email}`);
        console.log(`     LOGIN FALLA — ${error?.message ?? "sin sesión"}`);
        continue;
      }

      const usuario = await prisma.usuario.findUnique({
        where: { email },
        select: {
          nombre: true,
          rol_ref: { select: { nombre: true, nivel_acceso: true } },
          constructora: { select: { nombre: true, tipo_cuenta: true, plan_suscripcion: true } },
        },
      });

      await supabase.auth.signOut();

      if (!usuario) {
        fallos++;
        console.log(`\n  ⚠️  ${email}`);
        console.log("     ENTRA PERO NO TIENE CUENTA — cuenta fantasma.");
        console.log("     El login vale y no hay fila en `usuarios`: el producto");
        console.log("     le dirá «Usuario no encontrado» nada más entrar.");
        continue;
      }

      console.log(`\n  ✅ ${email}`);
      console.log(`     ${usuario.nombre} · ${usuario.rol_ref.nombre} (${usuario.rol_ref.nivel_acceso})`);
      console.log(`     ${usuario.constructora.nombre} · ${usuario.constructora.tipo_cuenta} · plan ${usuario.constructora.plan_suscripcion}`);
    }

    console.log(`\n─── ${pares.length - fallos} de ${pares.length} pueden entrar y trabajar ───\n`);
    if (fallos > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("\nFalló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
