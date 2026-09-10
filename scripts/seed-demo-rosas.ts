/**
 * DEMO COMERCIAL — «Rosas Cali», dentro de Constructora Demo Cali.
 *
 * Se construye para enseñárselo a una constructora interesada, y todo aquí
 * está puesto para responder una sola pregunta: ¿qué nivel de detalle da
 * Seiricon sobre una obra en ejecución?
 *
 *   3 torres × 5 pisos × 4 apartamentos = 60 unidades, 4 tipologías.
 *
 * ══ LAS DECISIONES QUE HACEN QUE PAREZCA UNA OBRA DE VERDAD ════════════════
 *
 * 1. EL AVANCE NO SE ESCRIBE, SE CONSTRUYE. `calcularProgreso` es aprobadas ÷
 *    total; un porcentaje inventado se vería bien en la tarjeta y mal en cuanto
 *    alguien abriera un espacio. Aquí se aprueban tareas de verdad.
 *
 * 2. EL AVANCE ES POR FRENTE DE FASE, NO ALEATORIO. Una obra real no tiene el
 *    60% de cada fase: tiene las primeras fases cerradas, una en curso y las
 *    siguientes sin empezar. Cada torre lleva un «frente» distinto (T1 en
 *    pintura y entrega, T2 en enchapes, T3 en obra gris) y dentro de la torre
 *    los pisos bajos van adelante. Eso es lo que hace que la vista por fases
 *    cuente algo en vez de verse como ruido.
 *
 * 3. REPORTADO ≠ APROBADO. En el frente de cada torre quedan tareas
 *    REPORTADA (esperando al supervisor) y NO_APROBADA (devueltas con motivo).
 *    Es la diferencia que separa a Seiricon de una hoja de cálculo, así que
 *    tiene que verse en pantalla.
 *
 * 4. LAS TAREAS REPORTADAS LLEVAN FOTO. Una tarea reportada sin evidencia es
 *    precisamente lo que el producto promete que no pasa. Las fotos se suben
 *    UNA vez al bucket y muchas evidencias apuntan al mismo archivo: subir una
 *    por tarea serían miles de cargas para un demo.
 *
 * 5. LAS TIPOLOGÍAS TIENEN ESPACIOS DISTINTOS. Un tipo A de una alcoba no
 *    tiene las mismas tareas que un tipo D con estudio y cuarto útil. Es el
 *    detalle que una constructora reconoce de inmediato.
 *
 * IDEMPOTENTE: borra el proyecto anterior con ese nombre y lo rehace.
 * Determinista: dos corridas producen exactamente la misma obra.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

config({ path: ".env.local" });
config({ path: ".env" });

const EMAIL_ADMIN = "admin.general@obracontrol.local";
const NOMBRE_PROYECTO = "Rosas Cali";
const BUCKET = "evidencias";

/** Determinista: misma obra en cada corrida. */
const rnd = (s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)(20260910);
const id = () => randomBytes(12).toString("hex");
const elige = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

// ─── Fases, en orden constructivo ────────────────────────────────────────────
const FASES = [
  "Obra gris / Estructura",
  "Mampostería",
  "Instalaciones hidrosanitarias",
  "Instalaciones eléctricas",
  "Pañete y estuco",
  "Enchapes y pisos",
  "Carpintería y closets",
  "Pintura",
  "Aparatos y acabados",
  "Aseo y entrega",
] as const;
type Fase = typeof FASES[number];
const idxFase = (f: Fase) => FASES.indexOf(f);

// ─── Qué se hace en cada clase de espacio ────────────────────────────────────
interface Plantilla { fase: Fase; nombre: string; dias: number }
const T = (fase: Fase, nombre: string, dias: number): Plantilla => ({ fase, nombre, dias });

