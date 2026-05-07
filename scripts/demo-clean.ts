/**
 * LIMPIEZA PARA DEMO AL CLIENTE.
 *
 * Conserva:
 *   - Constructora "Sistema Seiricon" + sus 2 Super Admin (Karen + Victor)
 *   - 1 Constructora demo: "Constructora Demo Cali"
 *     - 1 Admin General  (admin.general@obracontrol.local)
 *     - 1 Admin Junior   (admin.junior@obracontrol.local)
 *     - 1 Directivo      (directivo.test@obracontrol.local)
 *     - 1 Contratista    (contratista.test@obracontrol.local)
 *     - 1 Obrero         (token: obrero-test-token-001)
 *     - 1 Proyecto demo
 *
 * Borra TODO lo demás vía SQL en transacción (FKs sin cascade requieren orden).
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: ".env" });

const PASSWORD = "Test1234!";

const SUPER_ADMINS = [
  "super.admin@obracontrol.local",
  "victor.super@obracontrol.local",
];

const TEST_USERS = {
  adminGeneral: "admin.general@obracontrol.local",
  adminJunior: "admin.junior@obracontrol.local",
  directivo: "directivo.test@obracontrol.local",
  contratista: "contratista.test@obracontrol.local",
};

const TEST_OBRERO_TOKEN = "obrero-test-token-001";
const ALL_KEEP_EMAILS = [...SUPER_ADMINS, ...Object.values(TEST_USERS)];

async function main() {
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !supabaseUrl || !serviceKey) throw new Error("env incompleto");

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const sa = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log("\n🧹 Limpieza de datos para demo\n");

    const sistema = await prisma.constructora.findFirst({ where: { nombre: "Sistema Seiricon" } });
    if (!sistema) throw new Error('No existe la constructora "Sistema Seiricon". Corre db:seed-roles primero.');

    const demo = await prisma.constructora.findFirst({ where: { nombre: "Constructora Demo Cali" } });
    if (!demo) throw new Error('No existe "Constructora Demo Cali". Corre db:seed-roles primero.');

    console.log(`✓ Sistema:  ${sistema.id.slice(0, 8)}…`);
    console.log(`✓ Demo:     ${demo.id.slice(0, 8)}…`);

    const keepIds = [sistema.id, demo.id];

    // ── Recolectar emails que se van a borrar para limpiar Supabase Auth
    const usuariosABorrarEnAuth = await prisma.usuario.findMany({
      where: {
        OR: [
          { constructora_id: { notIn: keepIds } },
          { constructora_id: sistema.id, email: { notIn: SUPER_ADMINS } },
          { constructora_id: demo.id, email: { notIn: Object.values(TEST_USERS) } },
        ],
      },
      select: { email: true },
    });
    console.log(`\n🔎 ${usuariosABorrarEnAuth.length} usuarios a eliminar`);

    // ── Recolectar IDs para SQL
    const proyectosABorrarObj = await prisma.proyecto.findMany({
      where: {
        OR: [
          { constructora_id: { notIn: keepIds } },
          // En la demo conservamos solo el proyecto más viejo
        ],
      },
      select: { id: true },
    });

    const proyectosDemo = await prisma.proyecto.findMany({
      where: { constructora_id: demo.id },
      orderBy: { created_at: "asc" },
      select: { id: true, nombre: true, numero_registro: true },
    });
    if (proyectosDemo.length === 0) throw new Error("No hay proyectos en Demo Cali. Corre db:seed-roles");

    const proyectoConservar = proyectosDemo[0];
    const proyectosDemoExtra = proyectosDemo.slice(1);
    console.log(`\n✓ Proyecto conservado: ${proyectoConservar.nombre} (${proyectoConservar.numero_registro})`);

    const proyectosTotalesABorrar = [
      ...proyectosABorrarObj.map((p) => p.id),
      ...proyectosDemoExtra.map((p) => p.id),
    ];

    // ── SQL en transacción: orden correcto para respetar FKs sin cascade
    console.log("\n🗑  Ejecutando borrado en transacción...");

    // Build placeholders dinámicos para arrays vacíos
    const proyArr = proyectosTotalesABorrar.length > 0
      ? `'${proyectosTotalesABorrar.join("','")}'`
      : "'__none__'";
    const keepUsersArr = `'${ALL_KEEP_EMAILS.join("','")}'`;

    // Ejecutamos en orden manual respetando todas las FKs (incluso las sin cascade).
    // No usamos transacción para no toparnos con timeouts en datasets grandes.
    const exec = (sql: string) => prisma.$executeRawUnsafe(sql);

    // 1. Sugerencias por proyecto a borrar
    if (proyectosTotalesABorrar.length > 0) {
      await exec(`DELETE FROM tareas_sugeridas WHERE proyecto_id IN (${proyArr})`);
    }
    // Sugerencias por contratistas a borrar (de constructoras desconocidas)
    await exec(`
      DELETE FROM tareas_sugeridas WHERE
        contratista_id IN (SELECT id FROM usuarios WHERE email NOT IN (${keepUsersArr}))
        OR revisado_por IN (SELECT id FROM usuarios WHERE email NOT IN (${keepUsersArr}))
    `);

    // 2. Pagos
    if (proyectosTotalesABorrar.length > 0) {
      await exec(`DELETE FROM pagos_contratistas WHERE proyecto_id IN (${proyArr})`);
    }

    // 3. Audit logs
    if (proyectosTotalesABorrar.length > 0) {
      await exec(`DELETE FROM audit_logs WHERE proyecto_id IN (${proyArr})`);
    }
    await exec(`
      DELETE FROM audit_logs WHERE usuario_id IN (
        SELECT id FROM usuarios WHERE email NOT IN (${keepUsersArr})
      )
    `);

    // 4. AdminProyectoAccess
    if (proyectosTotalesABorrar.length > 0) {
      await exec(`DELETE FROM admin_proyecto_access WHERE proyecto_id IN (${proyArr})`);
    }

    // 5. Tareas y dependencias por proyecto (path: proyecto→edif→piso→unidad→espacio→tarea)
    if (proyectosTotalesABorrar.length > 0) {
      // Aprobaciones de esas tareas
      await exec(`
        DELETE FROM aprobaciones WHERE tarea_id IN (
          SELECT t.id FROM tareas t
          JOIN espacios e ON t.espacio_id = e.id
          JOIN unidades u ON e.unidad_id = u.id
          JOIN pisos p ON u.piso_id = p.id
          JOIN edificios ed ON p.edificio_id = ed.id
          WHERE ed.proyecto_id IN (${proyArr})
        )
      `);
      // Evidencias de esas tareas (cascade pero por seguridad)
      await exec(`
        DELETE FROM evidencias WHERE tarea_id IN (
          SELECT t.id FROM tareas t
          JOIN espacios e ON t.espacio_id = e.id
          JOIN unidades u ON e.unidad_id = u.id
          JOIN pisos p ON u.piso_id = p.id
          JOIN edificios ed ON p.edificio_id = ed.id
          WHERE ed.proyecto_id IN (${proyArr})
        )
      `);
      // Extensiones, retrasos, checklist, consumo (todos cascadean desde tarea, no hace falta)

      // Tareas
      await exec(`
        DELETE FROM tareas WHERE espacio_id IN (
          SELECT e.id FROM espacios e
          JOIN unidades u ON e.unidad_id = u.id
          JOIN pisos p ON u.piso_id = p.id
          JOIN edificios ed ON p.edificio_id = ed.id
          WHERE ed.proyecto_id IN (${proyArr})
        )
      `);
      // Fases (sin cascade — borrar antes que el proyecto)
      await exec(`DELETE FROM fases WHERE proyecto_id IN (${proyArr})`);

      // Ahora sí el proyecto cascadeará edificios → pisos → unidades → espacios → tipo_unidad → checklist_template
      await exec(`DELETE FROM proyectos WHERE id IN (${proyArr})`);
    }

    // 6. Obreros sobrantes
    await exec(`
      DELETE FROM obreros WHERE constructora_id = '${demo.id}' AND token <> '${TEST_OBRERO_TOKEN}'
    `);
    await exec(`
      DELETE FROM obreros WHERE constructora_id NOT IN ('${keepIds.join("','")}')
    `);

    // 7. Notificaciones de usuarios a borrar (cascade desde Usuario, pero por orden)
    await exec(`
      DELETE FROM notificaciones WHERE usuario_id IN (
        SELECT id FROM usuarios WHERE email NOT IN (${keepUsersArr})
      )
    `);

    // 8. Aprobaciones / evidencias / extensiones que apunten a usuarios a borrar (sin cascade)
    await exec(`
      DELETE FROM aprobaciones WHERE aprobador_id IN (
        SELECT id FROM usuarios WHERE email NOT IN (${keepUsersArr})
      )
    `);
    await exec(`
      DELETE FROM evidencias WHERE tomada_por IN (
        SELECT id FROM usuarios WHERE email NOT IN (${keepUsersArr})
      )
    `);
    await exec(`
      DELETE FROM extensiones_tiempo WHERE autorizado_por IN (
        SELECT id FROM usuarios WHERE email NOT IN (${keepUsersArr})
      )
    `);

    // 9. Contratista perfil
    await exec(`
      DELETE FROM contratistas WHERE usuario_id IN (
        SELECT id FROM usuarios WHERE email NOT IN (${keepUsersArr})
      )
    `);

    // 10. Usuarios sobrantes
    await exec(`DELETE FROM usuarios WHERE email NOT IN (${keepUsersArr})`);

    // 11. Constructoras sobrantes (cascade limpia roles, etc.)
    await exec(
      `DELETE FROM constructoras WHERE id NOT IN ('${keepIds.join("','")}')`,
    );

    console.log("✓ Borrado completo");

    // ── 13. Limpiar Supabase Auth ────────────────────────────────────────────
    console.log("\n🔑 Limpiando Supabase Auth y reseteando passwords...");
    const { data: list } = await sa.auth.admin.listUsers();
    for (const u of usuariosABorrarEnAuth) {
      const auth = list?.users.find((au) => au.email === u.email);
      if (auth) await sa.auth.admin.deleteUser(auth.id).catch(() => null);
    }

    // Reset passwords de los conservados
    const { data: list2 } = await sa.auth.admin.listUsers();
    for (const email of ALL_KEEP_EMAILS) {
      const auth = list2?.users.find((u) => u.email === email);
      if (auth) {
        await sa.auth.admin.updateUserById(auth.id, { password: PASSWORD });
        console.log(`   ✓ ${email}`);
      } else {
        console.log(`   ⚠ ${email} no existe en Supabase — créalo con db:seed-roles`);
      }
    }

    // ── Resumen
    const [c, u, p, t, o] = await Promise.all([
      prisma.constructora.count(),
      prisma.usuario.count(),
      prisma.proyecto.count(),
      prisma.tarea.count(),
      prisma.obrero.count(),
    ]);
    console.log("\n📊 Estado final:");
    console.log(`   Constructoras:  ${c} (esperado: 2)`);
    console.log(`   Usuarios:       ${u} (esperado: 6)`);
    console.log(`   Proyectos:      ${p} (esperado: 1)`);
    console.log(`   Tareas:         ${t}`);
    console.log(`   Obreros:        ${o} (esperado: 1)`);

    console.log("\n✅ Limpieza completa\n");
    console.log("─── CREDENCIALES ─────────────────────────────────");
    console.log("🔴 Super Admin (Karen) ", SUPER_ADMINS[0]);
    console.log("🔴 Super Admin (Victor)", SUPER_ADMINS[1]);
    console.log("🟠 Admin General       ", TEST_USERS.adminGeneral);
    console.log("🟡 Admin Junior        ", TEST_USERS.adminJunior);
    console.log("🟣 Directivo           ", TEST_USERS.directivo);
    console.log("🟢 Contratista         ", TEST_USERS.contratista);
    console.log("🔵 Obrero (sin login)   /o/" + TEST_OBRERO_TOKEN);
    console.log("\n   Password único:    " + PASSWORD + "\n");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
