/**
 * Carga el cronograma planeado de «Rosas Cali».
 *
 * Sin el, el informe y la pantalla de Reportes solo saben decir «vamos al 49%»
 * y la tercera barra queda en «sin linea base» — que es correcto, pero deja el
 * demo enseñando el hueco en vez del producto.
 *
 * Usa el MISMO motor que el asistente (`repartirCronograma`), no un reparto
 * aparte: si el demo se calculara de otra forma que la app, estariamos
 * enseñando un numero que el producto no sabe producir.
 *
 * Idempotente: correrlo dos veces deja lo mismo.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { repartirCronograma } from "../src/lib/reparto-cronograma";
config({ path: ".env.local" });
config({ path: ".env" });

const OBRA = "Rosas Cali";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const proyecto = await prisma.proyecto.findFirst({
    where: { nombre: OBRA },
    select: {
      id: true, nombre: true, fecha_inicio: true, fecha_fin_estimada: true,
      dias_habiles_semana: true, modo_cronograma: true,
      fases: { select: { id: true, nombre: true, orden: true, tiempo_estimado_dias: true }, orderBy: { orden: "asc" } },
    },
  });
  if (!proyecto) throw new Error(`no existe la obra «${OBRA}»`);
  if (!proyecto.fecha_inicio || !proyecto.fecha_fin_estimada) {
    throw new Error("la obra no tiene fecha de inicio o de fin: sin ellas no hay contra que repartir");
  }

  const tareas = await prisma.tarea.findMany({
    where: { espacio: { unidad: { piso: { edificio: { proyecto_id: proyecto.id } } } } },
    select: { id: true, tiempo_acordado_dias: true, fase: { select: { nombre: true } } },
  });

  console.log(`${proyecto.nombre}: ${proyecto.fases.length} fases, ${tareas.length} tareas`);
  console.log(`  ventana: ${proyecto.fecha_inicio.toISOString().slice(0, 10)} → ${proyecto.fecha_fin_estimada.toISOString().slice(0, 10)}`);
  console.log(`  jornada: ${proyecto.dias_habiles_semana} dias/semana\n`);

  // AUTOMATICO: es un demo y nadie puso ventanas a mano. El motor solapa las
  // fases en vez de encadenarlas, que es lo correcto para tres torres.
  const r = repartirCronograma({
    inicio: proyecto.fecha_inicio,
    fin: proyecto.fecha_fin_estimada,
    diasHabilesSemana: proyecto.dias_habiles_semana ?? 6,
    modo: "AUTOMATICO",
    fases: proyecto.fases.map((f) => ({
      nombre: f.nombre, orden: f.orden, dias: f.tiempo_estimado_dias,
    })),
    tareas: tareas.map((t) => ({
      id: t.id, fase: t.fase.nombre, dias: t.tiempo_acordado_dias,
    })),
  });

  if (!r.ok) {
    console.error("El reparto rechazo la entrada:");
    r.motivos.forEach((m) => console.error(`  · ${m}`));
    process.exit(1);
  }
  r.avisos.forEach((a) => console.log(`  aviso: ${a}`));

  // --- Fases -------------------------------------------------------------
  for (const f of proyecto.fases) {
    const v = r.fases.get(f.nombre);
    if (!v) continue;
    await prisma.fase.update({
      where: { id: f.id },
      data: { fecha_inicio_plan: v.inicio, fecha_fin_plan: v.fin },
    });
    const d = (x: Date) => x.toISOString().slice(0, 10);
    console.log(`  ${String(f.orden).padStart(2)} ${f.nombre.padEnd(31)} ${d(v.inicio)} → ${d(v.fin)}`);
  }

  // --- Tareas, por lotes -------------------------------------------------
  // `updateMany` con un `in` de 4.110 ids revienta el limite de parametros, y
  // una transaccion de 4.110 updates se pasa de los 5 s. Lotes.
  const LOTE = 400;
  const entradas = [...r.tareas.entries()];
  let escritas = 0;
  for (let i = 0; i < entradas.length; i += LOTE) {
    await Promise.all(
      entradas.slice(i, i + LOTE).map(([id, v]) =>
        prisma.tarea.update({
          where: { id },
          data: { fecha_inicio_plan: v.inicio, fecha_fin_plan: v.fin },
        }),
      ),
    );
    escritas += Math.min(LOTE, entradas.length - i);
    process.stdout.write(`\r  tareas fechadas: ${escritas}/${entradas.length}`);
  }
  console.log();

  await prisma.proyecto.update({
    where: { id: proyecto.id },
    data: { modo_cronograma: "AUTOMATICO" },
  });

  console.log(`\n✅ Cronograma cargado. Modo AUTOMATICO.`);
  await prisma.$disconnect();
  await pool.end();
}

main();
