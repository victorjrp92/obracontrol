/**
 * Corrige el reparto de m² por espacio del demo «Rosas Cali».
 *
 * El seed (`scripts/seed-demo-rosas.ts`) reparte más m² en los espacios de
 * los Tipos B, C y D de los que el tipo tiene en total (ver CAMBIO 4 del
 * pedido: 45 de 60 unidades incumplen la regla de `src/lib/metraje.ts`).
 * Se corrige aquí, en la base de datos, y NO en el seed ni en el generador,
 * para no tocar los tamaños de apartamento (48/62/78/92 m²) que sí son
 * realistas y se muestran tal cual al usuario.
 *
 * Solo se toca «Rosas Cali»: es el proyecto DEMO que Seiricon controla. Los
 * proyectos reales pertenecen a datos de clientes — corregirles el metraje
 * sin que lo pidan sería alterar información de su obra sin autorización,
 * y por eso el pedido es explícito en no tocarlos.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { excesoMetraje, sumaEspacios, type TipoMetraje } from "../src/lib/metraje";

config({ path: ".env.local" });
config({ path: ".env" });

const NOMBRE_PROYECTO = "Rosas Cali";

/**
 * En un apartamento real los cuartos ocupan entre 80% y 90% del área
 * construida — el resto son muros y circulaciones que no se listan como
 * espacio. 86% es el punto medio de ese rango.
 */
const OCUPACION_OBJETIVO = 0.86;

/**
 * Por encima de esto, el reparto se corrige aunque NO rompa la regla.
 *
 * La regla de la app solo prohibe PASARSE del total, y con razon: sumar menos
 * es lo normal. Pero un apartamento donde los cuartos ocupan el 96% del area
 * construida es fisicamente imposible -solo los muros se llevan entre el 10% y
 * el 20%-, y este proyecto se le ensena a constructoras: un arquitecto lo nota
 * en dos segundos. Asi que aqui, que es el demo y no la app, el liston esta
 * mas alto que la regla.
 */
const OCUPACION_MAXIMA_CREIBLE = 0.90;
const PASO_REDONDEO = 0.5;
/** Un baño no puede quedar en 0,5 m² tras escalar: mínimo razonable. */
const MINIMO_ESPACIO_M2 = 1.5;

/** Redondea al 0,5 más cercano, sin bajar del mínimo por espacio. */
function redondear(n: number): number {
  return Math.max(MINIMO_ESPACIO_M2, Math.round(n / PASO_REDONDEO) * PASO_REDONDEO);
}

const promedio = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const proyecto = await prisma.proyecto.findFirst({ where: { nombre: NOMBRE_PROYECTO } });
  if (!proyecto) throw new Error(`no existe ${NOMBRE_PROYECTO}`);

  const unidades = await prisma.unidad.findMany({
    where: {
      piso: { edificio: { proyecto_id: proyecto.id } },
      metraje_total: { not: null },
    },
    include: { espacios: true, tipo_unidad: true },
  });
  console.log(`${unidades.length} unidades con metraje_total en "${NOMBRE_PROYECTO}"`);

  const updates: { id: string; metraje: number }[] = [];
  const porTipo = new Map<string, { total: number; sumaAntes: number[]; sumaDespues: number[] }>();

  for (const u of unidades) {
    const total = u.metraje_total!;
    const tipoNombre = u.tipo_unidad?.nombre ?? "(sin tipo)";

    // Misma forma que usan la interfaz y las rutas de API: escala esta
    // unidad SOLO si `excesoMetraje` (la misma regla, no una reimplementada
    // a mano) la marca como excedida.
    const forma: TipoMetraje = {
      nombre: tipoNombre,
      espacios: u.espacios.map((e) => e.nombre),
      metraje_total: total,
      metrajes_espacios: Object.fromEntries(
        u.espacios.filter((e) => e.metraje != null).map((e) => [e.nombre, e.metraje as number]),
      ),
    };
    const sumaAntes = sumaEspacios(forma);
    // `excesoMetraje` marca lo que ROMPE la regla; aqui ademas se corrige lo
    // que la cumple pero no se sostiene en pie. Lo primero es un subconjunto
    // de lo segundo: pasarse del 100% es pasarse del 90%.
    const inverosimil = sumaAntes > total * OCUPACION_MAXIMA_CREIBLE;
    const exceso = excesoMetraje(forma);

    let sumaDespues = sumaAntes;
    if (exceso || inverosimil) {
      // Escalar proporcionalmente (no poner números a mano) preserva las
      // proporciones que ya tiene el demo: la alcoba principal sigue siendo
      // mayor que la secundaria, el baño social más chico que el principal.
      const factor = (total * OCUPACION_OBJETIVO) / sumaAntes;
      let nuevaSuma = 0;
      for (const espacio of u.espacios) {
        if (espacio.metraje == null || !Number.isFinite(espacio.metraje)) continue;
        const nuevoValor = redondear(espacio.metraje * factor);
        nuevaSuma += nuevoValor;
        updates.push({ id: espacio.id, metraje: nuevoValor });
      }
      sumaDespues = nuevaSuma;
    }

    const entry = porTipo.get(tipoNombre) ?? { total, sumaAntes: [], sumaDespues: [] };
    entry.sumaAntes.push(sumaAntes);
    entry.sumaDespues.push(sumaDespues);
    porTipo.set(tipoNombre, entry);
  }

  // Escribir en lotes: ~45 unidades × ~10 espacios son varios cientos de
  // updates, y un solo `$transaction` con todos ellos revienta por timeout
  // (5 s por defecto en este repo) mucho antes de terminar.
  const TAMANO_LOTE = 25;
  for (let i = 0; i < updates.length; i += TAMANO_LOTE) {
    const lote = updates.slice(i, i + TAMANO_LOTE);
    await Promise.all(
      lote.map((u) => prisma.espacio.update({ where: { id: u.id }, data: { metraje: u.metraje } })),
    );
  }
  console.log(`${updates.length} espacios actualizados\n`);

  for (const [tipo, { total, sumaAntes, sumaDespues }] of porTipo) {
    const antes = promedio(sumaAntes);
    const despues = promedio(sumaDespues);
    const ocupacion = Math.round((despues / total) * 100);
    console.log(
      `${tipo}: total ${total} m² · suma antes ${antes.toFixed(1)} m² · suma después ${despues.toFixed(1)} m² · ocupación final ${ocupacion}%`,
    );
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
