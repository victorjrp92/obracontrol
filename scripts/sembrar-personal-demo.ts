/**
 * ─── Personal de obra para el demo de «Rosas Cali» ──────────────────────────
 *
 * El encargo era «agregar personal relacionado al dueño, como maestro o
 * residente de obra». Sembrar SOLO `Obrero` (hoy «Maestro») no lo resuelve:
 * la cuenta que se enseña en el demo es una CONSTRUCTORA, y en esa cuenta
 * ningún maestro tiene pantalla propia —`/dashboard/obreros` es un
 * `redirect("/dashboard")` y el equipo del proyecto solo los CUENTA por
 * contratista—. El único listado con nombre y scoring vive en
 * `/super-admin/obreros`, o sea fuera de la sesión del dueño.
 *
 * Por eso este script siembra DOS cosas, no una:
 *
 *   1. PERSONAL DE CAMPO (usuarios de nivel `PERSONAL_CAMPO`). Es el rol que
 *      SÍ se ve desde la cuenta de la constructora: sale en
 *      /dashboard/usuarios, en el equipo de la obra («N personal de campo»)
 *      y tiene su propia zona /campo con sus obras. Residentes y auxiliares
 *      de obra son exactamente esto.
 *
 *   2. MAESTROS (`Obrero`) colgados de los contratistas que ya trabajan en
 *      Rosas Cali, con evidencias repartidas y scoring calculado. No se ven
 *      desde la cuenta del dueño, pero sí desde el super admin y por su
 *      enlace `/o/[token]`, que es la pantalla que se le enseña al cliente
 *      cuando se explica cómo reporta la gente de obra.
 *
 * ── CÓMO SE REPARTEN LAS EVIDENCIAS (y qué se rompería si se hiciera mal) ──
 *
 * La app NO valida la coherencia entre `evidencias.obrero_id` y el
 * contratista de la tarea, pero `POST /api/o/[token]/evidencias` rechaza con
 * 403 cualquier reporte sobre una tarea cuyo `asignado_a` no sea el
 * `contratista_id` del maestro. Sembrar cruzado dejaría filas que la
 * aplicación nunca habría podido crear. Por eso cada maestro cuelga de un
 * contratista con tareas en Rosas Cali y solo recibe evidencias de tareas de
 * ESE contratista.
 *
 * Además el reparto es por FASE y la fase es la del oficio del maestro: el
 * electricista reporta «Instalaciones eléctricas», el enchapador «Enchapes y
 * pisos». Sale gratis y hace que el demo aguante la pregunta obvia («¿y este
 * señor qué hizo?»).
 *
 * `tomada_por` SE PONE A NULL en las evidencias que se reasignan. Es
 * deliberado: la ruta del maestro deja `tomada_por` en null y llena
 * `obrero_id`, así que una fila con los dos campos llenos no la produce nunca
 * la app. No se pierde nada recuperable: hoy TODAS las evidencias de Rosas
 * Cali tienen `tomada_por = tarea.asignado_a` (3.348 de 3.348, verificado),
 * así que el valor se reconstruye desde la tarea — y es justo lo que hace la
 * fase de limpieza de este mismo script al empezar.
 *
 * ── SCORING ────────────────────────────────────────────────────────────────
 * Poner `obrero_id` no recalcula nada: `recalcularScoreObrerosDeTarea` solo
 * corre al aprobar por API. Aquí se repite su cálculo usando las MISMAS
 * funciones de la app (`calcularScoringObrero`, `diasHabilesEntre`), no una
 * copia: si mañana cambia la fórmula, el demo cambia con ella.
 *
 * ── IDEMPOTENTE ────────────────────────────────────────────────────────────
 * Correrlo dos veces no duplica nada. Los usuarios se buscan por email, los
 * maestros por (constructora, cédula) y el reparto de evidencias es
 * determinista (tareas ordenadas por id). El token de un maestro que ya
 * existe NO se regenera: rotarlo invalidaría un enlace ya repartido.
 *
 * Uso:  npx tsx scripts/sembrar-personal-demo.ts
 */
import { PrismaClient } from "../src/generated/prisma";
import type { EspecialidadObrero } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generarTokenAcceso } from "../src/lib/tokens";
import { calcularScoringObrero } from "../src/lib/obrero";
import { diasHabilesEntre } from "../src/lib/calendario-colombia";

