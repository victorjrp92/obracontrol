/**
 * ¿La pasarela quedó bien montada EN PRODUCCIÓN?
 *
 * A diferencia de `verificar-pagos.ts` —que comprueba las firmas y la vigencia
 * en frío, sin red— este script mira el sitio desplegado desde fuera, igual que
 * lo haría Wompi. Existe porque los fallos de una integración de cobros casi
 * nunca están en la lógica: están en la configuración, y no se ven hasta que un
 * cliente paga y no se le acredita.
 *
 * Uso:
 *   npm run verify:pasarela
 *   npm run verify:pasarela -- --sitio https://mi-preview.vercel.app
 *
 * NO manda dinero, no crea cobros y no toca la base: solo hace peticiones que
 * el propio código está diseñado para rechazar.
 *
 * Lo que este script NO puede ver, y hay que comprobar a mano:
 *   - Si las cuatro llaves están cargadas. No hay endpoint que lo diga (y no
 *     debe haberlo). Se ve entrando a Configuración › Plan: si aparece el botón
 *     de pagar, están las cuatro.
 *   - Si la URL de eventos está registrada en el panel de Wompi. Eso vive del
 *     lado de Wompi, no del nuestro.
 */

const SITIO_POR_DEFECTO = "https://seiricon.com";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

let ok = 0;
let fallos = 0;
let avisos = 0;

function comprobar(nombre: string, condicion: boolean, detalle?: string) {
  if (condicion) {
    ok++;
    console.log(`  OK    ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  }
}

function avisar(texto: string) {
  avisos++;
  console.log(`  AVISO ${texto}`);
}

function seccion(titulo: string) {
  console.log(`\n${titulo}`);
}

async function main() {
  const sitio = (arg("sitio") ?? process.env.NEXT_PUBLIC_SITE_URL ?? SITIO_POR_DEFECTO).replace(/\/$/, "");

  console.log(`Verificando la pasarela en ${sitio}`);
  if (!sitio.startsWith("https://")) {
    avisar("el sitio no es HTTPS: Wompi no entrega eventos a un destino sin TLS");
  }

  // ── 1. ¿El sitio está en pie? ─────────────────────────────────────────────
  seccion("1) El sitio responde");

  let raiz: Response | null = null;
  try {
    raiz = await fetch(sitio, { redirect: "follow" });
  } catch (e) {
    comprobar("la portada responde", false, e instanceof Error ? e.message : "sin respuesta");
  }
  if (raiz) {
    comprobar("la portada responde 200", raiz.status === 200, `HTTP ${raiz.status}`);
    // No es un requisito de la pasarela, pero si HSTS falta es que el despliegue
    // no está aplicando next.config.ts, y eso sí afecta a todo lo demás.
    if (!raiz.headers.get("strict-transport-security")) {
      avisar("sin cabecera HSTS: revisa que el despliegue esté usando next.config.ts");
    }
  }

  // ── 2. La sonda de salud ──────────────────────────────────────────────────
  seccion("2) Salud del backend y de la base");

  try {
    const salud = await fetch(`${sitio}/api/salud`, { cache: "no-store" });
    const cuerpo = await salud.text();
    comprobar(
      "/api/salud responde 200",
      salud.status === 200,
      `HTTP ${salud.status} ${cuerpo.slice(0, 200)}`
    );
    if (salud.status === 503) {
      avisar("503 suele significar que falta aplicar una migración: npm run db:migrate-deploy");
    }
  } catch (e) {
    comprobar("/api/salud responde", false, e instanceof Error ? e.message : "sin respuesta");
  }

  // ── 3. El webhook: la ruta más importante de todas ────────────────────────
  seccion("3) Webhook de Wompi accesible y cerrado a lo no firmado");

  // Un cuerpo vacío no lleva firma, así que el código DEBE rechazarlo sin
  // acreditar nada — y responder 200 para que Wompi no reintente en bucle algo
  // que nunca vamos a aceptar. Aquí se comprueban las dos cosas a la vez:
  // que la ruta existe y es alcanzable desde internet, y que no acredita.
  try {
    const res = await fetch(`${sitio}/api/pagos/wompi/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    const cuerpo = await res.text();

    if (res.status === 404) {
      comprobar("el webhook está desplegado", false, "404: la ruta no existe en este despliegue");
    } else if (res.status === 401 || res.status === 403 || res.status === 307 || res.status === 302) {
      comprobar(
        "el webhook es alcanzable sin sesión",
        false,
        `HTTP ${res.status}: algo lo está protegiendo (middleware o Deployment Protection de Vercel). Wompi no tiene sesión: nunca podrá acreditar un pago`
      );
    } else {
      comprobar("el webhook responde", res.status === 200, `HTTP ${res.status}`);
      comprobar(
        "rechaza un evento sin firma",
        cuerpo.includes("firma") || cuerpo.includes("ignorado"),
        `respondió ${cuerpo.slice(0, 200)}`
      );
      avisar(
        "un evento sin firma también se rechaza cuando falta WOMPI_EVENTS_SECRET: " +
          "esto prueba que la ruta está viva, no que el secreto esté cargado"
      );
    }
  } catch (e) {
    comprobar("el webhook responde", false, e instanceof Error ? e.message : "sin respuesta");
  }

  // ── 4. El checkout no regala planes ───────────────────────────────────────
  seccion("4) El checkout exige sesión");

  try {
    const res = await fetch(`${sitio}/api/pagos/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "EMPRESA", periodoMeses: 12 }),
      cache: "no-store",
    });

    comprobar(
      "sin sesión NO devuelve una URL de pago",
      res.status !== 200,
      `HTTP ${res.status}: una respuesta 200 aquí sería un cobro creado por un anónimo`
    );
    if (res.status === 503) {
      avisar("503 = faltan llaves de Wompi en este entorno; el cobro está apagado");
    }
  } catch (e) {
    comprobar("/api/pagos/checkout responde", false, e instanceof Error ? e.message : "sin respuesta");
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  console.log(`\n${ok}/${ok + fallos} verificaciones OK${avisos ? `, ${avisos} aviso(s)` : ""}`);
  if (fallos > 0) {
    console.error(`${fallos} FALLARON — no anuncies el cobro con esto en rojo.`);
    process.exit(1);
  }
  console.log("La pasarela está montada y accesible. Falta la prueba con un pago real.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
