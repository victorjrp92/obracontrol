/**
 * Duraciones REALES para «Rosas Cali», con una historia detrás.
 *
 * El seed dejaba `fecha_inicio` a una distancia aleatoria del fin, así que
 * «cuánto tardó de verdad» era ruido. Las métricas de velocidad —% a tiempo,
 * días de más, ciclo por unidad— sobre ruido no enseñan nada.
 *
 * Aquí el tiempo real de cada tarea es el acordado multiplicado por un factor
 * que combina tres cosas que pasan en obra de verdad:
 *
 *   CUADRILLA. Torre 1 la hace gente con oficio (rinde por encima del plan);
 *   Torre 3 es equipo nuevo y va un tercio por encima. Es la diferencia que
 *   un gerente quiere poder ver ANTES de que se le vuelva un mes perdido.
 *
 *   CURVA DE APRENDIZAJE Y DESGASTE. De enero a junio la obra mejora —la
 *   gente aprende el edificio—. En julio y agosto se deteriora: rotación,
 *   lluvia y los siete festivos colombianos de esos dos meses.
 *
 *   EL OFICIO. Acabados y carpintería se pasan del plan casi siempre; obra
 *   gris y mampostería son predecibles. Cualquiera que haya estado en una
 *   obra lo reconoce, y por eso la gráfica se lee sin explicación.
 *
 * `fecha_fin_real` NO se toca: la línea de tiempo de cierres ya está bien.
 * Lo que se mueve es el ARRANQUE, que es lo que define cuánto duró.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const DIA = 86_400_000;
const rnd = (s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)(20260912);

/** Ruido lognormal suave: casi todo cerca del plan, cola a la derecha. */
function ruido(): number {
  const u = Math.max(1e-9, rnd()), v = Math.max(1e-9, rnd());
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.exp(z * 0.17);
}

/**
 * Escala global. Los tres factores se MULTIPLICAN, así que sin ella la
 * mediana se va muy por encima del plan: con los valores crudos solo el 29%
 * de las tareas llegaba a tiempo, y eso no se lee como «hay que mejorar»,
 * se lee como «este software está mal calibrado». Con k = 0.78 quedan cerca de siete
 * de cada diez dentro del plan, que es lo que rinde una obra bien llevada.
 */
const ESCALA = 0.78;

const CUADRILLA: Record<string, number> = { "Torre 1": 0.93, "Torre 2": 1.08, "Torre 3": 1.34 };
/** ene…dic — mejora hasta junio, se deteriora en julio y agosto. */
const MES = [1.22, 1.16, 1.08, 1.02, 0.97, 0.95, 1.14, 1.21, 1.06, 1, 1, 1];
const OFICIO: Record<string, number> = {
  "Obra gris / Estructura": 0.98, "Mampostería": 1.0,
  "Instalaciones hidrosanitarias": 1.06, "Instalaciones eléctricas": 1.04,
  "Pañete y estuco": 1.03, "Enchapes y pisos": 1.12,
  "Carpintería y closets": 1.24, "Pintura": 1.09,
  "Aparatos y acabados": 1.18, "Aseo y entrega": 0.95,
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const proyecto = await prisma.proyecto.findFirst({ where: { nombre: "Rosas Cali" } });
  if (!proyecto) throw new Error("no existe Rosas Cali");

  const tareas = await prisma.tarea.findMany({
    where: {
      espacio: { unidad: { piso: { edificio: { proyecto_id: proyecto.id } } } },
      estado: "APROBADA", fecha_fin_real: { not: null },
    },
    select: {
      id: true, tiempo_acordado_dias: true, fecha_fin_real: true,
      fase: { select: { nombre: true } },
      espacio: { select: { unidad: { select: { piso: { select: { edificio: { select: { nombre: true } } } } } } } },
    },
  });
  console.log(`${tareas.length} tareas aprobadas`);

  const filas: string[] = [];
  let aTiempo = 0;
  for (const t of tareas) {
    const torre = t.espacio.unidad.piso.edificio.nombre;
    const fin = t.fecha_fin_real!;
    const factor =
      ESCALA * (CUADRILLA[torre] ?? 1) * (MES[fin.getUTCMonth()] ?? 1) *
      (OFICIO[t.fase.nombre] ?? 1) * ruido();
    // Mínimo medio día: nada se hace en cero, y una duración de 0 rompe
    // cualquier división de las métricas.
    const dias = Math.max(0.5, t.tiempo_acordado_dias * factor);
    if (dias <= t.tiempo_acordado_dias + 1e-9) aTiempo++;
    const inicio = new Date(fin.getTime() - dias * DIA);
    filas.push(`('${t.id}', timestamptz '${inicio.toISOString()}')`);
  }

  for (let i = 0; i < filas.length; i += 500) {
    await pool.query(`update tareas t set fecha_inicio = d.f
      from (values ${filas.slice(i, i + 500).join(",")}) as d(id, f) where t.id = d.id`);
  }
  console.log(`${filas.length} duraciones reales escritas`);
  console.log(`${aTiempo} a tiempo = ${Math.round(aTiempo / tareas.length * 100)}% del total`);

  await prisma.$disconnect(); await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
