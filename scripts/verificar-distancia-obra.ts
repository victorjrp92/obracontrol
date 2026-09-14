// ---------------------------------------------------------------------------
// Verificación de `src/lib/distancia-obra.ts`: la distancia entre la foto y el
// punto de la obra, que es lo que convierte un par de coordenadas en la
// respuesta a «¿esta foto se tomó en el apartamento 301 o en la casa del
// contratista?».
//
// Lo que este módulo puede romper sin que se note es que TODO error de
// geometría produce un número perfectamente plausible. Nadie mira «412 m» y
// piensa «eso está mal»: se lee como un dato. Los tres fallos que salen
// creíbles y son falsos:
//
//   · Intercambiar latitud y longitud. Sigue dando cientos de kilómetros entre
//     Cali y Bogotá, solo que los equivocados.
//   · Olvidar el factor cos(lat). La fórmula sigue funcionando en el ecuador y
//     miente cada vez más cuanto más al norte o al sur.
//   · Devolver 0 cuando falta el dato. Un 0 no se lee como «no sé»: se lee como
//     «estaba exactamente en la obra», que es lo contrario.
//
// Por eso CADA bloque lleva CONTROL POSITIVO: no basta comprobar que el caso
// bueno da bien, hay que construir el caso donde el error SÍ aparecería y
// comprobar que la verificación lo distingue. Una comprobación que pasa con la
// fórmula rota no comprueba nada.
// ---------------------------------------------------------------------------

import {
  coordenadaValida,
  distanciaMetros,
  formatearDistancia,
  fueraDeRadio,
  poligonoCirculo,
  radioValido,
  RADIO_OBRA_METROS_DEFECTO,
  RADIOS_OBRA_METROS,
  type Coordenada,
} from "@/lib/distancia-obra";

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

/** Metros por grado de latitud con el radio del módulo: (π · 6.371.008,8) / 180. */
const M_POR_GRADO_LAT = (Math.PI * 6_371_008.8) / 180;

const CALI: Coordenada = { lat: 3.4516, lng: -76.532 };
const BOGOTA: Coordenada = { lat: 4.711, lng: -74.0721 };

console.log("Distancia a la obra - verificacion\n");

// ---------------------------------------------------------------------------
console.log("1. Dos puntos identicos dan 0 exacto, no un residuo");
{
  const d = distanciaMetros(CALI, { ...CALI });
  verificar(`Cali contra Cali da 0 (${d} m)`, d === 0);

  // CONTROL POSITIVO: mover el punto un metro escaso ya NO puede dar 0. Sin
  // esto, una funcion que devolviera 0 siempre pasaria el caso de arriba.
  const unMetroAlNorte = { lat: CALI.lat + 1 / M_POR_GRADO_LAT, lng: CALI.lng };
  const dCorto = distanciaMetros(CALI, unMetroAlNorte);
  verificar(
    `CONTROL: un metro al norte NO da 0 (${dCorto?.toFixed(3)} m)`,
    dCorto !== null && dCorto > 0.9 && dCorto < 1.1,
  );
}

// ---------------------------------------------------------------------------
console.log("\n2. Una distancia conocida de verdad: Cali - Bogota son unos 300 km");
{
  const d = distanciaMetros(CALI, BOGOTA);
  console.log(`     Cali -> Bogota: ${(d! / 1000).toFixed(1)} km`);
  verificar(
    `entre 290 y 320 km (${(d! / 1000).toFixed(1)} km)`,
    d !== null && d > 290_000 && d < 320_000,
  );

  // La distancia no puede depender del orden de los argumentos.
  const inverso = distanciaMetros(BOGOTA, CALI);
  verificar(`es simetrica: d(A,B) === d(B,A)`, d === inverso);
}

