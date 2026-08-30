/**
 * Seed "listo para cámara" — constructora demo aislada para grabar los videos
 * del landing B2B v2 (docs/specs/spec-landing-b2b-v2.md, sección "Datos demo").
 *
 * Crea (idempotente, NO toca constructoras existentes):
 *   - Constructora "Constructora Horizonte Demo" + admin demo.camara@obracontrol.local
 *     (password fuerte generada en cada corrida — se imprime al final)
 *   - Proyecto estrella "Torres del Río" (Cali): 2 torres × 8 pisos × 4 aptos,
 *     3 espacios/apto, 8 tareas/apto en 4 fases, estados variados (Torre 1 ~70%
 *     aprobadas, Torre 2 ~45%, ~18 reportadas, 4 no aprobadas) con fechas que
 *     producen semáforos verde/amarillo/rojo (ver src/lib/scoring.ts).
 *   - Evidencias FOTO reales (Unsplash/Pexels, sin rostros) subidas al bucket
 *     privado "evidencias" con el path que espera la app (tareaId/uploaderId/f.jpg).
 *   - 3 contratistas + 2 obreros con token, gastos aprobados/registrados y
 *     3 anticipos (~$42M sin sustentar → alarma en rojo).
 *   - 2 obras más con ubicación para el mapa multi-obra: "Conjunto El Roble"
 *     (Bogotá, ~47%) y "Casa Pance" (Cali, ~83%).
 *
 * Uso:  npm run db:seed-camara   (o: npx tsx scripts/seed-demo-camara.ts)
 */
import { PrismaClient } from "../src/generated/prisma";
import type { Prisma } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { esHabil as esHabilCanonico } from "../src/lib/calendario-colombia";

config({ path: ".env.local" });
config({ path: ".env" });

// ─── Constantes del tenant demo ───────────────────────────────────────────────

const TENANT_NOMBRE = "Constructora Horizonte Demo";
const ADMIN_EMAIL = "demo.camara@obracontrol.local";
const ADMIN_NOMBRE = "Mariana Herrera";
// Espejo de POLITICA_VERSION en src/lib/consent.ts — el layout del dashboard
// redirige a /aceptar-politica si el usuario no tiene esta versión aceptada.
const POLITICA_VERSION = "2026-06-1";
const DOCUMENTO_CONSENTIMIENTO = "privacidad+terminos";

const DIAS_HABILES_SEMANA = 6; // obra colombiana típica: lunes a sábado

const CONTRATISTAS = [
  { email: "acabados.valle@obracontrol.local", nombre: "Acabados del Valle — Carlos Rentería" },
  { email: "electricos.jm@obracontrol.local", nombre: "Eléctricos JM — Julián Mosquera" },
  { email: "maderas.pacifico@obracontrol.local", nombre: "Maderas del Pacífico — Ana Lucía Caicedo" },
] as const;

const OBREROS = [
  {
    token: "demo-camara-obrero-01",
    nombre: "Jhon Édinson Palacios",
    cedula: "1144098231",
    especialidad: "ENCHAPADOR" as const,
    contratistaEmail: CONTRATISTAS[0].email,
  },
  {
    token: "demo-camara-obrero-02",
    nombre: "Miguel Ángel Cifuentes",
    cedula: "1113645012",
    especialidad: "ELECTRICISTA" as const,
    contratistaEmail: CONTRATISTAS[1].email,
  },
];