config({ path: ".env.local" });
config({ path: ".env" });

// ─── Contexto del demo ──────────────────────────────────────────────────────

const CONSTRUCTORA_ID = "cmokyx7oh0001tww2sdmub8pm"; // Constructora Altamonte S.A.S.
const PROYECTO_NOMBRE = "Rosas Cali";
const EMAIL_ADMIN = "admin.general@obracontrol.local";

/** La misma de todas las cuentas de prueba (demo-clean la reimpone). */
const PASSWORD = "Test1234!";

const UN_ANIO_MS = 365 * 24 * 60 * 60 * 1000;

// ─── Qué se siembra ─────────────────────────────────────────────────────────

/**
 * El cargo que ve el usuario es el NOMBRE DEL ROL, porque `Usuario` no tiene
 * campo «cargo» y `getRolLabel()` devuelve el nombre tal cual. Así que para
 * que el demo diga «residente» y «auxiliar» hay que crear dos roles de nivel
 * PERSONAL_CAMPO, además del genérico «Personal de campo» que ya existe.
 *
 * «Auxiliar de ingeniería» y no «Auxiliar de obra» A PROPÓSITO: ese segundo
 * nombre ya lo ocupa en esta constructora un rol de nivel OBRERO, y
 * `@@unique([constructora_id, nombre])` haría reventar el create con P2002.
 */
const ROL_RESIDENTE = "Residente de obra";
const ROL_AUXILIAR = "Auxiliar de ingeniería";
/** El que siembra `backfill-rol-personal-campo.ts`. Es el plan B. */
const ROL_PERSONAL_CAMPO = "Personal de campo";

interface PersonalCampoSemilla {
  email: string;
  nombre: string;
  telefono: string;
  /** Nombre del rol (= cargo visible). */
  cargo: string;
}

const PERSONAL_CAMPO: PersonalCampoSemilla[] = [
  {
    email: "mauricio.valencia@obracontrol.local",
    nombre: "Mauricio Andrés Valencia",
    telefono: "+57 315 550 2233",
    cargo: ROL_RESIDENTE,
  },
  {
    email: "diana.ospina@obracontrol.local",
    nombre: "Diana Carolina Ospina",
    telefono: "+57 316 428 7714",
    cargo: ROL_RESIDENTE,
  },
  {
    email: "yeison.balanta@obracontrol.local",
    nombre: "Yeison Andrés Balanta",
    telefono: "+57 320 771 4490",
    cargo: ROL_AUXILIAR,
  },
  {
    email: "leidy.murillo@obracontrol.local",
    nombre: "Leidy Johana Murillo",
    telefono: "+57 312 604 3318",
    cargo: ROL_AUXILIAR,
  },
];

interface MaestroSemilla {
  nombre: string;
  /** Distinta de la 1144000111, que ya usa «Diego Muñoz» en esta constructora. */
  cedula: string;
  telefono: string;
  especialidad: EspecialidadObrero;
  eps: string;
  arl: string;
  /** Nombre del contratista (usuario CONTRATISTA) con tareas en la obra. */
  contratista: string;
  /** Fase de la obra que reporta. Del oficio del maestro, no cualquiera. */
  fase: string;
  /** Cuántas tareas APROBADAS de esa fase se le atribuyen. */
  cupoAprobadas: number;
  /**
   * Cuántas NO_APROBADAS. No es adorno: sin rechazos, `score_calidad` y
   * `score_velocidad` salen 100 para todos y el ranking no distingue a nadie.
   * Con dos o tres, el demo enseña lo único que justifica el módulo: que el
   * sistema sabe quién repite trabajo.
   */
  cupoRechazadas: number;
}