// ---------------------------------------------------------------------------
console.log("\n3. CONTROL POSITIVO del anterior: con lat y lng intercambiados a proposito");
{
  // Los MISMOS cuatro numeros, cruzados. Es el error clasico y el resultado
  // sigue siendo un numero de cientos de kilometros, o sea perfectamente
  // creible; lo unico que lo delata es compararlo con el bueno.
  const caliCruzada: Coordenada = { lat: CALI.lng, lng: CALI.lat };
  const bogotaCruzada: Coordenada = { lat: BOGOTA.lng, lng: BOGOTA.lat };

  const bueno = distanciaMetros(CALI, BOGOTA)!;
  const cruzado = distanciaMetros(caliCruzada, bogotaCruzada)!;
  console.log(`     bueno: ${(bueno / 1000).toFixed(1)} km | cruzado: ${(cruzado / 1000).toFixed(1)} km`);

  // Si la formula ignorara cos(lat), los dos numeros saldrian IDENTICOS: los
  // catetos serian los mismos, solo que cambiados de eje. Que difieran en
  // decenas de kilometros es la prueba de que los ejes no son intercambiables.
  verificar(
    `cruzar los ejes cambia el resultado en mas de 25 km (${((bueno - cruzado) / 1000).toFixed(1)} km de diferencia)`,
    Math.abs(bueno - cruzado) > 25_000,
  );
}

// ---------------------------------------------------------------------------
console.log("\n4. CONTROL POSITIVO afilado: un grado de longitud vale la mitad a 60 de latitud");
{
  // El control de arriba delata el cruce de ejes, pero Cali y Bogota estan casi
  // en el ecuador y ahi cos(lat) ~ 1, asi que la diferencia es del 10%. Este
  // caso lo pone en evidencia al 100%: el mismo grado de longitud, medido en el
  // ecuador y a 60 grados de latitud, tiene que valer exactamente la mitad.
  const ecuador = distanciaMetros({ lat: 0, lng: 0.5 }, { lat: 0, lng: 1.5 })!;
  const lat60 = distanciaMetros({ lat: 60, lng: 0.5 }, { lat: 60, lng: 1.5 })!;
  console.log(`     1 grado de lng en el ecuador: ${(ecuador / 1000).toFixed(1)} km | a 60 lat: ${(lat60 / 1000).toFixed(1)} km`);

  verificar(`en el ecuador un grado de longitud son ~111,2 km`, Math.abs(ecuador - 111_195) < 200);
  verificar(
    `a 60 de latitud vale la MITAD (razon ${(lat60 / ecuador).toFixed(3)}, esperada ~0,500)`,
    Math.abs(lat60 / ecuador - 0.5) < 0.01,
  );

  // Y un grado de LATITUD vale lo mismo en cualquier parte: es lo que distingue
  // los dos ejes.
  // Ojo con el punto de partida: (0,0) esta descartado a proposito por el
  // modulo (es el golfo de Guinea, donde aterriza todo parseo fallido), asi que
  // medir desde ahi devolveria null y este control pasaria a medir nada. Se
  // toma el grado de latitud sobre el meridiano 30.
  const gradoLatEcuador = distanciaMetros({ lat: -0.5, lng: 30 }, { lat: 0.5, lng: 30 })!;
  const gradoLat60 = distanciaMetros({ lat: 59.5, lng: 30 }, { lat: 60.5, lng: 30 })!;
  verificar(
    `un grado de latitud mide igual en el ecuador y en 60 (${(gradoLatEcuador / 1000).toFixed(1)} vs ${(gradoLat60 / 1000).toFixed(1)} km)`,
    Math.abs(gradoLatEcuador - gradoLat60) < 1,
  );
}

