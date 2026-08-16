/**
 * Control de calidad de foto EN EL DISPOSITIVO, antes de subir nada.
 *
 * Por qué existe: hasta ahora la única señal de "esta foto no sirve" venía del
 * modelo de visión (`calidad_foto` en `ObservacionGrieta`). Esa señal llega
 * tarde —ya se gastó la llamada y la espera— y hoy ni siquiera llega, porque
 * la IA está apagada y la foto mala entra directo al acta. Nitidez y
 * exposición se pueden medir gratis con un `<canvas>` en el mismo instante en
 * que la persona toma la foto, mientras todavía está parada frente a la
 * grieta. Ahí es cuando el consejo sirve.
 *
 * Sesgo deliberado: **preferimos un falso "está bien" a rechazar una foto
 * usable**. Quien usa esto puede estar de noche, con una sola mano, asustada
 * y con un celular malo. Todos los umbrales de aquí están corridos hacia
 * aceptar; el resultado NUNCA bloquea el avance, es solo un consejo (ver
 * `GrietaCameraCaptureJuntos.tsx`).
 *
 * Sin dependencias nuevas: canvas 2D + aritmética entera.
 */

export type VeredictoCalidad = "ok" | "oscura" | "muy_clara" | "movida";

export interface ResultadoCalidadFoto {
  /** Varianza del Laplaciano de la zona con más detalle. Más alto = más nítido. */
  nitidez: number;
  /** Varianza del Laplaciano de todo el encuadre — se guarda para poder recalibrar. */
  nitidez_global: number;
  /** Media de luminancia BT.601, 0–255. */
  brillo: number;
  /** Fracción (0–1) de píxeles quemados: blanco sin información. */
  quemados: number;
  /** Fracción (0–1) de píxeles aplastados: negro sin información. */
  aplastados: number;
  veredicto: VeredictoCalidad;
  /** Qué hacer distinto, en una frase. `null` cuando el veredicto es "ok". */
  consejo: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Umbrales — de dónde salen
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lado mayor al que se submuestrea antes de analizar. 480 px deja ~170k
 * píxeles: dos pasadas enteras sobre eso son milisegundos hasta en un celular
 * de gama baja, que es exactamente el aparato que tenemos enfrente. Además
 * estabiliza la medida: sin submuestrear, la misma foto daría números
 * distintos según los megapíxeles de la cámara, y los umbrales no querrían
 * decir nada.
 */
export const LADO_ANALISIS = 480;

/**
 * Umbral de nitidez (varianza del Laplaciano sobre gris 0–255).
 *
 * La referencia clásica de la literatura de autoenfoque (Pech-Pacheco et al.,
 * 2000, que introduce la varianza del Laplaciano como medida de foco; luego
 * popularizada con umbral ≈100 para imágenes de ~500 px de lado) no se puede
 * copiar tal cual aquí por dos razones que empujan el número HACIA ABAJO:
 *
 *  1. Analizamos `blobAnalisis`, ya recomprimido a JPEG 0.8 (`overlay.ts`), y
 *     encima lo reescalamos con el filtro bilineal del canvas. Las dos cosas
 *     recortan alta frecuencia, que es justo lo que mide el Laplaciano.
 *  2. El sesgo del producto: preferimos dejar pasar una foto floja a molestar
 *     a alguien cuya foto sí servía.
 *
 * De ahí 35, poco más de un tercio de la referencia. En las pruebas sintéticas
 * (`scripts/verificar-calidad-foto.ts`) una superficie lisa con una grieta fina
 * queda muy por encima, y un desenfoque real queda muy por debajo: la franja
 * entre 20 y 60 es donde el número es una opinión, no un hecho.
 */
export const NITIDEZ_MINIMA = 35;

/**
 * Brillo medio por debajo del cual la foto es inservible por oscura.
 * 55/255 ≈ 21% del rango: una foto de interior decente vive entre 90 y 150 aun
 * con luz pobre, así que 55 solo lo cruza lo que de verdad está a oscuras.
 */
export const BRILLO_MINIMO = 55;

/**
 * Brillo medio por arriba del cual ya no queda información. Un muro blanco
 * bien expuesto llega tranquilamente a 200–215, por eso el corte está en 225 y
 * no antes: no queremos regañar a nadie por fotografiar una pared blanca.
 */
export const BRILLO_MAXIMO = 225;

/** Píxel "quemado": ≥250 sobre 255, ya sin textura recuperable. */
export const NIVEL_QUEMADO = 250;
/** Píxel "aplastado": ≤8 sobre 255, negro sin textura recuperable. */
export const NIVEL_APLASTADO = 8;

/** Más de un tercio del encuadre en blanco puro = flash o contraluz directo. */
export const QUEMADOS_MAXIMO = 0.35;
/** Más de la mitad del encuadre en negro puro = no hay foto que analizar. */
export const APLASTADOS_MAXIMO = 0.55;

/**
 * Rejilla para medir la nitidez por zonas. Sin esto, una grieta fina y nítida
 * en un muro liso da varianza global baja —el 95% del encuadre es pared
 * plana— y la rechazaríamos por "movida" siendo perfecta. Midiendo por zonas y
 * quedándonos con la MEJOR, basta con que una parte de la foto esté enfocada,
 * que es exactamente la pregunta que nos importa: ¿se ve la grieta?
 */
const ZONAS_POR_LADO = 4;
/** Zona demasiado chica = varianza ruidosa; se descarta del máximo. */
const PIXELES_MINIMOS_POR_ZONA = 64;

const CONSEJOS: Record<Exclude<VeredictoCalidad, "ok">, string> = {
  oscura: "Salió muy oscura y la grieta casi no se ve. Enciende la luz del cuarto o usa la linterna del celular y vuelve a intentar.",
  muy_clara:
    "La luz le pega muy fuerte y borra la grieta. Apaga el flash o cámbiate de lugar para que la luz no dé directo a la pared, y vuelve a intentar.",
  movida: "Salió movida. Apóyate en la pared, sostén el celular con las dos manos y vuelve a intentar.",
};

// ─────────────────────────────────────────────────────────────────────────
// Núcleo puro — sin DOM, para poder verificarlo en Node
// (`scripts/verificar-calidad-foto.ts`)
// ─────────────────────────────────────────────────────────────────────────

/**
 * RGBA → luminancia BT.601 en enteros. Se usa BT.601 y no BT.709 a propósito:
 * es la misma conversión a gris de la que salen los umbrales de nitidez de la
 * literatura de autoenfoque, y mezclar las dos movería el número sin avisar.
 */
export function aGris(rgba: Uint8ClampedArray | Uint8Array, ancho: number, alto: number): Uint8ClampedArray {
  const gris = new Uint8ClampedArray(ancho * alto);
  for (let i = 0, p = 0; i < gris.length; i++, p += 4) {
    // (77·R + 150·G + 29·B) >> 8 — BT.601 en enteros, sin punto flotante.
    gris[i] = (77 * rgba[p] + 150 * rgba[p + 1] + 29 * rgba[p + 2]) >> 8;
  }
  return gris;
}

/** Resultado neutro para imágenes degeneradas: ante la duda, "ok". */
function resultadoNeutro(): ResultadoCalidadFoto {
  return {
    nitidez: 0,
    nitidez_global: 0,
    brillo: 0,
    quemados: 0,
    aplastados: 0,
    veredicto: "ok",
    consejo: null,
  };
}

/** Analiza un buffer RGBA ya submuestreado (el camino que usa el navegador). */
export function analizarRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  ancho: number,
  alto: number
): ResultadoCalidadFoto {
  return analizarGris(aGris(rgba, ancho, alto), ancho, alto);
}

