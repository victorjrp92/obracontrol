/**
 * Distancia entre la foto y la obra.
 *
 * El 99,94% de las evidencias llega con coordenadas del móvil que las tomó.
 * Ese dato, solo, no responde nada: «3,45162, -76,53201» no le dice a nadie si
 * la foto se tomó en el apartamento 301 o desde la casa del contratista. Lo que
 * lo convierte en respuesta es compararlo contra el punto de la obra
 * (`Proyecto.ubicacion_lat` / `ubicacion_lng`) y decir cuántos metros hay.
 *
 * Este módulo es PURO —sin Prisma, sin React, sin red— por dos razones. La
 * primera es que el mismo número lo necesitan el servidor (para contar cuántas
 * fotos caen fuera del radio antes de pintar nada) y el cliente (para dibujar
 * el círculo del radio sobre el mapa); si cada lado lo calculara a su manera, el
 * contador y el mapa se contradirían. La segunda es que aquí un error no da una
 * pantalla rota sino un número plausible y falso —y un número plausible y falso
 * sobre dónde estaba un contratista es una acusación—, así que tiene que poder
 * verificarse sin base de datos (ver `scripts/verificar-distancia-obra.ts`).
 */

/** Un punto sobre el globo, en grados decimales. */
export interface Coordenada {
  lat: number;
  lng: number;
}

/**
 * Radio medio de la Tierra (IUGG), en metros.
 *
 * Haversine asume esfera. Sobre distancias de obra —cientos de metros— la
 * diferencia contra el elipsoide real (Vincenty) es de centímetros, muy por
 * debajo de la precisión del GPS de cualquier móvil, así que no compensa la
 * complejidad.
 */
const RADIO_TIERRA_M = 6_371_008.8;

/**
 * Radio por defecto, en metros, a partir del cual una foto se marca como lejos
 * de la obra.
 *
 * ══ POR QUÉ 500 Y NO OTRO ══════════════════════════════════════════════════
 *
 * El número tiene que absorber TRES errores que se suman, ninguno de los cuales
 * es culpa de quien tomó la foto:
 *
 *   1. El tamaño de la obra. Una casa ocupa 10 m; una ciudadela de tres torres
 *      con parqueaderos y zonas comunes pasa de 250 m de punta a punta. La foto
 *      del apartamento del fondo de la torre 3 está legítimamente lejos del
 *      punto que alguien marcó como «la obra».
 *   2. El punto de la obra es UNO solo, y casi siempre es la portería o la
 *      dirección geocodificada, no el centro del lote. Eso ya desplaza el
 *      origen entre 50 y 100 m.
 *   3. La precisión del GPS del móvil: 5–50 m a cielo abierto, y bastante peor
 *      pegado a una estructura de hormigón, donde la señal rebota. Dentro de un
 *      sótano o de una torre en obra gris, errores de 100 m son normales.
 *
 * Sumados, en el caso malo corriente, dan del orden de 250 m.
 *
 * Y el costo de equivocarse NO es simétrico. Marcar de más acusa en falso a un
 * contratista que sí estuvo en la obra, y eso destruye la confianza en todo el
 * reporte. Marcar de menos solo deja pasar un caso. Además, la hipótesis que
 * este indicador existe para descartar —«la foto se tomó en la casa del
 * contratista»— no está a 400 m: está a kilómetros. Ser generoso casi no cuesta
 * capacidad de detección y evita el error caro.
 *
 * MEDIDO contra la obra más grande de producción (3.348 evidencias, todas con
 * coordenadas): la distancia al punto de la obra va de 2 m a 70 m, con mediana
 * 40 m. O sea que 300 m son CUATRO VECES la dispersión real observada y SEIS
 * VECES el peor error de GPS a cielo abierto. Es generoso de verdad, no un
 * número redondo elegido de memoria.
 *
 * No se sube más porque un radio que no puede dispararse nunca es decoración:
 * a 500 m dejaría de distinguir la obra de al lado. Y no se baja más porque a
 * 150 m una ciudadela de tres torres se acusaría a sí misma.
 *
 * NO es un número escondido: la pantalla lo muestra y deja cambiarlo
 * (`RADIOS_OBRA_METROS`, de 150 m a 2 km), porque una casa, una ciudadela de
 * tres torres y una obra lineal no se miden igual.
 */
export const RADIO_OBRA_METROS_DEFECTO = 300;

/**
 * Radios ofrecidos en la pantalla. 150 m para una casa o un local, 2 km para
 * una obra lineal (una vía, una red). Cualquier valor fuera de esta lista se
 * cae al de por defecto: el radio viaja por la URL y no se puede confiar en él.
 */
export const RADIOS_OBRA_METROS = [150, 300, 500, 1000, 2000] as const;