// ---------------------------------------------------------------------------
console.log("\n5. Distancias cortas en Cali, que es el caso real de una obra");
{
  const cincuentaAlNorte: Coordenada = { lat: CALI.lat + 50 / M_POR_GRADO_LAT, lng: CALI.lng };
  const d50 = distanciaMetros(CALI, cincuentaAlNorte)!;
  console.log(`     50 m al norte: ${d50.toFixed(2)} m`);
  verificar(`50 m al norte con error < 1 m (${d50.toFixed(2)} m)`, Math.abs(d50 - 50) < 1);

  const gradoLngEnCali = M_POR_GRADO_LAT * Math.cos((CALI.lat * Math.PI) / 180);
  const quinientosAlEste: Coordenada = { lat: CALI.lat, lng: CALI.lng + 500 / gradoLngEnCali };
  const d500 = distanciaMetros(CALI, quinientosAlEste)!;
  console.log(`     500 m al este: ${d500.toFixed(2)} m`);
  verificar(`500 m al este con error < 1 m (${d500.toFixed(2)} m)`, Math.abs(d500 - 500) < 1);

  // CONTROL POSITIVO: 50 m y 500 m tienen que distinguirse. Una formula que se
  // comiera el factor de escala daria los dos «bien» dentro de una tolerancia
  // laxa; aqui el cociente tiene que ser 10.
  verificar(`CONTROL: los 500 m son 10 veces los 50 m (razon ${(d500 / d50).toFixed(3)})`, Math.abs(d500 / d50 - 10) < 0.05);

  // Y el mismo desplazamiento aplicado al otro eje NO puede dar lo mismo en
  // grados: 500 m al este son mas grados que 500 m al norte en esta latitud.
  const quinientosAlNorte: Coordenada = { lat: CALI.lat + 500 / M_POR_GRADO_LAT, lng: CALI.lng };
  const d500n = distanciaMetros(CALI, quinientosAlNorte)!;
  verificar(`500 m al norte tambien dan 500 m (${d500n.toFixed(2)} m)`, Math.abs(d500n - 500) < 1);
}

// ---------------------------------------------------------------------------
console.log("\n6. Coordenadas nulas o no finitas devuelven null, nunca 0 ni NaN");
{
  const casos: Array<[string, Coordenada | null | undefined]> = [
    ["null", null],
    ["undefined", undefined],
    ["lat NaN", { lat: NaN, lng: -76.5 }],
    ["lng NaN", { lat: 3.45, lng: NaN }],
    ["lat Infinity", { lat: Infinity, lng: -76.5 }],
    ["lng -Infinity", { lat: 3.45, lng: -Infinity }],
    ["lat fuera de rango (120)", { lat: 120, lng: -76.5 }],
    ["lng fuera de rango (-200)", { lat: 3.45, lng: -200 }],
    ["(0,0) golfo de Guinea", { lat: 0, lng: 0 }],
  ];
  for (const [nombre, c] of casos) {
    const d = distanciaMetros(CALI, c);
    verificar(`${nombre} -> null (no 0, no NaN)`, d === null);
  }
  verificar(`la obra sin ubicar tambien da null`, distanciaMetros(null, CALI) === null);

  // CONTROL POSITIVO: la MISMA llamada con coordenadas buenas SI devuelve un
  // numero. Si esto fallara, el null de arriba no probaria nada: podria estar
  // devolviendo null siempre.
  verificar(`CONTROL: con dos coordenadas buenas devuelve numero`, typeof distanciaMetros(CALI, BOGOTA) === "number");

  // Y un 0 devuelto por error se distinguiria de un null: son valores distintos.
  verificar(`CONTROL: null no es 0 (null == 0 seria el bug)`, (distanciaMetros(CALI, null) as unknown) !== 0);
}

