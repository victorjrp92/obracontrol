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
 * QUÉ SOBREVIVE, y no por descuido: `registros_precio`, `registros_duracion`,
 * `lista_espera_go`, `mensajes_contacto` y las tablas de Juntos no cuelgan de
 * `constructoras` ni de `proyectos`. En los dos `registros_*`, `constructora_id`
 * y `proyecto_id` son columnas sueltas SIN clave foránea, así que las filas
 * quedan con ids apuntando a nada. Es aprendizaje acumulado y se conserva a
 * propósito; el resumen lo enseña para que no sea una sorpresa.
 *
 * `--purgar-duraciones-viejas` tira además los registros de duración anteriores
 * al arreglo de la medición. Ver `CORTE_MEDICION_DURACION`.
 *
 * LAS FIRMAS SE RESCATAN. `documentos_firmables.constructora_id` es Cascade, así
 * que borrar la cuenta se llevaría por delante actas y planos ya FIRMADOS. Antes
 * de borrar se les suelta ese vínculo: siguen verificando por folio, porque el
 * folio, la huella y la matrícula viven en la propia fila y en el contenido
 * congelado en Storage. Los borradores sin firmar sí se van — no le prometieron
 * nada a nadie.
 *
 * Lo que no se puede salvar desde aquí: la IMAGEN de la firma en reimpresiones.
 * El PDF la estampa al imprimir leyéndola del perfil de quien firmó, y
 * `firmado_por_id` queda a NULL al borrar a esa persona. El documento sigue
 * siendo válido y comprobable —la matrícula está congelada en la fila— pero el
 * PDF sale sin la firma escaneada. Salvarla exigiría meterla en el contenido
 * congelado, que es un cambio del módulo de documentos, no de este script.
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

/**
 * Fecha de la migración `20260830110000_arquitecto_productos_documentos`, que
 * arregló la medición de duración. Antes de este momento `fecha_inicio` se
 * escribía al reportar la tarea TERMINADA, no al empezarla: `dias_reales` no
 * medía cuánto duró el trabajo, medía cuánto tardó el supervisor en aprobarlo.
 * Las filas anteriores son ruido con forma de dato.
 */