const TAREAS: Record<string, Plantilla[]> = {
  sala: [
    T("Mampostería", "Levante de muros divisorios", 3),
    T("Instalaciones eléctricas", "Salidas eléctricas y tomacorrientes", 2),
    T("Pañete y estuco", "Pañete de muros", 3),
    T("Pañete y estuco", "Estuco y lijado", 2),
    T("Enchapes y pisos", "Instalación de piso laminado", 2),
    T("Enchapes y pisos", "Guardaescoba", 1),
    T("Pintura", "Pintura de muros y cielo raso", 2),
    T("Aseo y entrega", "Aseo fino y retoques", 1),
  ],
  cocina: [
    T("Mampostería", "Levante de muros", 2),
    T("Instalaciones hidrosanitarias", "Puntos hidráulicos y desagües", 2),
    T("Instalaciones eléctricas", "Salidas para electrodomésticos", 2),
    T("Pañete y estuco", "Pañete de muros", 2),
    T("Enchapes y pisos", "Enchape de piso", 2),
    T("Enchapes y pisos", "Enchape de pared (salpicadero)", 2),
    T("Carpintería y closets", "Mueble bajo y superior", 3),
    T("Carpintería y closets", "Mesón en cuarzo", 2),
    T("Aparatos y acabados", "Grifería, poceta y accesorios", 1),
    T("Pintura", "Pintura de cielo raso", 1),
    T("Aseo y entrega", "Aseo fino", 1),
  ],
  bano: [
    T("Mampostería", "Levante de muros", 2),
    T("Instalaciones hidrosanitarias", "Puntos hidráulicos", 2),
    T("Instalaciones hidrosanitarias", "Desagües y sifones", 1),
    T("Enchapes y pisos", "Enchape de piso", 2),
    T("Enchapes y pisos", "Enchape de pared", 3),
    T("Carpintería y closets", "Mueble de lavamanos", 2),
    T("Aparatos y acabados", "Sanitario y lavamanos", 1),
    T("Aparatos y acabados", "Grifería y accesorios de baño", 1),
    T("Pintura", "Pintura de cielo raso", 1),
    T("Aseo y entrega", "Aseo fino", 1),
  ],
  alcoba: [
    T("Mampostería", "Levante de muros", 2),
    T("Instalaciones eléctricas", "Salidas eléctricas", 2),
    T("Pañete y estuco", "Pañete de muros", 2),
    T("Pañete y estuco", "Estuco y lijado", 2),
    T("Enchapes y pisos", "Instalación de piso laminado", 2),
    T("Enchapes y pisos", "Guardaescoba", 1),
    T("Carpintería y closets", "Closet", 3),
    T("Pintura", "Pintura de muros y cielo raso", 2),
    T("Aseo y entrega", "Aseo fino", 1),
  ],
  estudio: [
    T("Mampostería", "Levante de muros", 2),
    T("Instalaciones eléctricas", "Salidas eléctricas y datos", 2),
    T("Pañete y estuco", "Pañete y estuco", 3),
    T("Enchapes y pisos", "Instalación de piso laminado", 2),
    T("Enchapes y pisos", "Guardaescoba", 1),
    T("Pintura", "Pintura de muros y cielo raso", 2),
    T("Aseo y entrega", "Aseo fino", 1),
  ],
  balcon: [
    T("Obra gris / Estructura", "Losa y baranda", 3),
    T("Enchapes y pisos", "Enchape de piso exterior", 2),
    T("Pintura", "Pintura de muros exteriores", 1),
    T("Aseo y entrega", "Aseo", 1),
  ],
  ropas: [
    T("Instalaciones hidrosanitarias", "Punto de lavadora y desagüe", 2),
    T("Enchapes y pisos", "Enchape de piso", 1),
    T("Carpintería y closets", "Mueble de ropas", 2),
    T("Aparatos y acabados", "Lavadero y grifería", 1),
    T("Aseo y entrega", "Aseo", 1),
  ],
  util: [
    T("Mampostería", "Levante de muros", 1),
    T("Pañete y estuco", "Pañete y estuco", 2),
    T("Pintura", "Pintura", 1),
    T("Aseo y entrega", "Aseo", 1),
  ],
};

// ─── Las cuatro tipologías ───────────────────────────────────────────────────
interface Tipologia { nombre: string; m2: number; espacios: { nombre: string; clase: string; m2: number }[] }
const E = (nombre: string, clase: string, m2: number) => ({ nombre, clase, m2 });