const MAESTROS: MaestroSemilla[] = [
  {
    nombre: "Hernán Darío Zapata",
    cedula: "16789234",
    telefono: "3155502233",
    especialidad: "ALBANIL",
    eps: "SOS EPS",
    arl: "ARL Sura",
    contratista: "Jennifer",
    fase: "Mampostería",
    cupoAprobadas: 62,
    cupoRechazadas: 3,
  },
  {
    nombre: "Wilson Alberto Quiñones",
    cedula: "94318756",
    telefono: "3183340155",
    especialidad: "ENCHAPADOR",
    eps: "Emssanar",
    arl: "Positiva",
    contratista: "Jennifer",
    fase: "Enchapes y pisos",
    cupoAprobadas: 74,
    cupoRechazadas: 3,
  },
  {
    nombre: "José Norbey Caicedo",
    cedula: "14895023",
    telefono: "3107748120",
    especialidad: "ELECTRICISTA",
    eps: "Nueva EPS",
    arl: "ARL Sura",
    contratista: "Karen",
    fase: "Instalaciones eléctricas",
    cupoAprobadas: 48,
    cupoRechazadas: 0,
  },
  {
    nombre: "Álvaro Lozano Rengifo",
    cedula: "1130622418",
    telefono: "3224419087",
    especialidad: "PLOMERO",
    eps: "Emssanar",
    arl: "Colmena Seguros",
    contratista: "Karen",
    fase: "Instalaciones hidrosanitarias",
    cupoAprobadas: 52,
    cupoRechazadas: 2,
  },
  {
    nombre: "Gilberto Antonio Mosquera",
    cedula: "1144077902",
    telefono: "3016628431",
    especialidad: "ESTUCADOR",
    eps: "SOS EPS",
    arl: "Positiva",
    contratista: "Contratista de Prueba",
    fase: "Pañete y estuco",
    cupoAprobadas: 66,
    cupoRechazadas: 1,
  },
];

// ─── Infraestructura ────────────────────────────────────────────────────────

/**
 * DATABASE_URL y NO `DIRECT_URL ?? DATABASE_URL` como hace
 * `seed-personal-users.ts`. Razón medida, no preferencia: el DIRECT_URL de
 * este entorno trae `?sslmode=require`, y pg-connection-string lo trata hoy
 * como `verify-full`, que contra el certificado de Supabase falla con
 * «self-signed certificate in certificate chain» — y gana sobre cualquier
 * `ssl: { rejectUnauthorized: false }` que se pase en las opciones. Por el
 * pooler (DATABASE_URL) conecta sin más, que es lo que hace velocidad-rosas.
 */
function conectar() {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!databaseUrl || databaseUrl.includes("localhost:5432")) {
    throw new Error("DATABASE_URL no apunta a un Postgres real (revisa .env.local)");
  }
  if (!supabaseUrl || supabaseUrl.includes("your-project")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no está configurado");
  }
  if (!serviceRoleKey || serviceRoleKey === "your-service-role-key") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurado");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { pool, prisma, supabaseAdmin };
}

/**
 * Busca un usuario de Supabase Auth por email recorriendo TODAS las páginas.
 *
 * `listUsers()` a secas devuelve solo los primeros 50 (es lo que hace
 * `seed-personal-users.ts`). Con un tenant de más de 50 cuentas eso no es un
 * detalle: el script creería que el usuario no existe, llamaría a
 * `createUser` y se estrellaría contra «email already registered», o sea
 * dejaría de ser idempotente justo cuando más falta hace.
 */
async function buscarAuthUser(supabaseAdmin: SupabaseClient, email: string) {
  const PER_PAGE = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const encontrado = data.users.find((u) => u.email === email);
    if (encontrado) return encontrado;
    if (data.users.length < PER_PAGE) return null;
  }
  return null;
}

/**
 * Cuenta de Supabase Auth para el email dado. Sin esto el Usuario de Postgres
 * no puede entrar: el login resuelve por el email de la sesión de Supabase,
 * así que una fila suelta en `usuarios` es un usuario que no existe.
 *
 * Se crea con `email_confirm: true` para saltarse el correo de verificación
 * —que además iría a un dominio `.local` que no recibe nada—.
 */
async function asegurarAuthUser(supabaseAdmin: SupabaseClient, email: string, nombre: string) {
  const existente = await buscarAuthUser(supabaseAdmin, email);
  if (existente) {
    await supabaseAdmin.auth.admin.updateUserById(existente.id, { password: PASSWORD });
    return "existente" as const;
  }
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return "creado" as const;
}

// ─── Fases del sembrado ─────────────────────────────────────────────────────

/**
 * Rol de nivel PERSONAL_CAMPO con el nombre pedido. Si el nombre ya está
 * ocupado por un rol de OTRO nivel no se toca nada (sería un P2002 contra
 * `@@unique([constructora_id, nombre])`) y se cae al rol genérico: mejor un
 * cargo menos preciso que un script que revienta a medias.
 */
