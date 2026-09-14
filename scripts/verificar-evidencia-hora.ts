// ---------------------------------------------------------------------------
// Verificacion de `evidencia-hora.ts`: quien fecha una evidencia.
//
// La regla del modulo es corta y tiene una parte contraintuitiva que conviene
// dejar fijada aqui, porque alguien va a querer "endurecerla" y volveria a
// romper lo mismo:
//
//   EL RELOJ NO RECHAZA NUNCA UN REPORTE.
//
// Se probo lo contrario -copiar la ventana de 15 minutos del acta del
// arquitecto- y el incentivo salia del reves: el que falsifica manda "ahora" y
// pasa, mientras el contratista honesto que tarda dieciseis minutos entre la
// primera foto y el envio -video, notas, checklist- se quedaba sin reportar. Lo
// que cierra el fraude no es juzgar la hora ajena: es dejar de guardarla.
//
// Cada bloque lleva control positivo: no basta comprobar que sale el numero
// bueno, hay que construir el caso donde saldria el malo y ver que se
// distingue.
// ---------------------------------------------------------------------------
import { resolverHoraDeCaptura, MARGEN_DIFERIDO_MS } from "@/lib/evidencia-hora";

let total = 0;
let fallos = 0;
function verificar(d: string, c: boolean) {
  total++;
  if (c) console.log(`  OK   ${d}`);
  else { fallos++; console.error(`  FAIL ${d}`); }
}

const MIN = 60_000;
const AHORA = new Date("2026-09-14T15:00:00.000Z");
const hace = (ms: number) => new Date(AHORA.getTime() - ms).toISOString();
const dentro = (ms: number) => new Date(AHORA.getTime() + ms).toISOString();

console.log("Hora de captura de evidencias - verificacion\n");

{
  console.log("1. En vivo: manda el servidor, pase lo que pase");
  const casos: [string, string | undefined][] = [
    ["hora normal, de hace un minuto", hace(MIN)],
    ["tardo 40 minutos en enviar el reporte", hace(40 * MIN)],
    ["reloj del movil adelantado media hora", dentro(30 * MIN)],
    ["reloj del movil en 1990", "1990-01-01T00:00:00.000Z"],
    ["texto que no es una fecha", "no soy una fecha"],
    ["sin hora ninguna", undefined],
  ];
  for (const [nombre, declarada] of casos) {
    const r = resolverHoraDeCaptura({ declarada, ahora: AHORA });
    verificar(`${nombre}: se acepta y se guarda la del servidor`,
      r.ok && r.horaCaptura.getTime() === AHORA.getTime() && r.verificadaPorServidor);
  }
  // CONTROL POSITIVO: si el modulo guardara la hora declarada, los casos de
  // arriba pasarian igual salvo este. Aqui se ve la diferencia.
  const r = resolverHoraDeCaptura({ declarada: hace(40 * MIN), ahora: AHORA });
  verificar("control: NO se guarda la hora declarada (40 min != 0 min)",
    r.ok && r.horaCaptura.getTime() !== new Date(hace(40 * MIN)).getTime());
}

{
  console.log("\n2. Diferida: se conserva su instante, marcada como no verificada");
  const seisHoras = hace(6 * 60 * MIN);
  const r = resolverHoraDeCaptura({ declarada: seisHoras, ahora: AHORA, diferida: true });
  verificar("el maestro del sotano SI puede subir seis horas despues", r.ok);
  verificar("se guarda la hora de la captura, no la de la subida",
    r.ok && r.horaCaptura.toISOString() === seisHoras);
  verificar("queda marcada como NO verificada por el servidor",
    r.ok && !r.verificadaPorServidor && r.diferida);

  // CONTROL POSITIVO: la misma hora sin la marca de cola se fecha ahora y SI
  // cuenta como verificada. Si los dos casos dieran lo mismo, la marca no
  // estaria haciendo nada.
  const vivo = resolverHoraDeCaptura({ declarada: seisHoras, ahora: AHORA });
  verificar("control: sin la marca, esa misma hora se fecha ahora y SI se verifica",
    vivo.ok && vivo.horaCaptura.getTime() === AHORA.getTime() && vivo.verificadaPorServidor);
}

{
  console.log("\n3. Diferida con una hora que no sirve: cae al servidor, pero no se rechaza");
  const malas: [string, string | undefined][] = [
    ["del futuro", dentro(30 * MIN)],
    ["mas vieja que el tope de la cola", hace(MARGEN_DIFERIDO_MS + 60 * MIN)],
    ["ilegible", "@@@"],
    ["ausente", undefined],
  ];
  for (const [nombre, declarada] of malas) {
    const r = resolverHoraDeCaptura({ declarada, ahora: AHORA, diferida: true });
    verificar(`${nombre}: se acepta igual, fechada por el servidor y sin verificar`,
      r.ok && r.horaCaptura.getTime() === AHORA.getTime() && !r.verificadaPorServidor);
  }
}

{
  console.log("\n4. La regla que no se puede perder");
  // Barrido: ninguna entrada, por rara que sea, puede tumbar un reporte.
  const entradas: (string | undefined)[] = [
    undefined, "", "   ", "0", "no", "1990-01-01T00:00:00.000Z",
    "2999-12-31T23:59:59.000Z", AHORA.toISOString(), hace(365 * 24 * 60 * MIN),
  ];
  let todas = true;
  for (const declarada of entradas) {
    for (const diferida of [false, true]) {
      if (!resolverHoraDeCaptura({ declarada, ahora: AHORA, diferida }).ok) todas = false;
    }
  }
  verificar(`ninguna de ${entradas.length * 2} entradas rechaza el reporte`, todas);

  // El reloj del servidor roto no puede dejar la app sin reportar.
  const r = resolverHoraDeCaptura({ declarada: hace(MIN), ahora: new Date(NaN) });
  verificar("con el reloj de referencia roto sigue aceptando", r.ok);
}

{
  console.log("\n5. El limite exacto del tope de la cola");
  const justoDentro = resolverHoraDeCaptura({
    declarada: hace(MARGEN_DIFERIDO_MS - MIN), ahora: AHORA, diferida: true });
  verificar("justo dentro del tope conserva su hora",
    justoDentro.ok && justoDentro.horaCaptura.getTime() < AHORA.getTime());
  const justoFuera = resolverHoraDeCaptura({
    declarada: hace(MARGEN_DIFERIDO_MS + MIN), ahora: AHORA, diferida: true });
  verificar("justo fuera cae al reloj del servidor",
    justoFuera.ok && justoFuera.horaCaptura.getTime() === AHORA.getTime());
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) { console.error(`${fallos} fallaron.`); process.exit(1); }
console.log("Hora de captura de evidencias verificada sin errores.");