/**
 * El análisis de verdad: una pasada para exposición, otra para el Laplaciano.
 * Puro y síncrono — el mismo código que corre en el celular corre en el script
 * de verificación.
 */
export function analizarGris(
  gris: Uint8ClampedArray | Uint8Array,
  ancho: number,
  alto: number
): ResultadoCalidadFoto {
  // Sin un borde de 1px alrededor no hay Laplaciano que calcular.
  if (ancho < 3 || alto < 3 || gris.length < ancho * alto) return resultadoNeutro();

  let suma = 0;
  let quemados = 0;
  let aplastados = 0;
  for (let i = 0; i < ancho * alto; i++) {
    const v = gris[i];
    suma += v;
    if (v >= NIVEL_QUEMADO) quemados++;
    else if (v <= NIVEL_APLASTADO) aplastados++;
  }
  const total = ancho * alto;
  const brillo = suma / total;

  // Laplaciano de 4 vecinos (∇² ≈ arriba+abajo+izq+der − 4·centro) acumulado
  // por zonas en una sola pasada: guardar el mapa completo de respuestas
  // costaría memoria que en gama baja no sobra.
  const zonas = ZONAS_POR_LADO * ZONAS_POR_LADO;
  const sumaZ = new Float64Array(zonas);
  const suma2Z = new Float64Array(zonas);
  const nZ = new Int32Array(zonas);
  let sumaG = 0;
  let suma2G = 0;
  let nG = 0;

  for (let y = 1; y < alto - 1; y++) {
    const fila = Math.min(ZONAS_POR_LADO - 1, Math.floor((y * ZONAS_POR_LADO) / alto));
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x;
      const lap = gris[i - ancho] + gris[i + ancho] + gris[i - 1] + gris[i + 1] - 4 * gris[i];
      const z = fila * ZONAS_POR_LADO + Math.min(ZONAS_POR_LADO - 1, Math.floor((x * ZONAS_POR_LADO) / ancho));
      sumaZ[z] += lap;
      suma2Z[z] += lap * lap;
      nZ[z]++;
      sumaG += lap;
      suma2G += lap * lap;
      nG++;
    }
  }

  const varianza = (s: number, s2: number, n: number) => (n > 0 ? Math.max(0, s2 / n - (s / n) ** 2) : 0);

  const nitidezGlobal = varianza(sumaG, suma2G, nG);
  let nitidez = 0;
  for (let z = 0; z < zonas; z++) {
    if (nZ[z] < PIXELES_MINIMOS_POR_ZONA) continue;
    const v = varianza(sumaZ[z], suma2Z[z], nZ[z]);
    if (v > nitidez) nitidez = v;
  }
  // Imagen tan chica que ninguna zona califica: el global es la única medida.
  if (nitidez === 0) nitidez = nitidezGlobal;

  const veredicto = decidir(brillo, quemados / total, aplastados / total, nitidez);

  return {
    nitidez: redondear(nitidez),
    nitidez_global: redondear(nitidezGlobal),
    brillo: redondear(brillo),
    quemados: redondear(quemados / total, 4),
    aplastados: redondear(aplastados / total, 4),
    veredicto,
    consejo: veredicto === "ok" ? null : CONSEJOS[veredicto],
  };
}