async function asegurarRol(prisma: PrismaClient, nombre: string, fallbackId: string) {
  const existente = await prisma.rol.findFirst({
    where: { constructora_id: CONSTRUCTORA_ID, nombre },
  });
  if (existente) {
    if (existente.nivel_acceso === "PERSONAL_CAMPO") return existente.id;
    console.warn(
      `⚠️  El rol «${nombre}» ya existe con nivel ${existente.nivel_acceso}. ` +
        `Se usa «${ROL_PERSONAL_CAMPO}» para este personal.`,
    );
    return fallbackId;
  }
  const creado = await prisma.rol.create({
    data: {
      constructora_id: CONSTRUCTORA_ID,
      nombre,
      nivel_acceso: "PERSONAL_CAMPO",
      es_default: false,
    },
  });
  console.log(`  + rol «${nombre}» (PERSONAL_CAMPO)`);
  return creado.id;
}

async function sembrarPersonalCampo(
  prisma: PrismaClient,
  supabaseAdmin: SupabaseClient,
  proyectoId: string,
  adminId: string,
  rolPorCargo: Map<string, string>,
) {
  for (const persona of PERSONAL_CAMPO) {
    const rolId = rolPorCargo.get(persona.cargo);
    if (!rolId) throw new Error(`sin rol para el cargo «${persona.cargo}»`);

    const estado = await asegurarAuthUser(supabaseAdmin, persona.email, persona.nombre);

    // `usuarios.email` es UNIQUE GLOBAL: si el email existe en otra
    // constructora, un upsert se lo robaría a su tenant. Se aborta.
    const existente = await prisma.usuario.findUnique({ where: { email: persona.email } });
    if (existente && existente.constructora_id !== CONSTRUCTORA_ID) {
      throw new Error(
        `El email ${persona.email} ya pertenece a otra constructora (${existente.constructora_id})`,
      );
    }

    const usuario = existente
      ? await prisma.usuario.update({
          where: { id: existente.id },
          data: { nombre: persona.nombre, telefono: persona.telefono, rol_id: rolId },
        })
      : await prisma.usuario.create({
          data: {
            email: persona.email,
            nombre: persona.nombre,
            telefono: persona.telefono,
            constructora_id: CONSTRUCTORA_ID,
            rol_id: rolId,
          },
        });

    // Los CUATRO permisos en false: el personal de campo comparte tabla con el
    // admin de proyecto pero no hereda nada suyo, y `can_approve_tasks` viene
    // con @default(true) en el esquema. Solo se fijan al CREAR: si un humano
    // los tocó después, este script no le deshace el cambio a su espalda.
    const acceso = await prisma.adminProyectoAccess.findUnique({
      where: { usuario_id_proyecto_id: { usuario_id: usuario.id, proyecto_id: proyectoId } },
    });
    if (!acceso) {
      await prisma.adminProyectoAccess.create({
        data: {
          usuario_id: usuario.id,
          proyecto_id: proyectoId,
          asignado_por: adminId,
          can_edit_project: false,
          can_assign_contractors: false,
          can_manage_team: false,
          can_approve_tasks: false,
        },
      });
    } else if (
      acceso.can_edit_project ||
      acceso.can_assign_contractors ||
      acceso.can_manage_team ||
      acceso.can_approve_tasks
    ) {
      console.warn(
        `⚠️  ${persona.email} ya tenía permisos sobre la obra. Se dejan como están.`,
      );
    }

    console.log(`  · ${persona.nombre} — ${persona.cargo} (auth ${estado})`);
  }
}

interface MaestroSembrado {
  id: string;
  token: string;
  semilla: MaestroSemilla;
  contratistaId: string;
}

