/**
 * Verificación del módulo de pagos y suscripciones. Mismo espíritu que
 * `verificar-reglas-alerta.ts`: TypeScript puro, sin red y sin base de datos,
 * para poder correrlo en cada commit.
 *
 * Cubre las dos cosas que, si están mal, cuestan dinero de verdad:
 *
 *  1. Las firmas de Wompi, contrastadas contra los ejemplos que publica su
 *     propia documentación. Si la firma de integridad está mal, el checkout no
 *     abre; si la del webhook está mal, cualquiera puede regalarse un plan.
 *  2. La vigencia de la suscripción: quién puede usar el producto y hasta
 *     cuándo, incluido el encadenado al renovar antes de tiempo.
 *
 * Uso: npm run verify:pagos
 */
import { createHash } from "crypto";
import {
  estadoDeAcceso,
  extenderVigencia,
  finDePrueba,
  limiteObrasActivas,
  precioTotalCentavos,
  preciosDePruebaActivos,
  TOPE_PRUEBA_CENTAVOS,
  PLANES,
} from "../src/lib/suscripcion";
// `firmaIntegridad` y `eventoEsAutentico` leen process.env en cada LLAMADA, no
// al importarse, así que basta con fijar los secretos antes de invocarlas.
import { eventoEsAutentico, firmaIntegridad } from "../src/lib/pagos/wompi";

let ok = 0;
let fallos = 0;