/** True si el valor es una coordenada usable. */
export function coordenadaValida(c: Coordenada | null | undefined): c is Coordenada {
  if (!c) return false;
  const { lat, lng } = c;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  // (0, 0) cae en el golfo de Guinea, a 9.000 km de cualquier obra en Colombia.
  // En la práctica nunca es una lectura real: es lo que queda cuando un parseo
  // falló o un campo llegó vacío. Se descarta por la misma razón que lo hace
  // `parseLatLng` en src/lib/geo.ts — tratarlo como bueno pondría la foto a
  // media Tierra de distancia y la marcaría como fraude.
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * Distancia en metros entre dos puntos, por la fórmula del haversine.
 *
 * Recibe OBJETOS con `lat` y `lng` y no cuatro números sueltos a propósito: con
 * `distancia(a, b, c, d)` el error clásico —intercambiar latitud y longitud— es
 * invisible en la llamada y devuelve un número perfectamente plausible. Con
 * campos nombrados, ese error no se puede escribir sin verlo.
 *
 * Devuelve `null`, NUNCA 0 ni NaN, cuando falta alguna coordenada o no es
 * válida. Un 0 diría «la foto se tomó exactamente en la obra», que es justo lo
 * contrario de lo que pasa cuando no sabemos dónde se tomó.
 */
export function distanciaMetros(
  a: Coordenada | null | undefined,
  b: Coordenada | null | undefined,
): number | null {
  if (!coordenadaValida(a) || !coordenadaValida(b)) return null;

  const rad = Math.PI / 180;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;

  // El factor cos(lat1)·cos(lat2) es lo que hace que un grado de longitud valga
  // menos cuanto más lejos del ecuador. Sin él la fórmula sigue dando números
  // creíbles pero deja de distinguir los dos ejes, que es exactamente el fallo
  // que el control positivo del script de verificación persigue.
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  // atan2 en vez de asin: con puntos casi antipodales el argumento del asin se
  // pasa de 1 por error de punto flotante y devuelve NaN.
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return RADIO_TIERRA_M * c;
}

/**
 * ¿Esta foto cae fuera del radio de la obra?
 *
 * Sin distancia devuelve `false` —no «sí»— a propósito: no saber dónde se tomó
 * una foto no es prueba de nada, y contarla como fuera del radio inflaría el
 * contador de sospechas con casos donde solo falta el dato. Las fotos sin
 * ubicación se cuentan y se enseñan aparte.
 */
export function fueraDeRadio(distancia: number | null, radioMetros: number): boolean {
  if (distancia === null) return false;
  if (!Number.isFinite(radioMetros) || radioMetros <= 0) return false;
  return distancia > radioMetros;
}

/** Normaliza el radio que llega por la URL a uno de los ofrecidos. */
export function radioValido(valor: string | number | null | undefined): number {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (typeof n !== "number" || !Number.isFinite(n)) return RADIO_OBRA_METROS_DEFECTO;
  return (RADIOS_OBRA_METROS as readonly number[]).includes(n)
    ? n
    : RADIO_OBRA_METROS_DEFECTO;
}

/**
 * Distancia legible. Coma decimal porque el reporte se lee en Colombia.
 *
 * Por debajo de 1 km se muestran metros redondeados: el decimal de un metro es
 * ruido frente a la precisión real del GPS y sugeriría una exactitud que no
 * existe.
 */
export function formatearDistancia(metros: number | null): string {
  if (metros === null || !Number.isFinite(metros)) return "—";
  if (metros < 1000) return `${Math.round(metros)} m`;
  const km = metros / 1000;
  // A partir de 100 km el decimal tampoco aporta: ya estamos hablando de otra
  // ciudad, no de otra esquina. Y un km redondo se escribe "2 km", no "2,0 km":
  // este mismo formato etiqueta los radios del selector.
  const texto = km >= 100 || Number.isInteger(km) ? String(Math.round(km)) : km.toFixed(1);
  return `${texto.replace(".", ",")} km`;
}

/**
 * Anillo de un círculo de `radioMetros` alrededor de `centro`, en orden GeoJSON
 * (`[lng, lat]`) y con el primer punto repetido al final para cerrarlo.
 *
 * Existe para que el radio sea VISIBLE en el mapa. Un contador que dice «3 fotos
 * fuera del radio» sin enseñar dónde cae ese radio obliga a creer a ciegas;
 * dibujado, cualquiera ve que la torre del fondo queda dentro y que el punto
 * raro está a dos barrios.
 *
 * No se dibuja como un círculo de píxeles porque un radio en metros cambia de
 * tamaño en pantalla con el zoom y con la latitud: el polígono son metros de
 * verdad sobre el terreno.
 */
export function poligonoCirculo(
  centro: Coordenada | null | undefined,
  radioMetros: number,
  pasos = 64,
): [number, number][] {
  if (!coordenadaValida(centro)) return [];
  if (!Number.isFinite(radioMetros) || radioMetros <= 0) return [];
  if (!Number.isFinite(pasos) || pasos < 3) return [];

  const rad = Math.PI / 180;
  const lat1 = centro.lat * rad;
  const lng1 = centro.lng * rad;
  const delta = radioMetros / RADIO_TIERRA_M; // distancia angular

  const anillo: [number, number][] = [];
  for (let i = 0; i < pasos; i++) {
    const rumbo = (i / pasos) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(rumbo),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(rumbo) * Math.sin(delta) * Math.cos(lat1),
        Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
      );
    // Normaliza a [-180, 180]: un círculo junto al antimeridiano se sale del
    // rango y Mapbox lo dibujaría dando la vuelta al mundo.
    const lngGrados = (((lng2 / rad + 540) % 360) + 360) % 360 - 180;
    anillo.push([lngGrados, lat2 / rad]);
  }
  anillo.push(anillo[0]);
  return anillo;
}