async function sembrarMaestros(
  prisma: PrismaClient,
  contratistas: Map<string, string>,
  fechaInicio: Date,
  fechaExpiracion: Date,
): Promise<MaestroSembrado[]> {
  const sembrados: MaestroSembrado[] = [];

  for (const semilla of MAESTROS) {
    const contratistaId = contratistas.get(semilla.contratista);
    if (!contratistaId) {
      throw new Error(
        `«${semilla.contratista}» no tiene tareas en ${PROYECTO_NOMBRE}. ` +
          `Disponibles: ${[...contratistas.keys()].join(", ")}`,
      );
    }

    const existente = await prisma.obrero.findFirst({
      where: { constructora_id: CONSTRUCTORA_ID, cedula: semilla.cedula },
    });

    if (existente) {
      // El token NO se regenera nunca: es la credencial de /o/[token] y
      // rotarlo dejaría muerto un enlace ya repartido por WhatsApp. Lo único
      // que se refresca es la caducidad, y solo si ya pasó: un maestro con el
      // enlace vencido enseña «Token inválido o expirado» en pleno demo.
      const datos =
        existente.fecha_expiracion <= new Date() ? { fecha_expiracion: fechaExpiracion } : {};
      if (Object.keys(datos).length > 0) {
        await prisma.obrero.update({ where: { id: existente.id }, data: datos });
        console.log(`  ↻ ${semilla.nombre} — caducidad extendida`);
      } else {
        console.log(`  = ${semilla.nombre} — ya existía`);
      }
      // Gana el contratista que YA tiene la fila, no el de la constante: si
      // alguien reasignó al maestro, el reparto tiene que seguirle a él o
      // acabaría dándole evidencias de tareas que su enlace no puede reportar.
      sembrados.push({
        id: existente.id,
        token: existente.token,
        semilla,
        contratistaId: existente.contratista_id,
      });
      continue;
    }

    const creado = await prisma.obrero.create({
      data: {
        nombre: semilla.nombre,
        // Sin default en el esquema y a propósito: 192 bits de randomBytes,
        // nunca un cuid ni un token fijo copiado de otro seed.
        token: generarTokenAcceso(),
        contratista_id: contratistaId,
        constructora_id: CONSTRUCTORA_ID,
        fecha_inicio: fechaInicio,
        fecha_expiracion: fechaExpiracion,
        cedula: semilla.cedula,
        telefono: semilla.telefono,
        especialidad: semilla.especialidad,
        eps: semilla.eps,
        arl: semilla.arl,
        activo: true,
      },
    });
    console.log(`  + ${semilla.nombre} — ${semilla.especialidad} (${semilla.contratista})`);
    sembrados.push({ id: creado.id, token: creado.token, semilla, contratistaId });
  }

  return sembrados;
}

/**
 * Devuelve las tareas de una fase de la obra, de un contratista y un estado,
 * ordenadas por id. El orden por id es lo que hace determinista el reparto:
 * dos corridas eligen exactamente las mismas tareas.
 */