function comprobar(nombre: string, condicion: boolean, detalle?: string) {
  if (condicion) {
    ok++;
    console.log(`  OK   ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  }
}

function seccion(titulo: string) {
  console.log(`\n${titulo}`);
}

// ─── 1. Firma de integridad del Checkout ────────────────────────────────────
// Ejemplo publicado por Wompi (docs.wompi.co, Widget y Checkout Web):
//   referencia  sk8-438k4-xmxm392-sn2m
//   monto       2490000 (centavos)
//   moneda      COP
//   secreto     prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6
// La concatenación documentada y su SHA-256 esperado:
seccion("1) Firma de integridad del Checkout (ejemplo oficial de Wompi)");

const CADENA_OFICIAL = "sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6";
const HASH_OFICIAL = "37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5";

const hashCalculado = createHash("sha256").update(CADENA_OFICIAL).digest("hex");
comprobar(
  "SHA-256 de la cadena documentada coincide con el hash documentado",
  hashCalculado === HASH_OFICIAL,
  `calculado ${hashCalculado}`
);

// La misma cadena, pero armada por nuestro código en vez de a mano.

process.env.WOMPI_INTEGRITY_SECRET = "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6";

const nuestra = firmaIntegridad({
  referencia: "sk8-438k4-xmxm392-sn2m",
  montoCentavos: 2490000,
  moneda: "COP",
});
comprobar(
  "firmaIntegridad() reproduce el hash oficial",
  nuestra === HASH_OFICIAL,
  `obtenido ${nuestra}`
);
comprobar(
  "la firma sale en hexadecimal minúscula (Wompi la exige así)",
  nuestra === nuestra.toLowerCase()
);

// Cambiar el monto DEBE cambiar la firma: es lo que impide que alguien edite el
// precio en el navegador.
const otraFirma = firmaIntegridad({
  referencia: "sk8-438k4-xmxm392-sn2m",
  montoCentavos: 100,
  moneda: "COP",
});
comprobar("alterar el monto cambia la firma", otraFirma !== nuestra);

// ─── 2. Firma de los webhooks ───────────────────────────────────────────────
seccion("2) Firma de eventos (webhook)");

const SECRETO_EVENTOS = "prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";
process.env.WOMPI_EVENTS_SECRET = SECRETO_EVENTOS;

/** Arma un evento con el checksum correcto, como lo mandaría Wompi. */
function eventoFirmado(args: { id: string; status: string; montoCentavos: number; timestamp: number }) {
  const cadena = `${args.id}${args.status}${args.montoCentavos}${args.timestamp}${SECRETO_EVENTOS}`;
  return {
    event: "transaction.updated",
    data: {
      transaction: {
        id: args.id,
        status: args.status,
        amount_in_cents: args.montoCentavos,
        reference: "SRC-abc123-x-deadbeef",
      },
    },
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum: createHash("sha256").update(cadena).digest("hex"),
    },
    timestamp: args.timestamp,
  };
}

const valido = eventoFirmado({
  id: "1234-1610641025-49201",
  status: "APPROVED",
  montoCentavos: 4490000,
  timestamp: 1530291411,
});
comprobar("un evento bien firmado se acepta", eventoEsAutentico(valido));

// Manipular el monto sin recalcular la firma debe rechazarse. Este es el ataque
// concreto: «pagué $1.000, acredítame el plan Empresa».
const montoAlterado = JSON.parse(JSON.stringify(valido));
montoAlterado.data.transaction.amount_in_cents = 100;
comprobar("alterar el monto invalida la firma", !eventoEsAutentico(montoAlterado));

const estadoAlterado = JSON.parse(JSON.stringify(valido));
estadoAlterado.data.transaction.status = "APPROVED_FAKE";
comprobar("alterar el estado invalida la firma", !eventoEsAutentico(estadoAlterado));

const tiempoAlterado = JSON.parse(JSON.stringify(valido));
tiempoAlterado.timestamp = 1530291412;
comprobar("alterar el timestamp invalida la firma", !eventoEsAutentico(tiempoAlterado));

comprobar(
  "un evento sin firma se rechaza",
  !eventoEsAutentico({ event: "transaction.updated", data: {}, timestamp: 1 })
);
comprobar(
  "un evento con checksum vacío se rechaza",
  !eventoEsAutentico({
    ...valido,
    signature: { properties: ["transaction.id"], checksum: "" },
  })
);

// Mayúsculas/minúsculas: la documentación muestra el checksum en mayúscula y el
// hash se calcula en minúscula. La comparación no puede depender de eso.
const enMayuscula = JSON.parse(JSON.stringify(valido));
enMayuscula.signature.checksum = valido.signature.checksum.toUpperCase();
comprobar("el checksum en MAYÚSCULA también se acepta", eventoEsAutentico(enMayuscula));

// Sin secreto configurado NO se puede validar nada: debe fallar cerrado.
const secretoGuardado = process.env.WOMPI_EVENTS_SECRET;
delete process.env.WOMPI_EVENTS_SECRET;
comprobar("sin WOMPI_EVENTS_SECRET, ningún evento se acepta", !eventoEsAutentico(valido));
process.env.WOMPI_EVENTS_SECRET = secretoGuardado;

// ─── 3. Planes y límites ────────────────────────────────────────────────────
seccion("3) Planes y topes de obras");

comprobar("PERSONAL no cuesta nada", PLANES.PERSONAL.precioCentavos === 0);
comprobar("OBRA cuesta $650.000", PLANES.OBRA.precioCentavos === 650_000_00);
comprobar("PROYECTO cuesta $1.500.000", PLANES.PROYECTO.precioCentavos === 1_500_000_00);
comprobar("EMPRESA cuesta $3.500.000", PLANES.EMPRESA.precioCentavos === 3_500_000_00);

comprobar("propietario gratis: 1 obra", limiteObrasActivas("PERSONAL", "PROPIETARIO") === 1);
comprobar("contratista gratis: 2 obras", limiteObrasActivas("PERSONAL", "CONTRATISTA") === 2);
comprobar("plan OBRA: 1 obra", limiteObrasActivas("OBRA", "CONSTRUCTORA") === 1);
comprobar("plan PROYECTO: 5 obras", limiteObrasActivas("PROYECTO", "CONSTRUCTORA") === 5);
comprobar("plan EMPRESA: 15 obras", limiteObrasActivas("EMPRESA", "CONSTRUCTORA") === 15);
// La regresión concreta que motivó este módulo:
comprobar(
  "ningún plan de pago queda con obras ilimitadas (el bug que había)",
  [limiteObrasActivas("OBRA", "CONSTRUCTORA"), limiteObrasActivas("PROYECTO", "CONSTRUCTORA"), limiteObrasActivas("EMPRESA", "CONSTRUCTORA")].every(
    (n) => Number.isFinite(n)
  )
);

comprobar("12 meses de PROYECTO = 12 veces el mensual", precioTotalCentavos("PROYECTO", 12) === 1_500_000_00 * 12);

// ─── 3b. Precios de prueba ──────────────────────────────────────────────────
// Sirven para verificar el cobro real con montos simbólicos. Lo que se prueba
// aquí es sobre todo que estén APAGADOS por defecto y que no puedan quedarse
// encendidos sin que se note: mientras lo estén, alguien puede comprar el plan
// Empresa por mil pesos.
seccion("3b) Precios de prueba");

const pruebaGuardada = process.env.PRECIOS_PRUEBA;
const correosGuardados = process.env.PRECIOS_PRUEBA_CORREOS;
delete process.env.PRECIOS_PRUEBA;
delete process.env.PRECIOS_PRUEBA_CORREOS;

comprobar("apagados por defecto", !preciosDePruebaActivos("quien@sea.com"));
comprobar(
  "apagados, se cobra el precio real",
  precioTotalCentavos("EMPRESA", 1, "quien@sea.com") === 3_500_000_00
);

process.env.PRECIOS_PRUEBA = "true";
comprobar("OBRA de prueba cuesta $1.000", precioTotalCentavos("OBRA", 1) === 1_000_00);
comprobar("PROYECTO de prueba cuesta $2.000", precioTotalCentavos("PROYECTO", 1) === 2_000_00);
comprobar("EMPRESA de prueba cuesta $3.000", precioTotalCentavos("EMPRESA", 1) === 3_000_00);
comprobar(
  "el tope de $5.000 corta los períodos largos",
  precioTotalCentavos("EMPRESA", 12) === TOPE_PRUEBA_CENTAVOS
);
comprobar(
  "ningún cobro de prueba supera el tope",
  (["OBRA", "PROYECTO", "EMPRESA"] as const).every((plan) =>
    [1, 6, 12].every((meses) => precioTotalCentavos(plan, meses) <= TOPE_PRUEBA_CENTAVOS)
  )
);

// Acotados por correo: es la diferencia entre una prueba y una liquidación.
process.env.PRECIOS_PRUEBA_CORREOS = "yo@seiricon.com, otro@seiricon.com";
comprobar("con lista, el correo listado paga precio de prueba", precioTotalCentavos("EMPRESA", 1, "yo@seiricon.com") === 3_000_00);
comprobar("la lista no distingue mayúsculas", preciosDePruebaActivos("YO@SEIRICON.COM"));
comprobar(
  "con lista, un cliente cualquiera sigue pagando el precio REAL",
  precioTotalCentavos("EMPRESA", 1, "cliente@constructora.com") === 3_500_000_00
);
comprobar("con lista, sin correo no hay precio de prueba", !preciosDePruebaActivos(null));

// Los precios reales no se tocan nunca: el modo prueba los sustituye al vuelo.
comprobar("los precios de PLANES siguen intactos", PLANES.EMPRESA.precioCentavos === 3_500_000_00);

if (pruebaGuardada === undefined) delete process.env.PRECIOS_PRUEBA;
else process.env.PRECIOS_PRUEBA = pruebaGuardada;
if (correosGuardados === undefined) delete process.env.PRECIOS_PRUEBA_CORREOS;
else process.env.PRECIOS_PRUEBA_CORREOS = correosGuardados;

// ─── 4. Vigencia ────────────────────────────────────────────────────────────
seccion("4) Vigencia de la suscripción");

const HOY = new Date("2026-08-15T12:00:00Z");
const enDias = (n: number) => new Date(HOY.getTime() + n * 86_400_000);

comprobar(
  "PERSONAL nunca vence",
  estadoDeAcceso({ plan_suscripcion: "PERSONAL", estado_suscripcion: "VENCIDA", suscripcion_vence_el: enDias(-100) }, HOY).permite
);
comprobar(
  "prueba vigente permite usar",
  estadoDeAcceso({ plan_suscripcion: "PROYECTO", estado_suscripcion: "PRUEBA", suscripcion_vence_el: enDias(10) }, HOY).permite
);
comprobar(
  "prueba vencida NO permite usar",
  !estadoDeAcceso({ plan_suscripcion: "PROYECTO", estado_suscripcion: "PRUEBA", suscripcion_vence_el: enDias(-1) }, HOY).permite
);
comprobar(
  "activa pero vencida NO permite (manda la fecha, no el estado)",
  !estadoDeAcceso({ plan_suscripcion: "EMPRESA", estado_suscripcion: "ACTIVA", suscripcion_vence_el: enDias(-1) }, HOY).permite
);
comprobar(
  "cancelada sigue valiendo hasta que venza (ya la pagó)",
  estadoDeAcceso({ plan_suscripcion: "OBRA", estado_suscripcion: "CANCELADA", suscripcion_vence_el: enDias(5) }, HOY).permite
);
comprobar(
  "sin fecha y ACTIVA permite (cuentas de cortesía)",
  estadoDeAcceso({ plan_suscripcion: "EMPRESA", estado_suscripcion: "ACTIVA", suscripcion_vence_el: null }, HOY).permite
);
comprobar(
  "sin fecha y VENCIDA no permite",
  !estadoDeAcceso({ plan_suscripcion: "EMPRESA", estado_suscripcion: "VENCIDA", suscripcion_vence_el: null }, HOY).permite
);
comprobar(
  "avisa cuando faltan 3 días o menos",
  estadoDeAcceso({ plan_suscripcion: "OBRA", estado_suscripcion: "PRUEBA", suscripcion_vence_el: enDias(2) }, HOY).porVencer
);
comprobar(
  "no avisa cuando faltan 10 días",
  !estadoDeAcceso({ plan_suscripcion: "OBRA", estado_suscripcion: "PRUEBA", suscripcion_vence_el: enDias(10) }, HOY).porVencer
);

const prueba = finDePrueba(HOY);
comprobar(
  "la prueba dura 14 días",
  Math.round((prueba.getTime() - HOY.getTime()) / 86_400_000) === 14
);

// Encadenado: renovar antes de tiempo no debe quemar los días que quedaban.
const vencia = enDias(10);
const tras = extenderVigencia(vencia, 1, HOY);
comprobar(
  "renovar antes de tiempo encadena el período (no pierde días)",
  tras > vencia && tras.getMonth() === new Date(vencia).getMonth() + 1
);
const trasVencida = extenderVigencia(enDias(-5), 1, HOY);
comprobar(
  "si ya venció, el período nuevo arranca hoy",
  trasVencida > HOY && Math.abs(trasVencida.getTime() - new Date(HOY).setMonth(HOY.getMonth() + 1)) < 1000
);

// ─── Resultado ──────────────────────────────────────────────────────────────
console.log(`\n${ok}/${ok + fallos} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} FALLARON — no desplegar cobros con esto en rojo.`);
  process.exit(1);
}
console.log("Módulo de pagos y suscripciones verificado sin errores.");