// ---------------------------------------------------------------------------
console.log("\n7. El cruce del meridiano de Greenwich y del ecuador no rompe el signo");
{
  // Greenwich: de -0,001 a +0,001 son 0,002 grados de longitud, ~222 m. Una
  // resta mal hecha daria ~0 (si cancela los signos) o media vuelta al mundo.
  const cruceMeridiano = distanciaMetros({ lat: 0.5, lng: -0.001 }, { lat: 0.5, lng: 0.001 })!;
  console.log(`     cruce del meridiano (0,002 grados): ${cruceMeridiano.toFixed(1)} m`);
  verificar(`el cruce del meridiano da ~222 m (${cruceMeridiano.toFixed(1)} m)`, Math.abs(cruceMeridiano - 222.4) < 1);

  // Ecuador: de -0,001 a +0,001 de latitud, mismos ~222 m.
  const cruceEcuador = distanciaMetros({ lat: -0.001, lng: 10 }, { lat: 0.001, lng: 10 })!;
  console.log(`     cruce del ecuador  (0,002 grados): ${cruceEcuador.toFixed(1)} m`);
  verificar(`el cruce del ecuador da ~222 m (${cruceEcuador.toFixed(1)} m)`, Math.abs(cruceEcuador - 222.4) < 1);

  // CONTROL POSITIVO: el mismo salto SIN cruzar el cero tiene que medir igual.
  // Si el cruce estuviera roto, este pasaria y el de arriba no.
  const sinCruzar = distanciaMetros({ lat: 0.5, lng: 10.001 }, { lat: 0.5, lng: 10.003 })!;
  verificar(
    `CONTROL: el mismo salto sin cruzar el cero mide lo mismo (${sinCruzar.toFixed(1)} m)`,
    Math.abs(sinCruzar - cruceMeridiano) < 0.1,
  );

  // Antimeridiano: de 179,999 a -179,999 son 0,002 grados, no 359,998.
  const antimeridiano = distanciaMetros({ lat: 0, lng: 179.999 }, { lat: 0, lng: -179.999 })!;
  console.log(`     cruce del antimeridiano:           ${antimeridiano.toFixed(1)} m`);
  verificar(`el antimeridiano da ~222 m y no media vuelta al mundo`, Math.abs(antimeridiano - 222.4) < 1);
}

// ---------------------------------------------------------------------------
console.log("\n8. fueraDeRadio: sin distancia NO acusa");
{
  verificar(`600 m con radio 500 esta fuera`, fueraDeRadio(600, 500) === true);
  verificar(`400 m con radio 500 esta dentro`, fueraDeRadio(400, 500) === false);
  verificar(`exactamente 500 con radio 500 esta dentro (el borde no acusa)`, fueraDeRadio(500, 500) === false);
  verificar(`sin distancia (null) NO cuenta como fuera`, fueraDeRadio(null, 500) === false);
  verificar(`radio 0 o negativo no acusa a nadie`, fueraDeRadio(9_999_999, 0) === false);

  // CONTROL POSITIVO: con el mismo radio, un punto lejisimos SI se marca. Si
  // esto fallara, los `false` de arriba serian un «nunca marca nada».
  verificar(`CONTROL: 300 km con radio 500 SI esta fuera`, fueraDeRadio(300_000, 500) === true);
}

// ---------------------------------------------------------------------------
console.log("\n9. coordenadaValida y radioValido");
{
  verificar(`Cali es valida`, coordenadaValida(CALI) === true);
  verificar(`(0,0) no es valida`, coordenadaValida({ lat: 0, lng: 0 }) === false);
  verificar(`el polo (90, 0) si es valido`, coordenadaValida({ lat: 90, lng: 0 }) === true);
  verificar(`null no es valida`, coordenadaValida(null) === false);

  verificar(`un radio de la lista se respeta`, radioValido(String(RADIOS_OBRA_METROS[0])) === RADIOS_OBRA_METROS[0]);
  verificar(`un radio inventado cae al de por defecto`, radioValido("7") === RADIO_OBRA_METROS_DEFECTO);
  verificar(`texto basura cae al de por defecto`, radioValido("borrar-todo") === RADIO_OBRA_METROS_DEFECTO);
  verificar(`ausente cae al de por defecto`, radioValido(undefined) === RADIO_OBRA_METROS_DEFECTO);
  verificar(`el defecto esta en la lista ofrecida`, (RADIOS_OBRA_METROS as readonly number[]).includes(RADIO_OBRA_METROS_DEFECTO));
}