/**
 * Orden de prioridad: exposición antes que nitidez. No es arbitrario — en una
 * foto muy oscura o muy quemada el Laplaciano deja de medir detalle y pasa a
 * medir ruido del sensor o artefactos del JPEG, así que la nitidez ahí ya no
 * es un dato. Y la exposición es además lo que la persona puede corregir de
 * inmediato: enciende la luz, apaga el flash.
 */
function decidir(brillo: number, quemados: number, aplastados: number, nitidez: number): VeredictoCalidad {
  if (brillo < BRILLO_MINIMO || aplastados > APLASTADOS_MAXIMO) return "oscura";
  if (brillo > BRILLO_MAXIMO || quemados > QUEMADOS_MAXIMO) return "muy_clara";
  if (nitidez < NITIDEZ_MINIMA) return "movida";
  return "ok";
}

function redondear(v: number, decimales = 1): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

// ─────────────────────────────────────────────────────────────────────────
// Camino del navegador
// ─────────────────────────────────────────────────────────────────────────

interface FuenteImagen {
  fuente: CanvasImageSource;
  ancho: number;
  alto: number;
  liberar: () => void;
}

async function abrirImagen(blob: Blob): Promise<FuenteImagen> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return { fuente: bitmap, ancho: bitmap.width, alto: bitmap.height, liberar: () => bitmap.close() };
  }
  // Safari viejo sin createImageBitmap: el camino largo, con su objectURL que
  // hay que revocar sí o sí (el bug de los objectURL ya se pagó una vez aquí).
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
      el.src = url;
    });
    return {
      fuente: img,
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
      liberar: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/**
 * Mide la calidad de un blob de foto. Devuelve `null` —nunca lanza— si el
 * navegador no coopera: sin medida se sigue de largo, jamás se traba a la
 * persona por un fallo nuestro.
 *
 * Se le pasa el `blobAnalisis` (sin overlay), no el de evidencia: la franja
 * negra del overlay tapa ~10% de la imagen y falsearía tanto el brillo medio
 * como el Laplaciano de la zona de abajo.
 */
export async function analizarCalidadFoto(blob: Blob): Promise<ResultadoCalidadFoto | null> {
  if (typeof document === "undefined") return null;
  let imagen: FuenteImagen | null = null;
  try {
    imagen = await abrirImagen(blob);
    if (!imagen.ancho || !imagen.alto) return null;

    const escala = Math.min(1, LADO_ANALISIS / Math.max(imagen.ancho, imagen.alto));
    const ancho = Math.max(3, Math.round(imagen.ancho * escala));
    const alto = Math.max(3, Math.round(imagen.alto * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(imagen.fuente, 0, 0, ancho, alto);

    return analizarRgba(ctx.getImageData(0, 0, ancho, alto).data, ancho, alto);
  } catch {
    // Sin console: ninguna foto (ni su fallo) debe dejar rastro en los logs.
    return null;
  } finally {
    imagen?.liberar();
  }
}