const TIPOLOGIAS: Tipologia[] = [
  { nombre: "Tipo A · 1 alcoba", m2: 48, espacios: [
    E("Sala-comedor", "sala", 18), E("Cocina", "cocina", 7),
    E("Baño", "bano", 4), E("Alcoba principal", "alcoba", 12), E("Balcón", "balcon", 5) ] },
  { nombre: "Tipo B · 2 alcobas", m2: 62, espacios: [
    E("Sala-comedor", "sala", 20), E("Cocina", "cocina", 8),
    E("Baño social", "bano", 3), E("Baño principal", "bano", 4),
    E("Alcoba principal", "alcoba", 13), E("Alcoba 2", "alcoba", 10), E("Balcón", "balcon", 5) ] },
  { nombre: "Tipo C · 3 alcobas", m2: 78, espacios: [
    E("Sala-comedor", "sala", 22), E("Cocina", "cocina", 9),
    E("Baño social", "bano", 3), E("Baño principal", "bano", 5),
    E("Alcoba principal", "alcoba", 14), E("Alcoba 2", "alcoba", 10), E("Alcoba 3", "alcoba", 9),
    E("Zona de ropas", "ropas", 3), E("Balcón", "balcon", 6) ] },
  { nombre: "Tipo D · 3 alcobas + estudio", m2: 92, espacios: [
    E("Sala-comedor", "sala", 25), E("Cocina", "cocina", 10),
    E("Baño social", "bano", 3), E("Baño principal", "bano", 6), E("Baño alcoba 2", "bano", 4),
    E("Alcoba principal", "alcoba", 15), E("Alcoba 2", "alcoba", 11), E("Alcoba 3", "alcoba", 10),
    E("Estudio", "estudio", 9), E("Zona de ropas", "ropas", 3),
    E("Cuarto útil", "util", 2), E("Balcón", "balcon", 7) ] },
];

// ─── Las tres torres y su frente de avance ───────────────────────────────────
// `frente` = hasta qué fase (1-based) llegó la torre. Las fases por debajo
// están aprobadas, la del frente está en curso (reportadas, devueltas) y las
// de arriba no han empezado.
const TORRES = [
  { nombre: "Torre 1", frente: 9.4, etiqueta: "en acabados y entrega" },
  { nombre: "Torre 2", frente: 6.1, etiqueta: "en enchapes y carpintería" },
  { nombre: "Torre 3", frente: 2.5, etiqueta: "en obra gris y mampostería" },
];

const NOTAS_REPORTE = [
  "Terminado. Queda pendiente el remate del guardaescoba.",
  "Listo para revisión, se usó el material entregado en bodega.",
  "Se terminó hoy en la mañana. Fotos adjuntas.",
  "Ejecutado completo. El residente ya lo vio en sitio.",
  "Terminado. Hubo que resanar una fisura del muro antes de estucar.",
];
const MOTIVOS_RECHAZO = [
  "Falta el remate contra el marco de la puerta.",
  "El enchape quedó desnivelado en la esquina sur. Repetir.",
  "La pintura quedó con manchas de rodillo. Dar segunda mano.",
  "Falta sellar la junta del sifón. Se devuelve.",
  "El estuco quedó con ondulaciones visibles a contraluz.",
];