// ---------------------------------------------------------------------------
console.log("\n10. formatearDistancia");
{
  verificar(`142 -> "142 m"`, formatearDistancia(142) === "142 m");
  verificar(`0 -> "0 m" (esta en la obra, no es "sin dato")`, formatearDistancia(0) === "0 m");
  verificar(`1420 -> "1,4 km" (coma decimal)`, formatearDistancia(1420) === "1,4 km");
  verificar(`CONTROL: 1420 NO se muestra con punto`, formatearDistancia(1420) !== "1.4 km");
  verificar(`306900 -> "307 km" (sin decimal inutil)`, formatearDistancia(306_900) === "307 km");
  // El selector de radio se etiqueta con esta misma funcion: "1 km", no "1,0 km".
  verificar(`1000 -> "1 km" (km redondo sin ",0")`, formatearDistancia(1000) === "1 km");
  verificar(`2000 -> "2 km"`, formatearDistancia(2000) === "2 km");
  verificar(`CONTROL: 1050 si conserva el decimal ("1,1 km")`, formatearDistancia(1050) === "1,1 km");
  verificar(`null -> "—", nunca "0 m"`, formatearDistancia(null) === "—");
  verificar(`NaN -> "—"`, formatearDistancia(NaN) === "—");
}

// ---------------------------------------------------------------------------
console.log("\n11. poligonoCirculo: todos sus vertices estan a la distancia pedida");
{
  const RADIO = 500;
  const anillo = poligonoCirculo(CALI, RADIO, 64);
  verificar(`64 pasos dan 65 puntos (el ultimo cierra el anillo)`, anillo.length === 65);
  verificar(`el anillo cierra: primer punto === ultimo`, anillo[0][0] === anillo[64][0] && anillo[0][1] === anillo[64][1]);

  // El orden es GeoJSON: [lng, lat]. Si estuviera al reves, la longitud de Cali
  // (-76) caeria en el campo de latitud y las distancias saldrian absurdas.
  let peor = 0;
  for (const [lng, lat] of anillo) {
    const d = distanciaMetros(CALI, { lat, lng });
    if (d === null) { peor = Infinity; break; }
    peor = Math.max(peor, Math.abs(d - RADIO));
  }
  console.log(`     peor desviacion de los 65 vertices: ${peor.toFixed(4)} m`);
  verificar(`ningun vertice se desvia mas de 0,5 m de los 500`, peor < 0.5);

  // CONTROL POSITIVO: leer el anillo como [lat, lng] —el orden equivocado— tiene
  // que dar distancias disparatadas. Si diera parecido, la comprobacion de
  // arriba no estaria probando el orden.
  const alReves = distanciaMetros(CALI, { lat: anillo[0][0], lng: anillo[0][1] });
  verificar(
    `CONTROL: leer el anillo como [lat,lng] da un disparate (${alReves === null ? "null" : (alReves / 1000).toFixed(0) + " km"})`,
    alReves === null || alReves > 100_000,
  );

  verificar(`sin centro no hay circulo`, poligonoCirculo(null, 500).length === 0);
  verificar(`radio 0 no dibuja circulo`, poligonoCirculo(CALI, 0).length === 0);
  verificar(`radio no finito no dibuja circulo`, poligonoCirculo(CALI, NaN).length === 0);

  // Un circulo pegado al antimeridiano no puede salirse de [-180, 180]: Mapbox
  // lo dibujaria dando la vuelta al planeta.
  const juntoAlAntimeridiano = poligonoCirculo({ lat: 0, lng: 179.999 }, 2000, 32);
  const enRango = juntoAlAntimeridiano.every(([lng]) => lng >= -180 && lng <= 180);
  verificar(`un circulo junto al antimeridiano queda dentro de [-180, 180]`, enRango);
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} fallaron.`);
  process.exit(1);
}
console.log("Distancia a la obra verificada sin errores.");