// Fotos libres (Unsplash License / Pexels License), curadas: obra, materiales,
// manos o trabajadores lejanos/de espaldas. SIN primeros planos de rostros.
const FOTOS = [
  { key: "estructura-acero", url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=75&fm=jpg&fit=max" },
  { key: "pintura-rodillo", url: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=1200&q=75&fm=jpg&fit=max" },
  { key: "bano-enchapado", url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&q=75&fm=jpg&fit=max" },
  { key: "fundida-concreto", url: "https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { key: "pintura-interior", url: "https://images.pexels.com/photos/7218525/pexels-photo-7218525.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { key: "corte-madera", url: "https://images.pexels.com/photos/159306/construction-site-build-construction-work-159306.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { key: "estuco-airless", url: "https://images.pexels.com/photos/6474205/pexels-photo-6474205.jpeg?auto=compress&cs=tinysrgb&w=1200" },
] as const;

const NOTAS_REPORTE = [
  "Trabajo terminado, quedó pendiente el remate del guardaescoba.",
  "Listo para revisión. Se usó el material entregado en bodega.",
  "Terminado hoy en la mañana, fotos adjuntas.",
  "Quedó instalado y nivelado, favor revisar boquilla.",
  "Terminada la segunda mano, lista para entrega.",
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

function genPassword(): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const sym = "!#$%&*+-";
  const all = upper + lower + digits + sym;
  const bytes = randomBytes(20);
  let pass =
    upper[bytes[0] % upper.length] +
    lower[bytes[1] % lower.length] +
    digits[bytes[2] % digits.length] +
    sym[bytes[3] % sym.length];
  for (let i = 4; i < 20; i++) pass += all[bytes[i] % all.length];
  return pass;
}

/**
 * Día hábil, con la MISMA definición que el resto del repo.
 *
 * Antes esto era una réplica local («no importamos de src/ porque ese módulo
 * arrastra el cliente Prisma»). El motivo dejó de ser cierto:
 * `calendario-colombia.ts` no tiene ninguna dependencia —ni Prisma, ni red, ni
 * reloj— así que se importa directo. La réplica descontaba domingos pero NO los
 * 18 festivos colombianos, y sembraba datos de demo con fechas que la app
 * después interpretaba con otra regla.
 *
 * Se pregunta por la fecha normalizada a medianoche UTC porque el canónico mira
 * `getUTCDay()` y este script camina el calendario en hora local.
 */
function esHabil(d: Date, diasSemana: number): boolean {
  const enUTC = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return esHabilCanonico(enUTC, diasSemana);
}

function addBusinessDays(from: Date, n: number, diasSemana = DIAS_HABILES_SEMANA): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (esHabil(d, diasSemana)) added++;
  }
  return d;
}

function subBusinessDays(from: Date, n: number, diasSemana = DIAS_HABILES_SEMANA): Date {
  const d = new Date(from);
  let subbed = 0;
  while (subbed < n) {
    d.setDate(d.getDate() - 1);
    if (esHabil(d, diasSemana)) subbed++;
  }
  return d;
}

// fecha_inicio para que una tarea EN CURSO salga con el semáforo pedido
// (calcularSemaforo: retraso ≤ 0 verde · ≤ 0.15 amarillo · ≤ 0.30 rojo).
function inicioParaSemaforo(acordado: number, target: "verde" | "amarillo" | "rojo", ahora: Date): Date {
  if (target === "amarillo") {
    const extra = Math.max(1, Math.round(acordado * 0.12));
    if (extra / acordado <= 0.15) return subBusinessDays(ahora, acordado + extra);
  }
  if (target === "rojo") {
    const extra = Math.max(1, Math.round(acordado * 0.2));
    if (extra / acordado <= 0.3) return subBusinessDays(ahora, acordado + extra);
  }
  return subBusinessDays(ahora, Math.max(1, acordado - 1)); // verde
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function diasAtras(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

// ─── Especificación de tareas por espacio ────────────────────────────────────

type TareaSpec = { nombre: string; fase: string; dias: number; precio: number };
type EspacioSpec = { nombre: string; metraje: number; tareas: TareaSpec[] };

const ESPACIOS_TORRES: EspacioSpec[] = [
  {
    nombre: "Cocina",
    metraje: 12,
    tareas: [
      { nombre: "Pañete y afinado de muros", fase: "Obra gris", dias: 4, precio: 690_000 },
      { nombre: "Enchape pared cocina", fase: "Obra Blanca", dias: 4, precio: 920_000 },
      { nombre: "Instalación mesón y mueble bajo", fase: "Madera", dias: 3, precio: 1_350_000 },
    ],
  },
  {
    nombre: "Baño principal",
    metraje: 6,
    tareas: [
      { nombre: "Instalación red hidrosanitaria", fase: "Instalaciones", dias: 3, precio: 610_000 },
      { nombre: "Enchape baño principal", fase: "Obra Blanca", dias: 5, precio: 980_000 },
      { nombre: "Instalación aparatos sanitarios", fase: "Instalaciones", dias: 2, precio: 520_000 },
    ],
  },
  {
    nombre: "Alcoba 1",
    metraje: 14,
    tareas: [
      { nombre: "Estuco y pintura", fase: "Obra Blanca", dias: 4, precio: 780_000 },
      { nombre: "Instalación puerta", fase: "Madera", dias: 2, precio: 420_000 },
    ],
  },
];

const ESPACIOS_ROBLE: EspacioSpec[] = [
  {
    nombre: "Cocina",
    metraje: 10,
    tareas: [
      { nombre: "Enchape pared cocina", fase: "Obra Blanca", dias: 4, precio: 890_000 },
      { nombre: "Instalación mesón", fase: "Madera", dias: 2, precio: 760_000 },
    ],
  },
  {
    nombre: "Baño principal",
    metraje: 5,
    tareas: [
      { nombre: "Enchape baño", fase: "Obra Blanca", dias: 4, precio: 940_000 },
      { nombre: "Instalación aparatos sanitarios", fase: "Instalaciones", dias: 2, precio: 510_000 },
    ],
  },
];

const ESPACIOS_PANCE: EspacioSpec[] = [
  {
    nombre: "Cocina",
    metraje: 14,
    tareas: [
      { nombre: "Enchape pared cocina", fase: "Obra Blanca", dias: 4, precio: 1_050_000 },
      { nombre: "Instalación mueble de cocina", fase: "Madera", dias: 3, precio: 1_600_000 },
    ],
  },
  {
    nombre: "Baño principal",
    metraje: 7,
    tareas: [
      { nombre: "Enchape baño principal", fase: "Obra Blanca", dias: 5, precio: 1_100_000 },
      { nombre: "Instalación aparatos sanitarios", fase: "Instalaciones", dias: 2, precio: 540_000 },
    ],
  },
  {
    nombre: "Alcoba 1",
    metraje: 16,
    tareas: [
      { nombre: "Estuco y pintura", fase: "Obra Blanca", dias: 4, precio: 860_000 },
      { nombre: "Instalación puerta", fase: "Madera", dias: 2, precio: 450_000 },
    ],
  },
];

// Contratista responsable según la fase
const FASE_A_CONTRATISTA: Record<string, (typeof CONTRATISTAS)[number]["email"]> = {
  "Obra gris": CONTRATISTAS[0].email,
  "Obra Blanca": CONTRATISTAS[0].email,
  Instalaciones: CONTRATISTAS[1].email,
  Madera: CONTRATISTAS[2].email,
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!databaseUrl) throw new Error("Falta DATABASE_URL/DIRECT_URL en .env.local");
  if (!supabaseUrl) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
  if (!serviceRoleKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");

  // pg moderno trata sslmode=require del URL como verify-full y falla con la
  // cadena de certificados de Supabase — lo quitamos y mandamos ssl por opción.
  const connUrl = new URL(databaseUrl);
  connUrl.searchParams.delete("sslmode");
  const pool = new Pool({ connectionString: connUrl.toString(), ssl: { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ahora = new Date();
  const password = genPassword();
  const fotosSubidas: string[] = [];

  try {
    console.log("🎬 Seed demo para cámara — Constructora Horizonte Demo\n");

    // ── 1. Tenant nuevo y aislado ────────────────────────────────────────────
    let constructora = await prisma.constructora.findFirst({ where: { nombre: TENANT_NOMBRE } });
    if (!constructora) {
      constructora = await prisma.constructora.create({
        data: {
          nombre: TENANT_NOMBRE,
          ciudad: "Cali",
          telefono: "6023456789",
          plan_suscripcion: "EMPRESA",
          tipo_cuenta: "CONSTRUCTORA",
          descripcion: "Constructora demo para grabaciones del producto",
        },
      });
      console.log("✓ Constructora creada:", constructora.nombre);
    } else {
      console.log("✓ Constructora existente:", constructora.nombre);
    }

    // Roles del tenant
    const rolesNeed = [
      { nombre: "Administrador", nivel: "ADMIN_GENERAL" as const },
      { nombre: "Contratista", nivel: "CONTRATISTA" as const },
    ];
    const roles: Record<string, string> = {};
    for (const r of rolesNeed) {
      const rol = await prisma.rol.upsert({
        where: { constructora_id_nombre: { constructora_id: constructora.id, nombre: r.nombre } },
        update: {},
        create: {
          constructora_id: constructora.id,
          nombre: r.nombre,
          nivel_acceso: r.nivel,
          es_default: true,
        },
      });
      roles[r.nivel] = rol.id;
    }
    console.log("✓ Roles listos (Administrador, Contratista)");

    // ── 2. Usuario admin con login real en Supabase ─────────────────────────
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw new Error(`listUsers: ${listErr.message}`);
    const authExistente = list?.users.find((u) => u.email === ADMIN_EMAIL);
    if (!authExistente) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      console.log("✓ Auth user creado en Supabase:", ADMIN_EMAIL);
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(authExistente.id, { password });
      if (error) throw new Error(`updateUser: ${error.message}`);
      console.log("✓ Auth user existente — password rotado");
    }

    const admin = await prisma.usuario.upsert({
      where: { email: ADMIN_EMAIL },
      update: { constructora_id: constructora.id, rol_id: roles.ADMIN_GENERAL, nombre: ADMIN_NOMBRE },
      create: {
        email: ADMIN_EMAIL,
        nombre: ADMIN_NOMBRE,
        constructora_id: constructora.id,
        rol_id: roles.ADMIN_GENERAL,
        invitado: false,
      },
    });

    // Consentimiento vigente — sin esto el dashboard redirige a /aceptar-politica
    const consent = await prisma.consentimientoDatos.findFirst({
      where: { usuario_id: admin.id, version: POLITICA_VERSION },
    });
    if (!consent) {
      await prisma.consentimientoDatos.create({
        data: {
          usuario_id: admin.id,
          version: POLITICA_VERSION,
          documento: DOCUMENTO_CONSENTIMIENTO,
        },
      });
    }
    console.log("✓ Usuario admin + consentimiento listos");

    // ── 3. Contratistas y obreros ────────────────────────────────────────────
    const contratistaId: Record<string, string> = {};
    const scores = [
      { cumplimiento: 92, calidad: 88, velocidad: 90, total: 90 },
      { cumplimiento: 85, calidad: 91, velocidad: 78, total: 85 },
      { cumplimiento: 78, calidad: 82, velocidad: 74, total: 78 },
    ];
    for (let i = 0; i < CONTRATISTAS.length; i++) {
      const c = CONTRATISTAS[i];
      const u = await prisma.usuario.upsert({
        where: { email: c.email },
        update: { constructora_id: constructora.id, rol_id: roles.CONTRATISTA, nombre: c.nombre },
        create: {
          email: c.email,
          nombre: c.nombre,
          constructora_id: constructora.id,
          rol_id: roles.CONTRATISTA,
          invitado: true,
        },
      });
      contratistaId[c.email] = u.id;
      await prisma.contratista.upsert({
        where: { usuario_id: u.id },
        update: {
          score_cumplimiento: scores[i].cumplimiento,
          score_calidad: scores[i].calidad,
          score_velocidad_correccion: scores[i].velocidad,
          score_total: scores[i].total,
        },
        create: {
          usuario_id: u.id,
          score_cumplimiento: scores[i].cumplimiento,
          score_calidad: scores[i].calidad,
          score_velocidad_correccion: scores[i].velocidad,
          score_total: scores[i].total,
        },
      });
    }
    console.log(`✓ ${CONTRATISTAS.length} contratistas listos`);

    const obreroIds: { id: string; contratistaEmail: string }[] = [];
    for (const o of OBREROS) {
      const obrero = await prisma.obrero.upsert({
        where: { token: o.token },
        update: {
          activo: true,
          constructora_id: constructora.id,
          contratista_id: contratistaId[o.contratistaEmail],
          fecha_expiracion: diasAtras(-365),
        },
        create: {
          nombre: o.nombre,
          token: o.token,
          cedula: o.cedula,
          telefono: "3007654321",
          especialidad: o.especialidad,
          eps: "SURA",
          arl: "POSITIVA",
          anos_experiencia: 7,
          contratista_id: contratistaId[o.contratistaEmail],
          constructora_id: constructora.id,
          fecha_inicio: diasAtras(90),
          fecha_expiracion: diasAtras(-365),
          activo: true,
          score_total: 86,
          score_calidad: 88,
          score_velocidad: 84,
          score_cumplimiento: 86,
          evidencias_aprobadas: 34,
          tareas_completadas: 21,
        },
      });
      obreroIds.push({ id: obrero.id, contratistaEmail: o.contratistaEmail });
    }
    console.log(`✓ ${OBREROS.length} obreros con token listos`);

    // ── 4. Proyectos ─────────────────────────────────────────────────────────

    type EdificioPlan = {
      nombre: string;
      pisos: number;
      unidadesPorPiso: number;
      fracAprobadas: number;
      reportadas: number;
      noAprobadas: number;
    };

    async function ensureProyecto(opts: {
      nombre: string;
      numeroRegistro: string;
      ciudad: string;
      lat: number;
      lng: number;
      subtipo: "APARTAMENTOS" | "CASAS";
      presupuesto: number;
      inicioDiasAtras: number;
      finEnDias: number;
      fases: { nombre: string; orden: number; dias: number }[];
      espacios: EspacioSpec[];
      edificios: EdificioPlan[];
      spreadAprobadasBD: number; // sobre cuántos días hábiles se reparten las aprobadas
    }) {
      let proyecto = await prisma.proyecto.findFirst({
        where: { constructora_id: constructora!.id, nombre: opts.nombre },
      });
      if (!proyecto) {
        proyecto = await prisma.proyecto.create({
          data: {
            constructora_id: constructora!.id,
            nombre: opts.nombre,
            numero_registro: opts.numeroRegistro,
            subtipo: opts.subtipo,
            ciudad: opts.ciudad,
            ubicacion_lat: opts.lat,
            ubicacion_lng: opts.lng,
            presupuesto_total: opts.presupuesto,
            dias_habiles_semana: DIAS_HABILES_SEMANA,
            fecha_inicio: diasAtras(opts.inicioDiasAtras),
            fecha_fin_estimada: diasAtras(-opts.finEnDias),
            estado: "ACTIVO",
            contratista_default_id: contratistaId[CONTRATISTAS[0].email],
          },
        });
        console.log(`✓ Proyecto creado: ${opts.nombre}`);
      } else {
        console.log(`✓ Proyecto existente: ${opts.nombre}`);
      }

      const faseId: Record<string, string> = {};
      for (const f of opts.fases) {
        let fase = await prisma.fase.findFirst({
          where: { proyecto_id: proyecto.id, nombre: f.nombre },
        });
        if (!fase) {
          fase = await prisma.fase.create({
            data: {
              proyecto_id: proyecto.id,
              nombre: f.nombre,
              orden: f.orden,
              tiempo_estimado_dias: f.dias,
            },
          });
        }
        faseId[f.nombre] = fase.id;
      }

      let tipoUnidad = await prisma.tipoUnidad.findFirst({
        where: { proyecto_id: proyecto.id, nombre: "Tipo A" },
      });
      if (!tipoUnidad) {
        tipoUnidad = await prisma.tipoUnidad.create({
          data: { proyecto_id: proyecto.id, nombre: "Tipo A" },
        });
      }

      const inicioProyecto = diasAtras(opts.inicioDiasAtras);
      let seq = 0; // secuencia global de numero_registro dentro del proyecto
      const tareasPorUnidad = opts.espacios.reduce((s, e) => s + e.tareas.length, 0);

      for (const ed of opts.edificios) {
        const existente = await prisma.edificio.findFirst({
          where: { proyecto_id: proyecto.id, nombre: ed.nombre },
        });
        if (existente) {
          seq += ed.pisos * ed.unidadesPorPiso * tareasPorUnidad;
          console.log(`  ✓ ${ed.nombre} ya existe — no se duplica`);
          continue;
        }

        const edificio = await prisma.edificio.create({
          data: { proyecto_id: proyecto.id, nombre: ed.nombre, num_pisos: ed.pisos },
        });

        // Distribución de estados dentro del edificio, en orden piso→unidad→tarea:
        // primero las aprobadas (pisos bajos), luego la franja reportada/no aprobada
        // (la "frontera" de la obra) y el resto pendiente.
        const totalTareas = ed.pisos * ed.unidadesPorPiso * tareasPorUnidad;
        const numAprobadas = Math.round(ed.fracAprobadas * totalTareas);
        const semaforosReportada: ("verde" | "amarillo" | "rojo")[] = [
          "verde", "amarillo", "verde", "rojo", "amarillo", "verde", "rojo", "amarillo", "verde", "verde",
        ];

        const tareasData: Prisma.TareaCreateManyInput[] = [];
        let idx = 0;
        let reportadaIdx = 0;

        for (let piso = 1; piso <= ed.pisos; piso++) {
          const pisoRow = await prisma.piso.create({
            data: { edificio_id: edificio.id, numero: piso },
          });
          for (let u = 1; u <= ed.unidadesPorPiso; u++) {
            const nombreUnidad =
              ed.unidadesPorPiso === 1 ? `Piso ${piso}` : `${piso}0${u}`;
            const unidad = await prisma.unidad.create({
              data: {
                piso_id: pisoRow.id,
                nombre: nombreUnidad,
                tipo_unidad_id: tipoUnidad.id,
                metraje_total: 62,
              },
            });
            for (const esp of opts.espacios) {
              const espacio = await prisma.espacio.create({
                data: { unidad_id: unidad.id, nombre: esp.nombre, metraje: esp.metraje },
              });
              for (const t of esp.tareas) {
                seq++;
                idx++;
                const asignadoA = contratistaId[FASE_A_CONTRATISTA[t.fase]];
                const base: Prisma.TareaCreateManyInput = {
                  espacio_id: espacio.id,
                  fase_id: faseId[t.fase],
                  numero_registro: `${opts.numeroRegistro}-T${String(seq).padStart(4, "0")}`,
                  nombre: t.nombre,
                  tiempo_acordado_dias: t.dias,
                  precio: t.precio,
                  asignado_a: asignadoA,
                  estado: "PENDIENTE",
                  fecha_inicio: null,
                  fecha_fin_real: null,
                };

                if (idx <= numAprobadas) {
                  // Aprobada: repartida en el pasado; casi todas a tiempo,
                  // 1 de cada 5 adelantada (verde intenso), 1 de cada 11 con
                  // leve retraso (amarillo/rojo al cierre).
                  const offset = Math.floor(((idx - 1) / Math.max(1, numAprobadas)) * opts.spreadAprobadasBD);
                  const inicio = addBusinessDays(inicioProyecto, offset);
                  let duracion = t.dias;
                  if (idx % 5 === 0) duracion = Math.max(1, t.dias - 1);
                  else if (idx % 11 === 0) duracion = t.dias + 1;
                  let fin = addBusinessDays(inicio, duracion);
                  if (fin > ahora) fin = ahora;
                  base.estado = "APROBADA";
                  base.fecha_inicio = inicio;
                  base.fecha_fin_real = fin;
                } else if (idx <= numAprobadas + ed.reportadas) {
                  const target = semaforosReportada[reportadaIdx % semaforosReportada.length];
                  reportadaIdx++;
                  base.estado = "REPORTADA";
                  base.fecha_inicio = inicioParaSemaforo(t.dias, target, ahora);
                  base.nota_reporte = NOTAS_REPORTE[reportadaIdx % NOTAS_REPORTE.length];
                } else if (idx <= numAprobadas + ed.reportadas + ed.noAprobadas) {
                  base.estado = "NO_APROBADA";
                  base.fecha_inicio = subBusinessDays(ahora, t.dias + 2);
                  base.nota_reporte = "Se reportó pero el acabado no pasó la revisión.";
                }
                tareasData.push(base);
              }
            }
          }
        }

        for (const grupo of chunk(tareasData, 150)) {
          await prisma.tarea.createMany({ data: grupo });
        }
        console.log(
          `  ✓ ${ed.nombre}: ${ed.pisos} pisos · ${ed.pisos * ed.unidadesPorPiso} unidades · ${tareasData.length} tareas`
        );
      }

      return proyecto;
    }

    // 4a. Proyecto estrella — Torres del Río (Cali)
    const torres = await ensureProyecto({
      nombre: "Torres del Río",
      numeroRegistro: "TR-2026-001",
      ciudad: "Cali",
      lat: 3.4372,
      lng: -76.5225,
      subtipo: "APARTAMENTOS",
      presupuesto: 1_820_000_000,
      inicioDiasAtras: 92,
      finEnDias: 183,
      fases: [
        { nombre: "Obra gris", orden: 1, dias: 45 },
        { nombre: "Instalaciones", orden: 2, dias: 40 },
        { nombre: "Obra Blanca", orden: 3, dias: 50 },
        { nombre: "Madera", orden: 4, dias: 30 },
      ],
      espacios: ESPACIOS_TORRES,
      edificios: [
        { nombre: "Torre 1", pisos: 8, unidadesPorPiso: 4, fracAprobadas: 0.7, reportadas: 10, noAprobadas: 2 },
        { nombre: "Torre 2", pisos: 8, unidadesPorPiso: 4, fracAprobadas: 0.45, reportadas: 8, noAprobadas: 2 },
      ],
      spreadAprobadasBD: 65,
    });

    // 4b/4c. Obras para el mapa multi-obra
    await ensureProyecto({
      nombre: "Conjunto El Roble",
      numeroRegistro: "ER-2026-002",
      ciudad: "Bogotá",
      lat: 4.6482,
      lng: -74.0648,
      subtipo: "APARTAMENTOS",
      presupuesto: 380_000_000,
      inicioDiasAtras: 60,
      finEnDias: 150,
      fases: [
        { nombre: "Instalaciones", orden: 1, dias: 30 },
        { nombre: "Obra Blanca", orden: 2, dias: 40 },
        { nombre: "Madera", orden: 3, dias: 20 },
      ],
      espacios: ESPACIOS_ROBLE,
      edificios: [
        { nombre: "Torre A", pisos: 4, unidadesPorPiso: 2, fracAprobadas: 0.47, reportadas: 0, noAprobadas: 0 },
      ],
      spreadAprobadasBD: 40,
    });

    await ensureProyecto({
      nombre: "Casa Pance",
      numeroRegistro: "CP-2026-003",
      ciudad: "Cali",
      lat: 3.3405,
      lng: -76.5603,
      subtipo: "CASAS",
      presupuesto: 95_000_000,
      inicioDiasAtras: 75,
      finEnDias: 30,
      fases: [
        { nombre: "Instalaciones", orden: 1, dias: 25 },
        { nombre: "Obra Blanca", orden: 2, dias: 35 },
        { nombre: "Madera", orden: 3, dias: 15 },
      ],
      espacios: ESPACIOS_PANCE,
      edificios: [
        { nombre: "Casa", pisos: 2, unidadesPorPiso: 1, fracAprobadas: 0.84, reportadas: 0, noAprobadas: 0 },
      ],
      spreadAprobadasBD: 55,
    });

    // ── 5. Aprobaciones (historial de quién aprobó/rechazó) ──────────────────
    const tareasTenant = await prisma.tarea.findMany({
      where: {
        espacio: {
          unidad: { piso: { edificio: { proyecto: { constructora_id: constructora.id } } } },
        },
      },
      select: {
        id: true,
        nombre: true,
        numero_registro: true,
        estado: true,
        fecha_fin_real: true,
        tiempo_acordado_dias: true,
        asignado_a: true,
        espacio: {
          select: {
            unidad: {
              select: { piso: { select: { edificio: { select: { proyecto_id: true } } } } },
            },
          },
        },
      },
    });
    const conAprobacion = new Set(
      (
        await prisma.aprobacion.findMany({
          where: { tarea_id: { in: tareasTenant.map((t) => t.id) } },
          select: { tarea_id: true },
        })
      ).map((a) => a.tarea_id)
    );
    const aprobacionesData: Prisma.AprobacionCreateManyInput[] = tareasTenant
      .filter((t) => !conAprobacion.has(t.id) && (t.estado === "APROBADA" || t.estado === "NO_APROBADA"))
      .map((t) => ({
        tarea_id: t.id,
        aprobador_id: admin.id,
        estado: t.estado === "APROBADA" ? "APROBADA" : "NO_APROBADA",
        fecha: t.fecha_fin_real ?? diasAtras(1),
      }));
    for (const grupo of chunk(aprobacionesData, 200)) {
      await prisma.aprobacion.createMany({ data: grupo });
    }
    console.log(`✓ ${aprobacionesData.length} aprobaciones registradas`);

    // ── 5b. Afinar semáforos de las tareas en curso (corre SIEMPRE) ──────────
    // Con tareas de 2-5 días el "amarillo" (retraso ≤15%) es inalcanzable con
    // días enteros, así que aquí recalibramos fecha_inicio y tiempo_acordado
    // para producir una mezcla planificada de colores en cámara:
    //   REPORTADAS → ciclo verde/amarillo/verde/rojo/verde/amarillo
    //   NO_APROBADAS → rojo, rojo, rojo y 1 vinotinto (retrabajo muy vencido)
    const enCurso = tareasTenant
      .filter((t) => t.estado === "REPORTADA" || t.estado === "NO_APROBADA")
      .sort((a, b) => (a.numero_registro ?? "").localeCompare(b.numero_registro ?? ""));
    const cicloReportada = ["verde", "amarillo", "verde", "rojo", "verde", "amarillo"] as const;
    const planNoAprobada = ["rojo", "vinotinto", "rojo", "rojo"] as const;
    let iRep = 0;
    let iNo = 0;
    for (const t of enCurso) {
      const target =
        t.estado === "REPORTADA"
          ? cicloReportada[iRep++ % cicloReportada.length]
          : planNoAprobada[iNo++ % planNoAprobada.length];
      let dias = t.tiempo_acordado_dias;
      let transcurridos: number;
      if (target === "amarillo") {
        dias = Math.max(dias, 8); // 1 día extra sobre 8 = 12.5% → amarillo
        transcurridos = dias + 1;
      } else if (target === "rojo") {
        dias = Math.max(dias, 5); // 1 día extra sobre 5 = 20% → rojo
        transcurridos = dias + Math.max(1, Math.round(dias * 0.2));
      } else if (target === "vinotinto") {
        transcurridos = dias * 2 + 1; // muy vencida
      } else {
        transcurridos = Math.max(1, dias - 1); // verde: aún dentro del plazo
      }
      await prisma.tarea.update({
        where: { id: t.id },
        data: {
          tiempo_acordado_dias: dias,
          fecha_inicio: subBusinessDays(ahora, transcurridos),
        },
      });
    }
    console.log(`✓ Semáforos calibrados en ${enCurso.length} tareas en curso (verde/amarillo/rojo + 1 vinotinto)`);

    // ── 6. Evidencias con foto real en el bucket "evidencias" ────────────────
    console.log("\n📸 Descargando fotos libres (Unsplash/Pexels)...");
    const fotoBuffers: { key: string; data: Buffer }[] = [];
    for (const f of FOTOS) {
      const res = await fetch(f.url);
      if (!res.ok) {
        console.log(`  ⚠ No se pudo descargar ${f.key} (${res.status}) — se omite`);
        continue;
      }
      fotoBuffers.push({ key: f.key, data: Buffer.from(await res.arrayBuffer()) });
    }
    if (fotoBuffers.length === 0) throw new Error("No se pudo descargar ninguna foto");
    console.log(`  ✓ ${fotoBuffers.length}/${FOTOS.length} fotos descargadas`);

    function fotoParaTarea(nombre: string, i: number): { key: string; data: Buffer } {
      const buscar = (k: string) => fotoBuffers.find((f) => f.key === k);
      const n = nombre.toLowerCase();
      let elegida: { key: string; data: Buffer } | undefined;
      if (n.includes("enchape")) elegida = buscar("bano-enchapado");
      else if (n.includes("estuco") || n.includes("pintura"))
        elegida = [buscar("pintura-rodillo"), buscar("pintura-interior"), buscar("estuco-airless")][i % 3];
      else if (n.includes("puerta") || n.includes("mesón") || n.includes("mueble"))
        elegida = buscar("corte-madera");
      else if (n.includes("pañete") || n.includes("fundida")) elegida = buscar("fundida-concreto");
      return elegida ?? fotoBuffers[i % fotoBuffers.length];
    }

    // Tareas de Torres del Río que llevan evidencia: todas las REPORTADAS y
    // NO_APROBADAS (el flujo de aprobación en cámara las necesita) + las 8
    // APROBADAS más recientes.
    const tareasTorres = tareasTenant.filter(
      (t) => t.espacio.unidad.piso.edificio.proyecto_id === torres.id
    );
    const objetivo = [
      ...tareasTorres.filter((t) => t.estado === "REPORTADA" || t.estado === "NO_APROBADA"),
      ...tareasTorres
        .filter((t) => t.estado === "APROBADA")
        .sort((a, b) => (b.fecha_fin_real?.getTime() ?? 0) - (a.fecha_fin_real?.getTime() ?? 0))
        .slice(0, 8),
    ];
    const conEvidencia = new Set(
      (
        await prisma.evidencia.findMany({
          where: { tarea_id: { in: objetivo.map((t) => t.id) } },
          select: { tarea_id: true },
        })
      ).map((e) => e.tarea_id)
    );

    // Lunes de esta semana a las 8:00 — las horas de captura se reparten
    // entre lunes y hoy, de 8:00 a ~16:00 (verosímil en obra).
    const lunes = new Date(ahora);
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    lunes.setHours(8, 0, 0, 0);
    const diasDesdeLunes = Math.max(1, Math.floor((ahora.getTime() - lunes.getTime()) / 86400000));

    let subidas = 0;
    let filas = 0;
    for (let i = 0; i < objetivo.length; i++) {
      const t = objetivo[i];
      if (conEvidencia.has(t.id)) continue;

      const obrero =
        obreroIds.find((o) => contratistaId[o.contratistaEmail] === t.asignado_a) ?? obreroIds[0];
      const numFotos = t.estado === "REPORTADA" && i % 3 === 0 ? 2 : 1;

      for (let f = 0; f < numFotos; f++) {
        const foto = fotoParaTarea(t.nombre, i + f);
        const path = `${t.id}/${obrero.id}/seed-${foto.key}-${f + 1}.jpg`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("evidencias")
          .upload(path, foto.data, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error(`Storage upload (${path}): ${upErr.message}`);
        subidas++;
        if (fotosSubidas.length < 12) fotosSubidas.push(path);

        // Hora de captura: esta semana para reportadas/no aprobadas; para las
        // aprobadas, unas horas antes de su aprobación (coherencia del detalle).
        let captura: Date;
        if (t.estado === "APROBADA" && t.fecha_fin_real) {
          captura = new Date(t.fecha_fin_real.getTime() - (3 + (i % 4)) * 3600000);
        } else {
          captura = new Date(lunes);
          captura.setDate(captura.getDate() + (i % diasDesdeLunes));
          captura.setHours(8 + ((i * 3 + f * 2) % 8), (i * 17) % 60, 0, 0);
        }

        await prisma.evidencia.create({
          data: {
            tarea_id: t.id,
            tipo: "FOTO",
            url_storage: path,
            gps_lat: 3.4372 + (((i * 37 + f * 11) % 21) - 10) / 20000,
            gps_lng: -76.5225 + (((i * 53 + f * 7) % 21) - 10) / 20000,
            timestamp_captura: captura,
            obrero_id: obrero.id,
          },
        });
        filas++;
      }
    }
    console.log(`✓ ${subidas} fotos subidas al bucket "evidencias" · ${filas} filas Evidencia`);

    // Verificación: la app debe poder firmar estos paths (signed URL)
    if (fotosSubidas.length > 0) {
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("evidencias")
        .createSignedUrl(fotosSubidas[0], 60);
      if (signErr || !signed?.signedUrl) {
        console.log(`  ⚠ No se pudo generar signed URL de prueba: ${signErr?.message}`);
      } else {
        console.log("  ✓ Signed URL de prueba generada OK (el detalle de tarea podrá mostrarlas)");
      }
    }

    // ── 7. Gastos y anticipos (Torres del Río) ───────────────────────────────
    const GASTOS: {
      descripcion: string;
      material: string;
      cantidad: number;
      unidad: string;
      precioUnitario: number;
      estado: "APROBADO" | "REGISTRADO";
      diasAtras: number;
    }[] = [
      { descripcion: "Cemento gris obra", material: "Cemento gris Argos 50kg", cantidad: 420, unidad: "bulto", precioUnitario: 34_500, estado: "APROBADO", diasAtras: 24 },
      { descripcion: "Cerámica piso apartamentos", material: "Cerámica piso 60x60 beige", cantidad: 580, unidad: "m²", precioUnitario: 48_000, estado: "APROBADO", diasAtras: 21 },
      { descripcion: "Pintura interior torres", material: "Pintura blanca tipo 1", cantidad: 95, unidad: "galón", precioUnitario: 92_000, estado: "APROBADO", diasAtras: 18 },
      { descripcion: "Arena para pañete", material: "Arena de río", cantidad: 38, unidad: "m³", precioUnitario: 95_000, estado: "APROBADO", diasAtras: 16 },
      { descripcion: "Estuco para muros", material: "Estuco plástico caneca 25kg", cantidad: 160, unidad: "caneca", precioUnitario: 58_000, estado: "APROBADO", diasAtras: 12 },
      { descripcion: "Grifería y lavamanos baños", material: "Combo grifería + lavamanos", cantidad: 64, unidad: "unidad", precioUnitario: 148_000, estado: "APROBADO", diasAtras: 9 },
      { descripcion: "Cable eléctrico torres", material: "Cable THHN #12 rollo 100m", cantidad: 24, unidad: "rollo", precioUnitario: 210_000, estado: "APROBADO", diasAtras: 6 },
      { descripcion: "Porcelanato baños principales", material: "Porcelanato 30x60 gris", cantidad: 210, unidad: "m²", precioUnitario: 62_000, estado: "APROBADO", diasAtras: 4 },
      { descripcion: "Pegante para enchape", material: "Pegacor blanco 25kg", cantidad: 120, unidad: "bulto", precioUnitario: 38_500, estado: "REGISTRADO", diasAtras: 2 },
      { descripcion: "Alquiler andamio certificado", material: "Andamio multidireccional", cantidad: 1, unidad: "mes", precioUnitario: 2_800_000, estado: "REGISTRADO", diasAtras: 1 },
      { descripcion: "Tubería PVC media pulgada", material: "Tubo PVC 1/2\" x 6m", cantidad: 85, unidad: "unidad", precioUnitario: 12_800, estado: "REGISTRADO", diasAtras: 1 },
    ];

    let gastosCreados = 0;
    for (const g of GASTOS) {
      const existe = await prisma.gasto.findFirst({
        where: { proyecto_id: torres.id, descripcion: g.descripcion },
      });
      if (existe) continue;
      await prisma.gasto.create({
        data: {
          proyecto_id: torres.id,
          descripcion: g.descripcion,
          monto: Math.round(g.cantidad * g.precioUnitario),
          estado: g.estado,
          registrado_por: contratistaId[CONTRATISTAS[0].email],
          aprobado_por: g.estado === "APROBADO" ? admin.id : null,
          fecha: diasAtras(g.diasAtras),
          material: g.material,
          cantidad: g.cantidad,
          unidad: g.unidad,
          precio_unitario: g.precioUnitario,
        },
      });
      gastosCreados++;
    }
    const sumaAprobados = GASTOS.filter((g) => g.estado === "APROBADO").reduce(
      (s, g) => s + Math.round(g.cantidad * g.precioUnitario),
      0
    );

    // Anticipos: 2 sustentados por los gastos aprobados y 1 que deja ~$42M sin
    // sustentar (alarma roja en la vista de gastos: anticipos − gastos aprobados).
    const ANTICIPOS = [
      { monto: 50_000_000, nota: "Anticipo inicial obra blanca — Acabados del Valle", email: CONTRATISTAS[0].email, diasAtras: 80 },
      { monto: sumaAprobados - 50_000_000, nota: "Anticipo instalaciones — Eléctricos JM", email: CONTRATISTAS[1].email, diasAtras: 45 },
      { monto: 42_000_000, nota: "Anticipo compra porcelanato — pendiente legalizar", email: CONTRATISTAS[0].email, diasAtras: 12 },
    ];
    let anticiposCreados = 0;
    for (const a of ANTICIPOS) {
      const existe = await prisma.anticipo.findFirst({
        where: { proyecto_id: torres.id, nota: a.nota },
      });
      if (existe) continue;
      await prisma.anticipo.create({
        data: {
          proyecto_id: torres.id,
          monto: a.monto,
          nota: a.nota,
          entregado_a: contratistaId[a.email],
          registrado_por: admin.id,
          fecha: diasAtras(a.diasAtras),
        },
      });
      anticiposCreados++;
    }
    const sumaAnticipos = ANTICIPOS.reduce((s, a) => s + a.monto, 0);
    console.log(
      `✓ ${gastosCreados} gastos y ${anticiposCreados} anticipos creados · sin sustentar: $${(sumaAnticipos - sumaAprobados).toLocaleString("es-CO")}`
    );

    // ── 8. Resumen ───────────────────────────────────────────────────────────
    const tenantWhereTarea = {
      espacio: { unidad: { piso: { edificio: { proyecto: { constructora_id: constructora.id } } } } },
    };
    const [nProyectos, nEdificios, nUnidades, nTareas, aprob, report, noAprob, nEvid, nGastos, nAnticipos] =
      await Promise.all([
        prisma.proyecto.count({ where: { constructora_id: constructora.id } }),
        prisma.edificio.count({ where: { proyecto: { constructora_id: constructora.id } } }),
        prisma.unidad.count({ where: { piso: { edificio: { proyecto: { constructora_id: constructora.id } } } } }),
        prisma.tarea.count({ where: tenantWhereTarea }),
        prisma.tarea.count({ where: { ...tenantWhereTarea, estado: "APROBADA" } }),
        prisma.tarea.count({ where: { ...tenantWhereTarea, estado: "REPORTADA" } }),
        prisma.tarea.count({ where: { ...tenantWhereTarea, estado: "NO_APROBADA" } }),
        prisma.evidencia.count({ where: { tarea: tenantWhereTarea } }),
        prisma.gasto.count({ where: { proyecto: { constructora_id: constructora.id } } }),
        prisma.anticipo.count({ where: { proyecto: { constructora_id: constructora.id } } }),
      ]);

    console.log("\n──────────────────────────────────────────────────────────");
    console.log("✅ Demo para cámara listo\n");
    console.log(`  Constructora: ${TENANT_NOMBRE}`);
    console.log(`  Login:        ${siteUrl}/login`);
    console.log(`  Email:        ${ADMIN_EMAIL}`);
    console.log(`  Password:     ${password}`);
    console.log("\n  Obreros (acceso sin login):");
    for (const o of OBREROS) console.log(`    ${siteUrl}/o/${o.token}  (${o.nombre})`);
    console.log("\n  Proyectos: Torres del Río (Cali) · Conjunto El Roble (Bogotá) · Casa Pance (Cali)");
    console.log(
      `  Conteos: ${nProyectos} proyectos · ${nEdificios} edificios · ${nUnidades} unidades · ${nTareas} tareas`
    );
    console.log(
      `           ${aprob} aprobadas · ${report} reportadas · ${noAprob} no aprobadas · ${nTareas - aprob - report - noAprob} pendientes`
    );
    console.log(`           ${nEvid} evidencias · ${nGastos} gastos · ${nAnticipos} anticipos`);
    if (fotosSubidas.length > 0) {
      console.log("\n  Paths de ejemplo en bucket 'evidencias':");
      for (const p of fotosSubidas.slice(0, 5)) console.log(`    ${p}`);
    }
    console.log("──────────────────────────────────────────────────────────");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
