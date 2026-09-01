// ─────────────────────────────────────────────────────────────────────────
// Verificación de los AVISOS DE VENCIMIENTO (`src/lib/pagos/avisos.ts`).
//
// No hay test runner en el proyecto — este script ES la suite, en asserts
// planos, igual que `verificar-pagos.ts`.
//
// Qué verifica:
//   1. Se avisa EXACTAMENTE en los umbrales (7, 3, 1, 0) y en ningún otro día.
//      Es lo que hace idempotente al aviso sin columna en la base: con una
//      ejecución diaria, cada cuenta cruza cada umbral una sola vez.
//   2. A las cuentas que NO vencen no se les avisa: plan gratuito y cuentas de
//      cortesía sin fecha. Avisar de un vencimiento inexistente es peor que no
//      avisar.
//   3. El tono se decide bien: `vencido` solo a partir del día 0.
//   4. La función es pura respecto del reloj: el mismo dato con distinto `ahora`
//      da distinto resultado, y con el mismo `ahora` siempre el mismo.
//
// Uso: `npx tsx scripts/verificar-avisos.ts`. Sale con 1 si algo falla.
// ─────────────────────────────────────────────────────────────────────────
import { avisoPara, avisosDeHoy, UMBRALES_AVISO, type CuentaParaAviso } from "@/lib/pagos/avisos";

let total = 0;
let fallos = 0;

function verificar(descripcion: string, condicion: boolean) {
  total++;
  if (condicion) console.log(`  OK   ${descripcion}`);
  else {
    fallos++;
    console.error(`  FAIL ${descripcion}`);
  }
}

const AHORA = new Date("2026-09-01T12:00:00.000Z");
const DIA = 86_400_000;

/** Una cuenta de pago que vence dentro de `dias` días exactos. */
function cuentaQueVenceEn(dias: number, id = "c1"): CuentaParaAviso {
  return {
    constructora_id: id,
    plan_suscripcion: "PROYECTO",
    estado_suscripcion: "ACTIVA",
    // Exactamente `dias` días, sin sumar milisegundos de más: `diasRestantes`
    // es `Math.ceil(ms / DIA)`, así que un solo milisegundo extra sube el techo
    // al día siguiente y la cuenta cruzaría el umbral equivocado.
    suscripcion_vence_el: new Date(AHORA.getTime() + dias * DIA),
  };
}

console.log("Avisos de vencimiento — verificación\n");

// ─────────────────────────────────────────────────────────────────────────
console.log("1. Se avisa SOLO en los umbrales");

for (const umbral of UMBRALES_AVISO) {
  const aviso = avisoPara(cuentaQueVenceEn(umbral), AHORA);
  verificar(`avisa cuando faltan ${umbral} días`, aviso !== null);
  verificar(`y reporta ${umbral} días restantes`, aviso?.diasRestantes === umbral);
}

// Los días que NO son umbral. Si esto fallara, la persona recibiría el mismo
// correo varios días seguidos y aprendería a ignorarlo.
for (const dia of [10, 9, 8, 6, 5, 4, 2]) {
  verificar(
    `NO avisa cuando faltan ${dia} días`,
    avisoPara(cuentaQueVenceEn(dia), AHORA) === null,
  );
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\n2. A quien no vence, no se le avisa");

verificar(
  "el plan gratuito no recibe aviso (no vence: su límite es por obras)",
  avisoPara(
    { ...cuentaQueVenceEn(1), plan_suscripcion: "PERSONAL" },
    AHORA,
  ) === null,
);

verificar(
  "una cuenta sin fecha de vencimiento no recibe aviso (cortesía o socio)",
  avisoPara(
    { constructora_id: "c2", plan_suscripcion: "PROYECTO", estado_suscripcion: "ACTIVA", suscripcion_vence_el: null },
    AHORA,
  ) === null,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n3. El tono: solo se dice «venció» cuando venció");

verificar("faltando 7 días NO se marca como vencido", avisoPara(cuentaQueVenceEn(7), AHORA)?.vencido === false);
verificar("faltando 1 día NO se marca como vencido", avisoPara(cuentaQueVenceEn(1), AHORA)?.vencido === false);
verificar("el día 0 SÍ se marca como vencido", avisoPara(cuentaQueVenceEn(0), AHORA)?.vencido === true);

// ─────────────────────────────────────────────────────────────────────────
console.log("\n4. En lote, y estable");

const lote: CuentaParaAviso[] = [
  cuentaQueVenceEn(7, "a"),
  cuentaQueVenceEn(5, "b"), // no toca
  cuentaQueVenceEn(3, "c"),
  cuentaQueVenceEn(0, "d"),
  { ...cuentaQueVenceEn(1, "e"), plan_suscripcion: "PERSONAL" }, // no toca
];
const hoy = avisosDeHoy(lote, AHORA);
verificar("de 5 cuentas, avisa a las 3 que tocan", hoy.length === 3);
verificar(
  "y son exactamente esas tres",
  hoy.map((a) => a.constructora_id).sort().join(",") === "a,c,d",
);

const otraVez = avisosDeHoy(lote, AHORA);
verificar(
  "con el mismo `ahora` da el mismo resultado (es pura)",
  JSON.stringify(hoy) === JSON.stringify(otraVez),
);

verificar(
  "al día siguiente ya no le toca a la que avisamos hoy",
  avisoPara(cuentaQueVenceEn(7, "a"), new Date(AHORA.getTime() + DIA))?.diasRestantes !== 7,
);

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Avisos de vencimiento verificados sin errores.");
