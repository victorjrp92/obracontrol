/**
 * CONCILIACIÓN DE PAGOS HUÉRFANOS.
 *
 * Busca los cobros que llevan demasiado tiempo en PENDIENTE, le pregunta a
 * Wompi cómo terminaron de verdad, y los resuelve.
 *
 * ── Por qué hace falta ─────────────────────────────────────────────────────
 * El flujo normal es: se crea el cobro en PENDIENTE, la persona paga, y el
 * webhook de Wompi lo resuelve. Pero el webhook puede no llegar nunca — la ruta
 * estaba caída, hubo un despliegue justo en ese minuto, o Wompi agotó sus
 * reintentos. Ese pago se queda PENDIENTE para siempre.
 *
 * Y «PENDIENTE para siempre» no es un detalle contable: puede significar
 * DINERO COBRADO SIN ACCESO CONCEDIDO. El cliente pagó, el banco le debitó, y
 * el producto le sigue diciendo que su plan está vencido. Es la peor forma de
 * fallar de todas las que tiene un cobro, y la única manera de detectarla es
 * preguntarle a la pasarela por los que quedaron colgados.
 *
 * Uso:
 *   npx tsx scripts/conciliar-pagos.ts              (informe, no toca nada)
 *   npx tsx scripts/conciliar-pagos.ts --ejecutar   (resuelve lo que encuentre)
 *   npx tsx scripts/conciliar-pagos.ts --minutos 60 (cuánto esperar antes de
 *                                                    considerarlo huérfano)
 *
 * La resolución NO se implementa aquí: llama a `aplicarResultado()`, la misma
 * función que usa el webhook. Un pago resuelto por conciliación y otro resuelto
 * por webhook tienen que acabar idénticos.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Margen por defecto. Menos que esto y se estaría corriendo contra el webhook. */
const MINUTOS_POR_DEFECTO = 30;

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const ejecutar = process.argv.includes("--ejecutar");
  const minutos = Number(arg("minutos") ?? MINUTOS_POR_DEFECTO);
  if (!Number.isFinite(minutos) || minutos < 1) {
    console.error("--minutos debe ser un número >= 1");
    process.exit(1);
  }

  if (!process.env.WOMPI_PRIVATE_KEY) {
    console.error("Falta WOMPI_PRIVATE_KEY: sin ella no se le puede preguntar nada a Wompi.");
    process.exit(1);
  }

  // Después de dotenv: `@/lib/prisma` construye su cliente al cargarse.
  const { prisma } = await import("@/lib/prisma");
  const { consultarTransaccion } = await import("@/lib/pagos/wompi");
  const { aplicarResultado, SELECCION_PAGO } = await import("@/lib/pagos/conciliacion");
  const { formatearCOP } = await import("@/lib/suscripcion");

  try {
    const corte = new Date(Date.now() - minutos * 60_000);
    const huerfanos = await prisma.pagoSuscripcion.findMany({
      where: { estado: "PENDIENTE", created_at: { lt: corte } },
      select: SELECCION_PAGO,
      orderBy: { created_at: "asc" },
    });

    if (huerfanos.length === 0) {
      console.log(`\nNingún cobro lleva más de ${minutos} min en PENDIENTE. Todo conciliado.\n`);
      return;
    }

    console.log(`\n${huerfanos.length} cobro(s) llevan más de ${minutos} min sin resolverse:\n`);

    let acreditados = 0;
    let cerrados = 0;
    let discrepancias = 0;
    let sinRespuesta = 0;
    let revisarAMano = 0;

    for (const pago of huerfanos) {
      const edad = Math.round((Date.now() - pago.created_at.getTime()) / 60_000);
      const etiqueta = `${pago.referencia}  ${formatearCOP(pago.monto_centavos)}  (${edad} min)`;

      // LÍMITE HONESTO DE ESTE SCRIPT: el id de transacción lo escribe el
      // webhook, así que un pago cuyo webhook nunca llegó tampoco lo tiene, y
      // desde aquí NO se puede saber si esa persona pagó o abandonó el checkout.
      // Decir «no completó el pago» sería inventarlo, y justo en el caso que más
      // duele: alguien que sí pagó. Se marca para mirarlo a mano en el panel de
      // Wompi, que sí busca por referencia.
      if (!pago.wompi_transaccion_id) {
        console.log(`  ⚠️  ${etiqueta}  — SIN ID: revísalo en el panel de Wompi por su referencia`);
        revisarAMano++;
        continue;
      }

      const confirmada = await consultarTransaccion(pago.wompi_transaccion_id);
      if (!confirmada) {
        console.log(`  ?  ${etiqueta}  — Wompi no respondió; se reintenta la próxima vez`);
        sinRespuesta++;
        continue;
      }

      if (!ejecutar) {
        console.log(`  →  ${etiqueta}  — Wompi dice: ${confirmada.status}`);
        continue;
      }

      const r = await aplicarResultado(pago, confirmada);
      switch (r.accion) {
        case "acreditado":
          console.log(`  ✅ ${etiqueta}  — ACREDITADO, vigencia hasta ${r.venceEl.toISOString().slice(0, 10)}`);
          acreditados++;
          break;
        case "registrado":
          console.log(`  ·  ${etiqueta}  — cerrado como ${r.estado}`);
          cerrados++;
          break;
        case "monto_no_coincide":
          console.error(
            `  ⚠️  ${etiqueta}  — DISCREPANCIA DE MONTO: esperaba ${formatearCOP(r.esperado)}, ` +
              `Wompi cobró ${formatearCOP(r.recibido)}. Marcado ERROR, revísalo a mano.`,
          );
          discrepancias++;
          break;
        case "ya_resuelto":
          console.log(`  ·  ${etiqueta}  — lo resolvió el webhook mientras tanto (${r.estado})`);
          break;
        case "sigue_pendiente":
          console.log(`  ·  ${etiqueta}  — Wompi aún lo tiene en curso`);
          sinRespuesta++;
          break;
      }
    }

    if (!ejecutar) {
      console.log("\nInforme. No se tocó nada — repite con --ejecutar para resolverlos.\n");
      return;
    }

    console.log(
      `\n${acreditados} acreditado(s) · ${cerrados} cerrado(s) · ` +
        `${discrepancias} discrepancia(s) · ${sinRespuesta} sin resolver · ` +
        `${revisarAMano} a revisar a mano\n`,
    );
    if (acreditados > 0) {
      console.log("Los acreditados son clientes que YA habían pagado y no tenían su plan activo.\n");
    }
    if (revisarAMano > 0) {
      console.log(
        `${revisarAMano} cobro(s) no tienen id de transacción. Búscalos por su referencia ` +
          "en el panel de Wompi: si alguno aparece aprobado, es alguien que pagó y no " +
          "tiene su plan activo.\n",
      );
    }
    // Sale con error si queda algo que una persona tiene que mirar. Un
    // conciliador que siempre termina en verde no sirve para vigilar dinero.
    if (discrepancias > 0 || revisarAMano > 0) process.exitCode = 1;
  } finally {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("\nFalló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