const CORTE_MEDICION_DURACION = new Date("2026-08-30T11:00:00.000Z");

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar");
  const purgarDuraciones = args.includes("--purgar-duraciones-viejas");
  const correos = args.filter((a) => !a.startsWith("--")).map((c) => c.trim().toLowerCase());

  if (correos.length === 0) {
    console.error("Falta indicar al menos un correo a conservar.");
    console.error("Uso: npx tsx scripts/limpiar-dejando-usuarios.ts [--ejecutar] [--purgar-duraciones-viejas] correo1 correo2 …");
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

    // ── 3b. Lo que NO se toca ───────────────────────────────────────────────
    // Estas tablas no cuelgan de `constructoras` ni de `proyectos`: en el caso
    // de los dos `registros_*`, `constructora_id` y `proyecto_id` son columnas
    // sueltas, sin clave foránea. Sobreviven al vaciado con los ids apuntando a
    // filas que ya no existen. No rompe nada —no hay FK que violar— pero deja
    // de poder cruzarse con nada.
    const [
      precios,
      duraciones,
      duracionesViejas,
      listaEspera,
      mensajes,
      juntos,
      docsJuntosLegado,
      docsSinTenant,
      docsFirmadosConTenant,
      docsBorradoresConTenant,
    ] = await Promise.all([
      prisma.registroPrecio.count(),
      prisma.registroDuracion.count(),
      prisma.registroDuracion.count({ where: { created_at: { lt: CORTE_MEDICION_DURACION } } }),
      prisma.listaEsperaGo.count(),
      prisma.mensajeContacto.count(),
      prisma.contactoJuntos.count(),
      prisma.documentoJuntos.count(),
      // Los de Juntos: `registrarDocumento` de la línea pública no pasa
      // `constructoraId`, así que quedan con NULL y la cascada no los alcanza.
      prisma.documentoFirmable.count({ where: { constructora_id: null } }),
      // Firmados con cuenta: se rescatan soltándoles el vínculo antes de borrar.
      prisma.documentoFirmable.count({
        where: { constructora_id: { not: null }, firmado_el: { not: null } },
      }),
      // Borradores sin firmar: se van con su cuenta. No le prometieron nada a nadie.
      prisma.documentoFirmable.count({
        where: { constructora_id: { not: null }, firmado_el: null },
      }),
    ]);

    console.log("\n─── Alcance ──────────────────────────────────────────────");
    console.log(`  Se conservan       ${conservados.length} usuarios (${superAdmins.length} super admin)`);
    console.log(`  Cuentas vivas      ${idsConstructorasVivas.length} de ${totalConstructoras}`);
    console.log("");
    console.log(`  SE BORRAN          ${usuariosABorrar} de ${totalUsuarios} usuarios`);
    console.log(`                     ${constructorasABorrar} de ${totalConstructoras} cuentas`);
    console.log(`                     ${totalProyectos} proyectos (todos)`);
    console.log(`                     ${totalTareas} tareas (todas, en cascada)`);
    console.log("");
    console.log(`  SE CONSERVAN       ${precios} registros de precio (aprendizaje)`);
    console.log(`                     ${duraciones} registros de duración (aprendizaje)`);
    console.log(`                     ${listaEspera} de lista de espera`);
    console.log(`                     ${mensajes} mensajes de contacto`);
    console.log("");
    console.log(`  SEIRICON JUNTOS    ${juntos} contactos`);
    console.log(`                     ${docsJuntosLegado} documentos en la tabla legada`);
    console.log(`                     ${docsSinTenant} documentos verificables sin cuenta`);
    console.log("──────────────────────────────────────────────────────────");

    if (docsFirmadosConTenant > 0) {
      console.log("");
      console.log(`  ✅ ${docsFirmadosConTenant} documentos FIRMADOS se rescatan de la cascada: se les`);
      console.log("      suelta el vínculo con la cuenta y siguen verificando por folio.");
      console.log("      Folio, huella y matrícula viven en la fila y en el contenido");
      console.log("      congelado, así que no se pierde nada de lo que se comprueba.");
      console.log("");
      console.log("      LO QUE SÍ SE PIERDE: la imagen de la firma en las reimpresiones.");
      console.log("      El PDF la estampa al imprimir leyéndola del perfil de quien firmó,");
      console.log("      y `firmado_por_id` queda a NULL al borrar a esa persona. El");
      console.log("      documento sigue siendo válido y verificable — la matrícula está");
      console.log("      congelada — pero el PDF sale sin la firma escaneada.");
    }
    if (docsBorradoresConTenant > 0) {
      console.log("");
      console.log(`  ⚠️  ${docsBorradoresConTenant} documentos SIN FIRMAR se van con su cuenta.`);
      console.log("      Un borrador no le prometió nada a nadie.");
    }

    if (duracionesViejas > 0) {
      console.log("");
      console.log(`  ⚠️  ${duracionesViejas} de esos ${duraciones} registros de duración son`);
      console.log(`      anteriores al ${CORTE_MEDICION_DURACION.toISOString().slice(0, 10)}, cuando \`fecha_inicio\` se escribía al`);
      console.log("      reportar terminado. Miden latencia de aprobación, no duración.");
      console.log("      Si el motor sigue aprendiendo de ellos, sigue equivocándose.");
      console.log("      Para tirarlos: añade --purgar-duraciones-viejas");
    }
    console.log("");

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

        // ── Rescate de los documentos FIRMADOS ───────────────────────────────
        // `documentos_firmables.constructora_id` es Cascade: al borrar la cuenta
        // se llevaría por delante actas y planos ya firmados. El producto
        // promete que un documento firmado sigue verificando siempre, y quien
        // tiene el PDF en la mano no es la cuenta que se borra: es su cliente.
        //
        // Soltarles el vínculo con la cuenta los salva de la cascada sin tocar
        // nada de lo que se verifica: folio, huella y matrícula viven en la
        // propia fila y en el contenido congelado en Storage.
        //
        // Los NO firmados se van con su cuenta. Un borrador no le prometió nada
        // a nadie.
        const firmasRescatadas = await tx.documentoFirmable.updateMany({
          where: {
            firmado_el: { not: null },
            constructora_id: { not: null, notIn: idsConstructorasVivas },
          },
          data: { constructora_id: null },
        });

        // Las cuentas se llevan en cascada sus usuarios, roles, clientes y demás.
        const cuentas = await tx.constructora.deleteMany({
          where: { id: { notIn: idsConstructorasVivas } },
        });

        // Y dentro de las cuentas que sobreviven, los usuarios que no están en
        // la lista.
        const usuarios = await tx.usuario.deleteMany({
          where: { email: { notIn: correos } },
        });

        // Solo si se pide: el aprendizaje de duración anterior al arreglo de la
        // medición. No se borra por defecto — es un dato del negocio, no del
        // vaciado, y la decisión de tirarlo debe ser explícita.
        const duracionesViejas = purgarDuraciones
          ? await tx.registroDuracion.deleteMany({
              where: { created_at: { lt: CORTE_MEDICION_DURACION } },
            })
          : { count: 0 };

        // ── Cerrojo de Juntos ────────────────────────────────────────────────
        // Que los documentos de la línea pública sobrevivan no depende de que
        // yo haya leído bien el esquema: se cuenta antes y después, y si el
        // número cambió se lanza y la transacción entera se deshace. Un acta
        // con su folio impreso en el PDF de una aseguradora no se puede perder
        // porque una cascada hiciera algo que no esperábamos.
        const juntosDespues = {
          contactos: await tx.contactoJuntos.count(),
          legado: await tx.documentoJuntos.count(),
          verificables: await tx.documentoFirmable.count({ where: { constructora_id: null } }),
        };
        // Los verificables sin cuenta SUBEN, y eso está previsto: son los de
        // Juntos (que ya estaban a NULL) más los firmados que acabamos de
        // rescatar soltándoles el vínculo. Comparar contra el número de antes,
        // a secas, haría saltar el cerrojo por un cambio que sí esperábamos.
        const verificablesEsperados = docsSinTenant + firmasRescatadas.count;
        if (
          juntosDespues.contactos !== juntos ||
          juntosDespues.legado !== docsJuntosLegado ||
          juntosDespues.verificables !== verificablesEsperados
        ) {
          throw new Error(
            "El borrado tocó datos que debían sobrevivir. Se deshace todo.\n" +
              `  contactos     ${juntos} → ${juntosDespues.contactos}\n` +
              `  legado        ${docsJuntosLegado} → ${juntosDespues.legado}\n` +
              `  verificables  esperaba ${verificablesEsperados}, hay ${juntosDespues.verificables}`,
          );
        }

        return { sugeridas, pagos, proyectos, obreros, cuentas, usuarios, duracionesViejas, firmasRescatadas };
      },
      { timeout: 300_000, maxWait: 20_000 },
    );

    console.log(`  tareas sugeridas   ${r.sugeridas.count}`);
    console.log(`  pagos contratista  ${r.pagos.count}`);
    console.log(`  proyectos          ${r.proyectos.count}`);
    console.log(`  obreros            ${r.obreros.count}`);
    console.log(`  cuentas            ${r.cuentas.count}`);
    console.log(`  usuarios           ${r.usuarios.count}`);
    if (purgarDuraciones) {
      console.log(`  duraciones viejas  ${r.duracionesViejas.count}`);
    }
    console.log(`  firmas rescatadas  ${r.firmasRescatadas.count} (documentos firmados que sobreviven)`);

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