// Fotos libres (Unsplash / Pexels), sin primeros planos de rostros.
const FOTOS = [
  { key: "estructura", fases: ["Obra gris / Estructura"], url: "https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { key: "mamposteria", fases: ["Mampostería"], url: "https://images.pexels.com/photos/159306/construction-site-build-construction-work-159306.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { key: "acero", fases: ["Obra gris / Estructura", "Mampostería"], url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=75&fm=jpg&fit=max" },
  { key: "estuco", fases: ["Pañete y estuco"], url: "https://images.pexels.com/photos/6474205/pexels-photo-6474205.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { key: "enchape-bano", fases: ["Enchapes y pisos"], url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&q=75&fm=jpg&fit=max" },
  { key: "pintura-rodillo", fases: ["Pintura"], url: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=1200&q=75&fm=jpg&fit=max" },
  { key: "pintura-interior", fases: ["Pintura", "Aseo y entrega"], url: "https://images.pexels.com/photos/7218525/pexels-photo-7218525.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { key: "carpinteria", fases: ["Carpintería y closets"], url: "https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { key: "instalaciones", fases: ["Instalaciones hidrosanitarias", "Instalaciones eléctricas"], url: "https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { key: "acabados", fases: ["Aparatos y acabados"], url: "https://images.pexels.com/photos/6580227/pexels-photo-6580227.jpeg?auto=compress&cs=tinysrgb&w=1200" },
] as const;

// Cali, barrio El Ingenio. Cada foto cae a metros del centro de la obra.
const OBRA_LAT = 3.3729, OBRA_LNG = -76.5387;
const jitter = () => (rnd() - 0.5) * 0.0009;

const DIA = 86_400_000;
const HOY = new Date("2026-09-10T12:00:00Z");
const INICIO = new Date(HOY.getTime() - 250 * DIA);

// ─── Estado de una tarea según el frente de su torre ─────────────────────────
type Estado = "PENDIENTE" | "REPORTADA" | "APROBADA" | "NO_APROBADA";

/**
 * El frente efectivo de una tarea: el de su torre, corrido por el piso.
 *
 * El sesgo tiene que ser SIMÉTRICO alrededor de cero o el promedio de la torre
 * se desplaza: con (n-i)/n el piso 1 aportaba +0.5 y el último 0, es decir un
 * sesgo medio de +0.25 que empujaba el avance de toda la obra hacia arriba.
 */
function frenteEfectivo(frenteTorre: number, piso: number, totalPisos: number): number {
  const sesgo = totalPisos > 1 ? 0.5 - (piso - 1) / (totalPisos - 1) : 0;
  return frenteTorre + sesgo * 1.6;
}

function estadoDe(faseOrden: number, frente: number): Estado {
  if (faseOrden < frente - 0.55) return "APROBADA";
  if (faseOrden > frente + 0.55) return "PENDIENTE";
  // Dentro del frente: la mayoría aprobada, algunas esperando revisión y unas
  // pocas devueltas. Esa mezcla es la que hace visible el flujo de aprobación.
  const r = rnd();
  if (r < 0.46) return "APROBADA";
  if (r < 0.86) return "REPORTADA";
  return "NO_APROBADA";
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } });

  const admin = await prisma.usuario.findUnique({
    where: { email: EMAIL_ADMIN },
    include: { constructora: true },
  });
  if (!admin) throw new Error(`No existe ${EMAIL_ADMIN}`);
  const cid = admin.constructora_id;
  console.log(`Constructora: ${admin.constructora.nombre}`);

  // Responsables: los contratistas que ya existen en esa constructora.
  const equipo = await prisma.usuario.findMany({
    where: { constructora_id: cid },
    include: { rol_ref: true },
  });
  const contratistas = equipo.filter(u => u.rol_ref.nivel_acceso === "CONTRATISTA");
  const supervisores = equipo.filter(u =>
    ["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"].includes(u.rol_ref.nivel_acceso));
  if (contratistas.length === 0) throw new Error("La constructora no tiene contratistas");
  console.log(`Responsables: ${contratistas.map(c => c.nombre).join(", ")}`);

  // ── Idempotencia: borrar la versión anterior ───────────────────────────────
  const previo = await prisma.proyecto.findFirst({ where: { constructora_id: cid, nombre: NOMBRE_PROYECTO } });
  if (previo) {
    await prisma.proyecto.delete({ where: { id: previo.id } });
    console.log(`Proyecto anterior borrado (cascada)`);
  }

  // ── Proyecto ───────────────────────────────────────────────────────────────
  const m2Totales = TIPOLOGIAS.reduce((a, t) => a + t.m2, 0) * 5 * TORRES.length;
  const proyecto = await prisma.proyecto.create({
    data: {
      constructora_id: cid, nombre: NOMBRE_PROYECTO, subtipo: "APARTAMENTOS",
      ciudad: "Cali", ubicacion_lat: OBRA_LAT, ubicacion_lng: OBRA_LNG,
      estado: "ACTIVO", dias_habiles_semana: 6,
      fecha_inicio: INICIO,
      fecha_fin_estimada: new Date(INICIO.getTime() + 520 * DIA),
      tipo_obra: "OBRA_NUEVA", tipo_propiedad: "EDIFICIO",
      punto_partida: "MEDIAS",
      direccion_inmueble: "Calle 16 # 105-40, El Ingenio",
      conjunto_edificio: "Conjunto Residencial Rosas",
      metraje_total: m2Totales,
      // El presupuesto va SOLO por tarea, no a nivel de proyecto: las tres
      // columnas `presupuesto_*` de Proyecto son `Int` de Postgres y topan en
      // $2.147 millones, que cualquier obra de constructora supera. Con el
      // detalle por tarea el total sale sumando, y de paso se ve mejor.
      presupuesto_total: null,
    },
  });
  console.log(`Proyecto creado: ${NOMBRE_PROYECTO} — ${m2Totales} m²`);

  // ── Fases y tipologías ─────────────────────────────────────────────────────
  const fases = new Map<Fase, string>();
  for (const [i, nombre] of FASES.entries()) {
    const f = await prisma.fase.create({ data: { proyecto_id: proyecto.id, nombre, orden: i + 1 } });
    fases.set(nombre, f.id);
  }
  const tipos = new Map<string, string>();
  for (const t of TIPOLOGIAS) {
    const tu = await prisma.tipoUnidad.create({ data: { proyecto_id: proyecto.id, nombre: t.nombre } });
    tipos.set(t.nombre, tu.id);
  }
  console.log(`${FASES.length} fases · ${TIPOLOGIAS.length} tipologías`);

  // ── Torres → pisos → unidades → espacios → tareas ──────────────────────────
  interface TareaSembrada { id: string; estado: Estado; fase: Fase; torre: string; asignado: string }
  const tareasFilas: Record<string, unknown>[] = [];
  const sembradas: TareaSembrada[] = [];
  let nUnidades = 0, nEspacios = 0;

  for (const torre of TORRES) {
    const ed = await prisma.edificio.create({
      data: { proyecto_id: proyecto.id, nombre: torre.nombre, num_pisos: 5 },
    });
    for (let np = 1; np <= 5; np++) {
      const piso = await prisma.piso.create({ data: { edificio_id: ed.id, numero: np } });
      const frente = frenteEfectivo(torre.frente, np, 5);

      for (const [iu, tipo] of TIPOLOGIAS.entries()) {
        nUnidades++;
        const unidad = await prisma.unidad.create({
          data: {
            piso_id: piso.id,
            nombre: `Apto ${np}0${iu + 1}`,
            nombre_personalizado: `Apto ${np}0${iu + 1}`,
            tipo_unidad_id: tipos.get(tipo.nombre),
            metraje_total: tipo.m2,
          },
        });
        // Un responsable por apartamento: es como se reparte en obra.
        const responsable = contratistas[(nUnidades - 1) % contratistas.length];

        for (const esp of tipo.espacios) {
          nEspacios++;
          const espacio = await prisma.espacio.create({
            data: { unidad_id: unidad.id, nombre: esp.nombre, metraje: esp.m2 },
          });
          for (const pl of TAREAS[esp.clase]) {
            const orden = idxFase(pl.fase) + 1;
            const estado = estadoDe(orden, frente);
            const tid = id();
            // Las fechas siguen al frente: lo aprobado ya pasó, lo reportado
            // es de esta semana. Sin esto el semáforo de plazos no dice nada.
            const diasAtras = estado === "APROBADA" ? Math.round(20 + rnd() * 180)
              : estado === "REPORTADA" || estado === "NO_APROBADA" ? Math.round(1 + rnd() * 8)
              : 0;
            const inicio = diasAtras ? new Date(HOY.getTime() - (diasAtras + pl.dias) * DIA) : null;
            const fin = estado === "APROBADA" ? new Date(HOY.getTime() - diasAtras * DIA) : null;

            tareasFilas.push({
              id: tid, espacio_id: espacio.id, fase_id: fases.get(pl.fase)!,
              nombre: pl.nombre, tiempo_acordado_dias: pl.dias, estado,
              asignado_a: responsable.id,
              fecha_inicio: inicio, fecha_fin_real: fin,
              nota_reporte: estado === "PENDIENTE" ? null : elige(NOTAS_REPORTE),
              presupuesto_mano_obra: Math.round((300_000 + rnd() * 900_000) / 1000) * 1000,
              presupuesto_materiales: Math.round((200_000 + rnd() * 1_400_000) / 1000) * 1000,
            });
            sembradas.push({ id: tid, estado, fase: pl.fase, torre: torre.nombre, asignado: responsable.id });
          }
        }
      }
    }
    console.log(`  ${torre.nombre} — ${torre.etiqueta}`);
  }

  for (let i = 0; i < tareasFilas.length; i += 500) {
    await prisma.tarea.createMany({ data: tareasFilas.slice(i, i + 500) as never });
  }
  console.log(`${nUnidades} unidades · ${nEspacios} espacios · ${tareasFilas.length} tareas`);

  // ── Fotos: se suben UNA vez y muchas evidencias apuntan al mismo archivo ────
  console.log("\nSubiendo fotos de referencia al bucket…");
  const rutas = new Map<string, string>();
  for (const f of FOTOS) {
    try {
      const res = await fetch(f.url);
      if (!res.ok) { console.log(`  ✗ ${f.key} (HTTP ${res.status})`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const ruta = `demo-rosas-cali/${admin.id}/${f.key}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(ruta, buf, { contentType: "image/jpeg", upsert: true });
      if (error) { console.log(`  ✗ ${f.key}: ${error.message}`); continue; }
      rutas.set(f.key, ruta);
      console.log(`  ✓ ${f.key} (${Math.round(buf.length / 1024)} KB)`);
    } catch (e) { console.log(`  ✗ ${f.key}: ${e instanceof Error ? e.message : e}`); }
  }
  if (rutas.size === 0) throw new Error("No se pudo subir ninguna foto: el demo quedaría sin evidencia");

  const porFase = new Map<Fase, string[]>();
  for (const f of FOTOS) {
    const r = rutas.get(f.key); if (!r) continue;
    for (const fa of f.fases) porFase.set(fa as Fase, [...(porFase.get(fa as Fase) ?? []), r]);
  }
  const todas = [...rutas.values()];
  const fotoDe = (fa: Fase) => { const c = porFase.get(fa); return c && c.length ? elige(c) : elige(todas); };

  // ── Evidencias: toda tarea reportada o aprobada lleva foto ─────────────────
  const evidencias: Record<string, unknown>[] = [];
  for (const t of sembradas) {
    if (t.estado === "PENDIENTE") continue;
    const n = 1 + (rnd() < 0.45 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      evidencias.push({
        id: id(), tarea_id: t.id, tipo: "FOTO", url_storage: fotoDe(t.fase),
        gps_lat: OBRA_LAT + jitter(), gps_lng: OBRA_LNG + jitter(),
        timestamp_captura: new Date(HOY.getTime() - Math.round(rnd() * 170) * DIA - k * 3600_000),
        tomada_por: t.asignado,
      });
    }
  }
  for (let i = 0; i < evidencias.length; i += 500) {
    await prisma.evidencia.createMany({ data: evidencias.slice(i, i + 500) as never });
  }

  // ── Aprobaciones: quién aprobó o devolvió, y por qué ───────────────────────
  const aprobaciones: Record<string, unknown>[] = [];
  for (const t of sembradas) {
    if (t.estado !== "APROBADA" && t.estado !== "NO_APROBADA") continue;
    const sup = supervisores.length ? supervisores[Math.floor(rnd() * supervisores.length)] : admin;
    aprobaciones.push({
      id: id(), tarea_id: t.id, aprobador_id: sup.id,
      estado: t.estado === "APROBADA" ? "APROBADA" : "NO_APROBADA",
      fecha: new Date(HOY.getTime() - Math.round(rnd() * 160) * DIA),
      ...(t.estado === "NO_APROBADA"
        ? { justificacion_por_item: { general: elige(MOTIVOS_RECHAZO) } }
        : {}),
    });
  }
  for (let i = 0; i < aprobaciones.length; i += 500) {
    await prisma.aprobacion.createMany({ data: aprobaciones.slice(i, i + 500) as never });
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  const cuenta = (e: Estado) => sembradas.filter(t => t.estado === e).length;
  console.log(`\n${evidencias.length} evidencias con GPS y hora · ${aprobaciones.length} aprobaciones`);
  console.log(`\nEstado de las ${sembradas.length} tareas:`);
  for (const e of ["APROBADA", "REPORTADA", "NO_APROBADA", "PENDIENTE"] as Estado[]) {
    console.log(`  ${e.padEnd(13)} ${String(cuenta(e)).padStart(5)}  ${(cuenta(e) / sembradas.length * 100).toFixed(1)}%`);
  }
  console.log(`\nAvance por torre (aprobadas ÷ total, que es lo que muestra la app):`);
  for (const torre of TORRES) {
    const t = sembradas.filter(x => x.torre === torre.nombre);
    const ap = t.filter(x => x.estado === "APROBADA").length;
    const rep = t.filter(x => x.estado === "REPORTADA").length;
    console.log(`  ${torre.nombre}  ${String(Math.round(ap / t.length * 100)).padStart(3)}% aprobado · ` +
      `${String(Math.round((ap + rep) / t.length * 100)).padStart(3)}% reportado  (${torre.etiqueta})`);
  }
  const total = sembradas.length;
  const plata = tareasFilas.reduce((a, t) =>
    a + Number(t.presupuesto_mano_obra ?? 0) + Number(t.presupuesto_materiales ?? 0), 0);
  console.log(`\nAvance de la obra: ${Math.round(cuenta("APROBADA") / total * 100)}%`);
  console.log(`Presupuesto sumado del detalle: $${(plata / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 0 })} millones`);

  await prisma.$disconnect(); await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
