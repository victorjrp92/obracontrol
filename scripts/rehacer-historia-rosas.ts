/**
 * Reparte en el TIEMPO la historia de «Rosas Cali».
 *
 * El seed puso fechas de aprobación al azar dentro de los últimos meses. Para
 * el avance de la obra da igual —`calcularProgreso` solo mira el estado— pero
 * para el módulo de reportes es fatal: una serie aleatoria no tiene picos, no
 * tiene valles y no se puede leer. Un gerente que abre «productividad» y ve
 * ruido cierra la pestaña.
 *
 * El modelo: cada torre lleva un FRENTE (hasta qué fase llegó). Una tarea de
 * la fase p en una torre con frente F se aprobó cuando la obra llevaba
 * aproximadamente p/F de su camino. Así la torre 1, que va en la fase 9, tiene
 * sus fases tempranas cerradas en febrero; la torre 3, que va en la 2, gastó
 * los mismos ocho meses en llegar a mampostería — y eso es exactamente lo que
 * la gráfica tiene que dejar ver.
 *
 * Encima va una estacionalidad real: junio y julio rinden menos (lluvia y los
 * festivos colombianos, que son siete entre los dos meses). Sin un valle la
 * gráfica no enseña a leerse.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const DIA = 86_400_000;
const HOY = new Date("2026-09-11T12:00:00Z");
const INICIO = new Date("2026-01-03T12:00:00Z");
const DURACION = (HOY.getTime() - INICIO.getTime()) / DIA;

const FRENTE: Record<string, number> = { "Torre 1": 9.4, "Torre 2": 6.1, "Torre 3": 2.5 };
const rnd = (s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)(20260911);

/** Rendimiento del mes: junio y julio caen por lluvia y festivos. */
function factorMes(d: Date): number {
  return [1, 1, 1, 1, 1, 0.62, 0.55, 1.12, 1.05, 1, 1, 1][d.getUTCMonth()] ?? 1;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const proyecto = await prisma.proyecto.findFirst({ where: { nombre: "Rosas Cali" } });
  if (!proyecto) throw new Error("no existe Rosas Cali");

  const tareas = await prisma.tarea.findMany({
    where: { espacio: { unidad: { piso: { edificio: { proyecto_id: proyecto.id } } } } },
    select: {
      id: true, estado: true,
      fase: { select: { orden: true } },
      espacio: { select: { unidad: { select: { piso: { select: { edificio: { select: { nombre: true } } } } } } } },
    },
  });
  console.log(`${tareas.length} tareas`);

  const fechaDe = new Map<string, Date>();
  for (const t of tareas) {
    if (t.estado === "PENDIENTE") continue;
    const torre = t.espacio.unidad.piso.edificio.nombre;
    const frente = FRENTE[torre] ?? 5;
    // Fracción del camino recorrido cuando le tocó a esta fase.
    const frac = Math.min(0.995, (t.fase.orden - 0.5 + rnd() * 0.9) / frente);
    let dia = frac * DURACION;
    // La estacionalidad empuja el día hacia adelante cuando cae en mes flojo:
    // si en julio se rinde la mitad, lo de julio se corre y se acumula después.
    const tentativa = new Date(INICIO.getTime() + dia * DIA);
    dia += (1 - factorMes(tentativa)) * 18 * rnd();
    const f = new Date(INICIO.getTime() + Math.min(dia, DURACION - 0.5) * DIA);
    // Hora de obra: entre 7am y 5pm.
    f.setUTCHours(12 + Math.floor(rnd() * 10) - 5, Math.floor(rnd() * 60));
    fechaDe.set(t.id, f);
  }

  // Se actualiza con UPDATE ... FROM (VALUES ...): un viaje por tanda. Con
  // `prisma.$transaction` de updates sueltos son 200 idas y vueltas dentro de
  // una transacción, y se pasa del tope de 5 s antes de terminar la primera.
  const enLotes = async (
    etiqueta: string,
    filas: [string, Date][],
    sql: (valores: string) => string,
  ) => {
    let n = 0;
    for (const lote of chunk(filas, 500)) {
      const valores = lote
        .map(([id, f]) => `('${id}', timestamptz '${f.toISOString()}')`)
        .join(",");
      await pool.query(sql(valores));
      n += lote.length;
    }
    console.log(`  ${n} ${etiqueta}`);
  };

  // Las aprobaciones se fechan según el frente de su fase. Lo REPORTADA no se
  // toca: está esperando revisión AHORA, así que su fecha es de esta semana.
  const aprobaciones = await prisma.aprobacion.findMany({
    where: { tarea_id: { in: [...fechaDe.keys()] } },
    select: { tarea_id: true },
  });
  await enLotes(
    "aprobaciones refechadas",
    aprobaciones.map((a) => [a.tarea_id, fechaDe.get(a.tarea_id)!] as [string, Date]),
    (v) => `update aprobaciones a set fecha = d.f
            from (values ${v}) as d(tarea_id, f) where a.tarea_id = d.tarea_id`,
  );

  // `fecha_fin_real` acompaña: es la fecha que lee el semáforo de plazos.
  await enLotes(
    "tareas con fecha de fin coherente",
    tareas.filter((t) => t.estado === "APROBADA").map((t) => [t.id, fechaDe.get(t.id)!] as [string, Date]),
    (v) => `update tareas t set fecha_fin_real = d.f,
              fecha_inicio = d.f - (2 + random() * 4) * interval '1 day'
            from (values ${v}) as d(id, f) where t.id = d.id`,
  );

  // La evidencia se capturó ANTES de aprobarse, no después. Ese hueco de 0 a 4
  // días es el «tiempo de aprobación» que el reporte mide por supervisor.
  const evs = await prisma.evidencia.findMany({
    where: { tarea_id: { in: [...fechaDe.keys()] } },
    select: { id: true, tarea_id: true },
  });
  await enLotes(
    "evidencias refechadas",
    evs.map((e) => [e.id, fechaDe.get(e.tarea_id)!] as [string, Date]),
    (v) => `update evidencias e set timestamp_captura = d.f - (0.2 + random() * 4) * interval '1 day'
            from (values ${v}) as d(id, f) where e.id = d.id`,
  );

  await prisma.$disconnect(); await pool.end();
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

main().catch((e) => { console.error(e); process.exit(1); });