async function tareasDeFase(
  prisma: PrismaClient,
  proyectoId: string,
  contratistaId: string,
  fase: string,
  estado: "APROBADA" | "NO_APROBADA",
  cupo: number,
) {
  if (cupo <= 0) return [];
  return prisma.tarea.findMany({
    where: {
      estado,
      asignado_a: contratistaId,
      fase: { nombre: fase, proyecto_id: proyectoId },
      espacio: { unidad: { piso: { edificio: { proyecto_id: proyectoId } } } },
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take: cupo,
  });
}

async function repartirEvidencias(
  prisma: PrismaClient,
  pool: Pool,
  proyectoId: string,
  maestros: MaestroSembrado[],
) {
  // Limpieza previa. Devuelve al estado original las evidencias que una
  // corrida anterior le atribuyó a ESTOS maestros, para que cambiar un cupo
  // en las constantes no deje colgando filas del reparto viejo.
  // `tomada_por = t.asignado_a` no es un invento: es como las escribió
  // `seed-demo-rosas.ts` (línea 424) y como están hoy las 3.348 de la obra.
  const ids = maestros.map((m) => m.id);
  const { rowCount } = await pool.query(
    `update evidencias ev set obrero_id = null, tomada_por = t.asignado_a
       from tareas t
      where t.id = ev.tarea_id and ev.obrero_id = any($1::text[])`,
    [ids],
  );
  if (rowCount) console.log(`  ↺ ${rowCount} evidencias devueltas a su contratista`);

  for (const maestro of maestros) {
    const { semilla } = maestro;
    const aprobadas = await tareasDeFase(
      prisma, proyectoId, maestro.contratistaId, semilla.fase, "APROBADA", semilla.cupoAprobadas,
    );
    const rechazadas = await tareasDeFase(
      prisma, proyectoId, maestro.contratistaId, semilla.fase, "NO_APROBADA", semilla.cupoRechazadas,
    );
    const tareaIds = [...aprobadas, ...rechazadas].map((t) => t.id);
    if (tareaIds.length === 0) {
      console.warn(`⚠️  ${semilla.nombre}: no hay tareas de «${semilla.fase}» para su contratista`);
      continue;
    }

    const { count } = await prisma.evidencia.updateMany({
      where: { tarea_id: { in: tareaIds } },
      // `tomada_por` a null: es la forma EXACTA de una evidencia subida desde
      // /o/[token]. Ver la nota larga de la cabecera.
      data: { obrero_id: maestro.id, tomada_por: null },
    });
    console.log(
      `  · ${semilla.nombre}: ${count} evidencias de ${aprobadas.length} tareas aprobadas ` +
        `y ${rechazadas.length} rechazadas`,
    );
  }
}

/**
 * Repite lo que hace `recalcularScoreObrerosDeTarea` al aprobar por API, que
 * es el único sitio donde se calcula. Misma consulta, mismas funciones: si el
 * cálculo de la app cambia, esto cambia con él y el demo no se desalinea.
 */
async function recalcularScores(prisma: PrismaClient, maestros: MaestroSembrado[]) {
  const resumen: Array<{ maestro: string; tareas: number; score: number }> = [];

  for (const maestro of maestros) {
    const tareas = await prisma.tarea.findMany({
      where: { evidencias: { some: { obrero_id: maestro.id } } },
      select: {
        estado: true,
        fecha_fin_real: true,
        tiempo_acordado_dias: true,
        fecha_inicio: true,
        espacio: {
          select: {
            unidad: {
              select: {
                piso: {
                  select: {
                    edificio: { select: { proyecto: { select: { dias_habiles_semana: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const aprobadas = tareas.filter((t) => t.estado === "APROBADA").length;
    const rechazadas = tareas.filter((t) => t.estado === "NO_APROBADA").length;
    const completadas = aprobadas + rechazadas;

    // «A tiempo» en días HÁBILES del proyecto, no de calendario: es la unidad
    // con la que la app mide al contratista.
    const aTiempo = tareas.filter((t) => {
      if (t.estado !== "APROBADA" || !t.fecha_fin_real || !t.fecha_inicio) return false;
      const diasSemana = t.espacio.unidad.piso.edificio.proyecto.dias_habiles_semana;
      return diasHabilesEntre(t.fecha_inicio, t.fecha_fin_real, diasSemana) <= t.tiempo_acordado_dias;
    }).length;

    const scores = calcularScoringObrero({
      evidencias_aprobadas: aprobadas,
      evidencias_rechazadas: rechazadas,
      tareas_completadas: completadas,
      tareas_a_tiempo: aTiempo,
      tareas_totales: tareas.length,
    });

    await prisma.obrero.update({
      where: { id: maestro.id },
      data: {
        evidencias_aprobadas: aprobadas,
        evidencias_rechazadas: rechazadas,
        tareas_completadas: completadas,
        ...scores,
      },
    });

    resumen.push({ maestro: maestro.semilla.nombre, tareas: tareas.length, score: scores.score_total });
    console.log(
      `  · ${maestro.semilla.nombre}: total ${scores.score_total} ` +
        `(calidad ${scores.score_calidad}, cumplimiento ${scores.score_cumplimiento}, ` +
        `velocidad ${scores.score_velocidad})`,
    );
  }

  return resumen;
}

// ─── Orquestación ───────────────────────────────────────────────────────────

async function main() {
  const { pool, prisma, supabaseAdmin } = conectar();

  try {
    const constructora = await prisma.constructora.findUnique({ where: { id: CONSTRUCTORA_ID } });
    if (!constructora) throw new Error(`no existe la constructora ${CONSTRUCTORA_ID}`);

    const proyecto = await prisma.proyecto.findFirst({
      where: { constructora_id: CONSTRUCTORA_ID, nombre: PROYECTO_NOMBRE },
      select: { id: true, nombre: true, fecha_inicio: true, fecha_fin_estimada: true },
    });
    if (!proyecto) throw new Error(`no existe «${PROYECTO_NOMBRE}» en ${constructora.nombre}`);

    const admin = await prisma.usuario.findUnique({ where: { email: EMAIL_ADMIN } });
    if (!admin) throw new Error(`no existe el admin ${EMAIL_ADMIN}`);

    console.log(`🏗️  ${constructora.nombre} · ${proyecto.nombre}\n`);

    // Ventana del enlace del maestro: vive lo que vive la obra. Si alguna
    // fecha del proyecto no sirve —sin fecha, o ya pasada— se cae a una
    // ventana de un año desde hoy, porque `validateObreroToken` invalida el
    // enlace fuera del rango y el demo enseñaría «Token inválido o expirado».
    const ahora = new Date();
    const fechaInicio =
      proyecto.fecha_inicio && proyecto.fecha_inicio < ahora ? proyecto.fecha_inicio : ahora;
    const fechaExpiracion =
      proyecto.fecha_fin_estimada && proyecto.fecha_fin_estimada > ahora
        ? proyecto.fecha_fin_estimada
        : new Date(ahora.getTime() + UN_ANIO_MS);

    // ── 1. Roles ──────────────────────────────────────────────────────────
    console.log("Roles");
    const rolGenerico = await prisma.rol.findFirst({
      where: { constructora_id: CONSTRUCTORA_ID, nivel_acceso: "PERSONAL_CAMPO" },
    });
    if (!rolGenerico) {
      throw new Error(
        `${constructora.nombre} no tiene rol de nivel PERSONAL_CAMPO. ` +
          `Corre antes: npx tsx scripts/backfill-rol-personal-campo.ts`,
      );
    }
    const rolPorCargo = new Map<string, string>([
      [ROL_RESIDENTE, await asegurarRol(prisma, ROL_RESIDENTE, rolGenerico.id)],
      [ROL_AUXILIAR, await asegurarRol(prisma, ROL_AUXILIAR, rolGenerico.id)],
      [ROL_PERSONAL_CAMPO, rolGenerico.id],
    ]);

    // ── 2. Personal de campo ──────────────────────────────────────────────
    console.log("\nPersonal de campo (usuarios con login propio)");
    await sembrarPersonalCampo(prisma, supabaseAdmin, proyecto.id, admin.id, rolPorCargo);

    // ── 3. Maestros ───────────────────────────────────────────────────────
    // Los contratistas se resuelven por lo que HACEN, no por una lista fija:
    // solo valen los que ya tienen tareas en esta obra, porque el POST de
    // /api/o/[token]/evidencias exige `tarea.asignado_a === obrero.contratista_id`.
    const conTareas = await prisma.usuario.findMany({
      where: {
        constructora_id: CONSTRUCTORA_ID,
        rol_ref: { nivel_acceso: "CONTRATISTA" },
        tareas_asignadas: {
          some: { espacio: { unidad: { piso: { edificio: { proyecto_id: proyecto.id } } } } },
        },
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
    const contratistas = new Map(conTareas.map((c) => [c.nombre, c.id]));

    console.log("\nMaestros (acceso por enlace, sin login)");
    const maestros = await sembrarMaestros(prisma, contratistas, fechaInicio, fechaExpiracion);

    // ── 4. Evidencias y scoring ───────────────────────────────────────────
    console.log("\nReparto de evidencias");
    await repartirEvidencias(prisma, pool, proyecto.id, maestros);

    console.log("\nScoring");
    await recalcularScores(prisma, maestros);

    // ── 5. Qué enseñar ────────────────────────────────────────────────────
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    console.log("\n✅ Listo.\n");
    console.log("── Personal de campo (entra en /campo) ─────────────────────");
    console.log(`  URL:      ${siteUrl}/login`);
    console.log(`  Password: ${PASSWORD}  (todas)`);
    for (const p of PERSONAL_CAMPO) console.log(`  ${p.cargo.padEnd(23)} ${p.email}`);
    console.log("\n  La primera vez cae en /aceptar-politica: el consentimiento");
    console.log("  de la Ley 1581 lo da la persona, no lo siembra un script.");
    console.log("\n── Maestros (enlace sin login) ─────────────────────────────");
    for (const m of maestros) console.log(`  ${m.semilla.nombre.padEnd(28)} ${siteUrl}/o/${m.token}`);
    console.log("\n  Su ranking con scoring: /super-admin/obreros");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
