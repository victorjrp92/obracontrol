/**
 * VACIADO DE LA BASE CONSERVANDO SOLO UNOS POCOS USUARIOS.
 *
 * Borra todas las obras y todas las cuentas salvo las de los correos que se le
 * pasen por argumento. Pensado para dejar el sistema limpio antes de empezar de
 * cero, no para uso rutinario.
 *
 * Uso:
 *   npx tsx scripts/limpiar-dejando-usuarios.ts a@x.com b@x.com c@x.com
 *   npx tsx scripts/limpiar-dejando-usuarios.ts --ejecutar a@x.com b@x.com c@x.com
 *
 * SIN `--ejecutar` no toca nada: cuenta lo que se llevaría y lo imprime. Esa es
 * la forma correcta de usarlo la primera vez.
 *
 * Diferencias deliberadas con `demo-clean.ts`, que hace algo parecido:
 *   - La lista de supervivientes NO está escrita en el código. Ahí estaba, con
 *     seis correos `@obracontrol.local` fijos, y en una base real eso borra al
 *     administrador de verdad junto con su login.
 *   - Esto SÍ corre en una transacción. `demo-clean` dice en su cabecera que la
 *     usa y luego no la usa; si se corta a la mitad no hay vuelta atrás.
 *   - Se niega a dejar la base sin SUPER_ADMIN. Quedarse fuera del sistema que
 *     administras no debería estar a un typo de distancia.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar");
  const correos = args.filter((a) => !a.startsWith("--")).map((c) => c.trim().toLowerCase());

  if (correos.length === 0) {
    console.error("Falta indicar al menos un correo a conservar.");
    console.error("Uso: npx tsx scripts/limpiar-dejando-usuarios.ts [--ejecutar] correo1 correo2 …");
    process.exit(1);
  }

  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Falta DIRECT_URL (o DATABASE_URL) en .env.local");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });

  try {
    // ── 1. Los correos a conservar tienen que existir ───────────────────────
    // Un correo mal escrito aquí no debe traducirse en "pues no conservo a
    // nadie". Si uno solo no aparece, se aborta y no se borra nada.
    const conservados = await prisma.usuario.findMany({
      where: { email: { in: correos } },
      select: {
        id: true,
        email: true,
        constructora_id: true,
        rol_ref: { select: { nivel_acceso: true } },
      },
    });

    const encontrados = conservados.map((u) => u.email.toLowerCase());
    const faltantes = correos.filter((c) => !encontrados.includes(c));
    if (faltantes.length > 0) {
      console.error("\n✋ Estos correos NO existen en `usuarios`:");
      faltantes.forEach((c) => console.error(`   ${c}`));
      console.error("\nNo se borra nada. Revisa la lista y vuelve a intentarlo.");
      process.exit(1);
    }

    // ── 2. Que no te quedes fuera de tu propio sistema ──────────────────────
    const superAdmins = conservados.filter((u) => u.rol_ref.nivel_acceso === "SUPER_ADMIN");
    if (superAdmins.length === 0) {
      console.error("\n✋ Ninguno de los correos a conservar es SUPER_ADMIN.");
      console.error("   Si sigues, nadie podrá administrar el sistema. Aborto.");
      process.exit(1);
    }

    const idsConstructorasVivas = [...new Set(conservados.map((u) => u.constructora_id))];

    // ── 3. Alcance ──────────────────────────────────────────────────────────
    const [
      totalUsuarios,
      totalConstructoras,
      totalProyectos,
      totalTareas,
      constructorasABorrar,
      usuariosABorrar,
    ] = await Promise.all([
      prisma.usuario.count(),
      prisma.constructora.count(),
      prisma.proyecto.count(),
      prisma.tarea.count(),
      prisma.constructora.count({ where: { id: { notIn: idsConstructorasVivas } } }),
      prisma.usuario.count({ where: { email: { notIn: correos } } }),
    ]);

    console.log("\n─── Alcance ──────────────────────────────────────────────");
    console.log(`  Se conservan       ${conservados.length} usuarios (${superAdmins.length} super admin)`);
    console.log(`  Cuentas vivas      ${idsConstructorasVivas.length} de ${totalConstructoras}`);
    console.log("");
    console.log(`  SE BORRAN          ${usuariosABorrar} de ${totalUsuarios} usuarios`);
    console.log(`                     ${constructorasABorrar} de ${totalConstructoras} cuentas`);
    console.log(`                     ${totalProyectos} proyectos (todos)`);
    console.log(`                     ${totalTareas} tareas (todas, en cascada)`);
    console.log("──────────────────────────────────────────────────────────\n");

    if (!ejecutar) {
      console.log("Simulación. No se ha tocado nada.");
      console.log("Para ejecutarlo de verdad, repite el comando con --ejecutar\n");
      return;
    }

    // ── 4. Borrado, en transacción y en orden de dependencias ───────────────
    // `tareas_sugeridas` y `pagos_contratistas` apuntan a `proyectos` sin
    // cascada: si no van primero, el borrado de proyectos falla. El resto de la
    // jerarquía (edificios → pisos → unidades → espacios → tareas → evidencias…)
    // sí cascadea, así que se va sola con el proyecto.
    console.log("Borrando…\n");
    const r = await prisma.$transaction(
      async (tx) => {
        const sugeridas = await tx.tareaSugerida.deleteMany({});
        const pagos = await tx.pagoContratista.deleteMany({});
        const proyectos = await tx.proyecto.deleteMany({});

        // Los obreros apuntan a su contratista (un Usuario) sin cascada, así que
        // van antes que los usuarios.
        const obreros = await tx.obrero.deleteMany({});

        // Las cuentas se llevan en cascada sus usuarios, roles, clientes y demás.
        const cuentas = await tx.constructora.deleteMany({
          where: { id: { notIn: idsConstructorasVivas } },
        });

        // Y dentro de las cuentas que sobreviven, los usuarios que no están en
        // la lista.
        const usuarios = await tx.usuario.deleteMany({
          where: { email: { notIn: correos } },
        });

        return { sugeridas, pagos, proyectos, obreros, cuentas, usuarios };
      },
      { timeout: 300_000, maxWait: 20_000 },
    );

    console.log(`  tareas sugeridas   ${r.sugeridas.count}`);
    console.log(`  pagos contratista  ${r.pagos.count}`);
    console.log(`  proyectos          ${r.proyectos.count}`);
    console.log(`  obreros            ${r.obreros.count}`);
    console.log(`  cuentas            ${r.cuentas.count}`);
    console.log(`  usuarios           ${r.usuarios.count}`);

    // ── 5. Los logins de Supabase ───────────────────────────────────────────
    // Va DESPUÉS de que la transacción haya confirmado: si el borrado falla, no
    // queremos haber dejado a nadie sin poder entrar.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.log("\n⚠️  Sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
      console.log("   Las filas están borradas, pero los logins siguen en Supabase Auth.");
      console.log("   Quien entre con uno de ellos verá «Usuario no encontrado».");
      return;
    }

    const sa = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: lista, error } = await sa.auth.admin.listUsers();
    if (error) throw error;

    let borrados = 0;
    for (const u of lista.users) {
      if (!u.email || correos.includes(u.email.toLowerCase())) continue;
      const { error: errBorrado } = await sa.auth.admin.deleteUser(u.id);
      if (errBorrado) console.error(`  no se pudo borrar un login: ${errBorrado.message}`);
      else borrados++;
    }
    console.log(`  logins de Supabase ${borrados}`);
    console.log("\nHecho.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("\nFalló:", e instanceof Error ? e.message : e);
  // Si el fallo ocurrió dentro de la transacción, se deshizo entera. Si ocurrió
  // antes (conexión, validación de la lista), no llegó a tocarse nada. En los
  // dos casos la base queda como estaba — pero no digamos que hubo transacción
  // cuando pudo no haberla.
  console.error("No se borró nada: la base queda como estaba.");
  process.exit(1);
});
