// ─────────────────────────────────────────────────────────────────────────
// Cliente de visión de Seiricon Alerta (SOLO servidor). REST directo a
// Anthropic, cero dependencias nuevas — mismo patrón que src/lib/deepseek.ts
// (fetch + AbortController + key solo en process.env + salida sanitizada
// como unión discriminada). NO se instala @anthropic-ai/sdk (spec D1: salida
// estructurada forzada con `tools`/`tool_choice`, superficie de
// supply-chain, coherencia con deepseek.ts).
//
//   - Endpoint:  POST https://api.anthropic.com/v1/messages
//   - Header:    anthropic-version: 2023-06-01
//   - Modelo:    Claude Haiku 4.5 — `claude-haiku-4-5`. ID VERIFICADO contra
//                el catálogo de modelos de Anthropic el 2026-08-15: sigue
//                vigente y activo (ventana de 200K, hasta 64K de salida,
//                visión incluida), y es el modelo con visión más barato de
//                la familia Claude. Precio a esa fecha: USD 1.00 por millón
//                de tokens de entrada y USD 5.00 por millón de salida.
//                COSTO POR LECTURA (estimado, ver más abajo): las dos fotos
//                pesan ~1.5K tokens cada una (blob de análisis de 1400px,
//                MAX_DIM_ANALISIS en media/overlay.ts) + ~1.4K de este
//                prompt y del esquema del tool ≈ 4.5K de entrada, y ~0.2K de
//                salida → ~USD 0.006 por grieta leída (~24 COP), ~USD 6 por
//                cada 1.000 lecturas. Un reintento en el peor caso lo
//                duplica. Si algún día hay que bajarlo, la palanca grande es
//                MAX_DIM_ANALISIS (el texto ya es el 30% del costo). Se usa el
//                ALIAS sin sufijo de fecha (antes estaba fijado el snapshot
//                `claude-haiku-4-5-20251001`, que también sigue vivo): el
//                alias es la forma recomendada y evita quedar clavado a un
//                snapshot que algún día se retira. Si el ID dejara de
//                existir, la llamada HTTP falla con 404 (4xx = no se
//                reintenta) y el sistema degrada solo a modo manual — nunca
//                rompe el flujo. Override: ALERTA_VISION_MODEL.
//   - Doble llave (kill-switch, NO se apaga por decisión de producto — ver
//     docs/specs/2026-08-13-seiricon-alerta-fase2.md): hace falta
//     ANTHROPIC_API_KEY presente Y ALERTA_VISION_ENABLED === "true". Si
//     falta cualquiera de las dos, degrada a `{ok:false, motivo:"sin_key"}`
//     sin lanzar — es el mecanismo normal para que /alerta/grietas funcione
//     igual en dev (sin key) que en producción (con key).
//   - Reintento: UN solo reintento, y solo ante fallos que sí mejoran al
//     repetirse (red caída, timeout, 5xx, 429 respetando `retry-after`).
//     Un 4xx NO se reintenta: un payload malo no se arregla mandándolo otra
//     vez. Todo el ciclo cabe dentro del `maxDuration = 60` de la ruta (ver
//     PRESUPUESTO_TOTAL_MS abajo).
//   - Calidad de foto: si el modelo LEE la foto pero reporta `calidad_foto`
//     distinto de "ok", la observación NO se usa: se devuelve
//     `{ok:false, motivo:"foto_mala", ...}` con qué falló y un consejo, para
//     que el cliente ofrezca repetir la foto en vez de arrastrar una lectura
//     dudosa (antes solo bajaba la confianza y seguía).
//
// REGLA NO NEGOCIABLE (spec D2): el prompt NUNCA recibe el elemento que la
// persona declaró en el Paso 1 (columna/muro/etc). Si se lo diéramos, el
// modelo se ancla a esa respuesta y la confirma — se destruye el propósito
// del contraste con lo que declaró el usuario. La reconciliación entre
// declarado/observado ocurre DESPUÉS, en TypeScript puro, en
// src/lib/alerta/triage.ts. Por eso `observarGrieta()` de abajo solo recibe
// las dos fotos, nunca el elemento declarado.
// ─────────────────────────────────────────────────────────────────────────
import {
  DIAGNOSTICO_FOTO,
  type Banderas,
  type CalidadFoto,
  type Elemento,
  type ObservacionGrieta,
  type Patron,
  type ProblemaCalidadFoto,
} from "./tipos";
import { proveedorActivo, type PeticionVision } from "./proveedores-vision";

// El proveedor (Anthropic o Gemini), su URL, su cabecera y la forma del cuerpo
// viven en `proveedores-vision.ts`. Aquí se queda lo que está calibrado y no
// depende de quién responda: el prompt, la sanitización y los reintentos.
const MAX_TOKENS = 700;

/** Timeout de CADA intento. Dos intentos + espera caben en PRESUPUESTO_TOTAL_MS. */
const TIMEOUT_INTENTO_MS = 20_000;
/** Techo del ciclo completo (intento + espera + reintento). La ruta declara maxDuration = 60s. */
const PRESUPUESTO_TOTAL_MS = 50_000;
/** Si queda menos que esto del presupuesto, no vale la pena reintentar. */
const MINIMO_PARA_REINTENTAR_MS = 6_000;
/** Espera base antes del reintento (backoff corto: la persona está esperando frente al celular). */
const ESPERA_REINTENTO_MS = 800;
/** Tope de la espera que puede pedir un `retry-after`; por encima, no se reintenta. */
const ESPERA_REINTENTO_MAX_MS = 10_000;

export type ObservarGrietaResult =
  | { ok: true; observacion: ObservacionGrieta; notaVisual: string | null }
  | { ok: false; motivo: "sin_key" | "error" }
  | {
      ok: false;
      motivo: "foto_mala";
      /** Qué vio mal el modelo — enum ya validado contra `CalidadFoto`. */
      calidad_foto: ProblemaCalidadFoto;
      queFallo: string;
      consejo: string;
    };

const SYSTEM_PROMPT = `Eres un asistente que DESCRIBE lo que se ve en dos fotos de una grieta en una edificación, para un sistema de reglas fijas que decide el nivel de riesgo. Tu única tarea es reportar observaciones objetivas usando la herramienta "reportar_observacion" — nunca das un diagnóstico, un consejo de seguridad ni un veredicto.

Reglas estrictas:
- NO digas si es seguro, peligroso, si hay que evacuar, ni uses las palabras "rojo", "amarillo" o "verde".
- NO des recomendaciones ni consejos.
- "nota_visual" es SOLO una frase corta y neutral de lo que se ve (ej: "grieta diagonal de unos 2mm en la esquina superior de un muro"), sin juicios ni consejos.
- Si no puedes ver bien algo (foto oscura, movida, muy lejos, o sin la moneda de referencia visible), repórtalo en "calidad_foto" y baja la confianza correspondiente en vez de adivinar.
- La primera foto es un acercamiento con una moneda de $500 pesos colombianos pegada junto a la grieta, como referencia de escala. La segunda foto muestra el elemento completo (de piso a techo) para identificar qué tipo de elemento es.

Cómo estimar "ancho_mm" (es el dato más frágil de todos — trátalo con cuidado):
1. Primero ubica la moneda de $500 en la Foto 1. Su diámetro es de 23,7 mm. Esa es tu única regla de medir; si además se alcanza a ver el canto de la moneda de perfil, su espesor ronda 1,5 mm y sirve como referencia secundaria para grietas muy finas.
2. Antes de dar un número, escribe en el campo "escala" el razonamiento explícito: dónde está la moneda y cuántas veces cabe el ancho de la grieta dentro del diámetro de la moneda. Ejemplo: "moneda a la izquierda de la grieta; el ancho de la grieta cabe unas 10 veces en el diámetro → 23,7/10 ≈ 2,4 mm".
3. Solo después de ese razonamiento reporta "ancho_mm".
4. Si NO distingues la moneda con claridad, o está en otro plano/pared distinto al de la grieta, o está tapada, borrosa o cortada: NO adivines el ancho a ojo. Escribe eso mismo en "escala" y reporta "calidad_foto": "sin_referencia_escala".
5. La moneda es la escala válida solo si está sobre la misma superficie que la grieta. Ladrillos, baldosas, enchufes o dedos NO son referencias válidas: si solo tienes eso, es "sin_referencia_escala".

- Responde EXCLUSIVAMENTE llamando la herramienta "reportar_observacion" con el JSON exacto que pide su esquema.`;

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!match) return null;
  const mediaType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  return { mediaType, base64: match[2] };
}

const ELEMENTOS: Elemento[] = [
  "columna",
  "viga",
  "nudo_viga_columna",
  "muro_carga",
  "muro_divisorio",
  "losa_techo",
  "piso",
  "fachada",
  "no_determinado",
];
const PATRONES: Patron[] = [
  "diagonal",
  "diagonal_x",
  "vertical",
  "horizontal",
  "escalonada",
  "craquelado",
  "esquina_vano",
  "junta_entre_elementos",
];
const CALIDADES: CalidadFoto[] = ["ok", "oscura", "movida", "muy_lejos", "sin_referencia_escala"];

function clamp01(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/**
 * Valida y sanitiza la salida cruda de la tool call del modelo (o de
 * cualquier `unknown`, para poder probarla en `scripts/verificar-triage-alerta.ts`
 * sin llamar a la red). Ver spec Fase 2, sección 6, punto 7:
 *
 *   - confianza fuera de [0,1] → se clampa.
 *   - ancho_mm negativo → null.
 *   - calidad_foto === "sin_referencia_escala" → confianza.ancho = 0, PERO
 *     el ancho_mm reportado se CONSERVA (no se nulifica: nulificarlo
 *     apagaría la vía de la regla 4 de reglas.ts — muro_carga con
 *     ancho > 3mm — y ablandaría un rojo a amarillo).
 *   - cualquier enum desconocido (elemento/patron/calidad_foto) → se
 *     RECHAZA la observación completa (devuelve null); el caller cae a modo
 *     manual con motivo "error".
 *
 * Ojo: esta función NO decide qué hacer con una `calidad_foto` mala — eso lo
 * hace `diagnosticarCalidadFoto` en el caller. Aquí la observación se
 * normaliza igual, porque `triage.ts` sigue necesitando ese campo intacto
 * cuando la lectura sí se usa.
 */
export function normalizarObservacion(raw: unknown): ObservacionGrieta | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.elemento !== "string" || !ELEMENTOS.includes(r.elemento as Elemento)) return null;
  if (typeof r.patron !== "string" || !PATRONES.includes(r.patron as Patron)) return null;
  if (typeof r.calidad_foto !== "string" || !CALIDADES.includes(r.calidad_foto as CalidadFoto)) return null;
  const calidad_foto = r.calidad_foto as CalidadFoto;

  const bRaw = r.banderas && typeof r.banderas === "object" ? (r.banderas as Record<string, unknown>) : null;
  if (!bRaw) return null;
  const banderas: Banderas = {
    acero_expuesto: bRaw.acero_expuesto === true,
    concreto_triturado: bRaw.concreto_triturado === true,
    desplazamiento_caras: bRaw.desplazamiento_caras === true,
    elemento_inclinado: bRaw.elemento_inclinado === true,
    separacion_muro_estructura: bRaw.separacion_muro_estructura === true,
  };

  const cRaw = r.confianza && typeof r.confianza === "object" ? (r.confianza as Record<string, unknown>) : null;
  const confianza = {
    elemento: clamp01(cRaw?.elemento),
    patron: clamp01(cRaw?.patron),
    ancho: clamp01(cRaw?.ancho),
  };

  let ancho_mm: number | null = null;
  if (r.ancho_mm !== null && r.ancho_mm !== undefined) {
    const anchoNum = Number(r.ancho_mm);
    if (Number.isFinite(anchoNum) && anchoNum >= 0) ancho_mm = anchoNum;
  }

  // Sin referencia de escala visible: la confianza del ancho baja a 0, pero
  // el ancho_mm se conserva tal cual lo reportó el modelo (ver docstring).
  if (calidad_foto === "sin_referencia_escala") {
    confianza.ancho = 0;
  }

  return { elemento: r.elemento as Elemento, patron: r.patron as Patron, ancho_mm, banderas, confianza, calidad_foto };
}

/**
 * Traduce una `calidad_foto` a "esta foto hay que repetirla". Devuelve null
 * cuando la foto sirve (`"ok"`) — el único caso en que la observación del
 * modelo se usa.
 *
 * Antes, una foto movida u oscura se usaba igual (solo bajaba la confianza y
 * `triage.ts` impedía llegar a verde). El resultado era un amarillo tibio
 * construido sobre una lectura que el propio modelo dijo que no podía hacer
 * bien. Ahora se le devuelve el control a la persona: repetir la foto o
 * describir la grieta ella misma.
 */
export function diagnosticarCalidadFoto(
  calidad: CalidadFoto
): { calidad_foto: ProblemaCalidadFoto; queFallo: string; consejo: string } | null {
  if (calidad === "ok") return null;
  const diagnostico = DIAGNOSTICO_FOTO[calidad];
  return { calidad_foto: calidad, queFallo: diagnostico.queFallo, consejo: diagnostico.consejo };
}

const PALABRAS_PROHIBIDAS = /segur|peligr|\brojo\b|\bamarillo\b|\bverde\b|evacu|colaps|tranquil|no pasa nada|recomiend/i;

/**
 * Filtro de lenguaje de la nota descriptiva del modelo (spec D8): un modelo
 * no le dice a alguien en emergencia si su casa es segura. Corta a 140
 * caracteres y descarta la nota COMPLETA si matchea la lista negra — nunca
 * la reescribe ni la "limpia" parcialmente.
 */
export function sanitizarNotaVisual(nota: unknown): string | null {
  if (typeof nota !== "string") return null;
  const limpia = nota.trim();
  if (!limpia) return null;
  if (PALABRAS_PROHIBIDAS.test(limpia)) return null;
  return limpia.slice(0, 140);
}

// ─── Política de reintento ─────────────────────────────────────────────────

/**
 * Decide si un intento fallido merece repetirse. `status === null` significa
 * que la petición ni siquiera llegó a tener respuesta (red caída, timeout,
 * conexión cortada al leer el cuerpo): eso sí mejora al repetirse.
 *
 *   - null (red/timeout), 408, 429 y 5xx → se reintenta.
 *   - cualquier otro 4xx (400 payload inválido, 401 key mala, 404 modelo
 *     inexistente, 413 imágenes muy pesadas) → NO se reintenta: mandar el
 *     mismo payload otra vez da exactamente el mismo error y le cuesta
 *     20 segundos más a alguien que está mirando una grieta en su casa.
 */
export function esReintentable(status: number | null): boolean {
  if (status === null) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

/**
 * Cuánto esperar antes del reintento. Respeta `retry-after` en sus dos
 * formatos válidos (segundos o fecha HTTP) — ignorarlo en un 429 es la forma
 * más rápida de que Anthropic nos siga diciendo que no.
 *
 * Devuelve `null` si la espera pedida supera `ESPERA_REINTENTO_MAX_MS`: en
 * ese caso no se reintenta (mejor caer a modo manual que dejar a la persona
 * mirando un spinner medio minuto).
 */
export function esperaReintentoMs(retryAfter: string | null): number | null {
  if (!retryAfter) return ESPERA_REINTENTO_MS;
  const crudo = retryAfter.trim();
  if (!crudo) return ESPERA_REINTENTO_MS;

  let ms: number | null = null;
  const segundos = Number(crudo);
  if (Number.isFinite(segundos)) {
    ms = segundos * 1000;
  } else {
    const fecha = Date.parse(crudo);
    if (Number.isFinite(fecha)) ms = fecha - Date.now();
  }

  if (ms === null) return ESPERA_REINTENTO_MS; // header ilegible → backoff propio
  if (ms <= 0) return ESPERA_REINTENTO_MS;
  if (ms > ESPERA_REINTENTO_MAX_MS) return null; // nos pide esperar demasiado
  return ms;
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type IntentoLectura =
  | { estado: "ok"; data: unknown }
  | { estado: "reintentable"; esperaMs: number }
  | { estado: "fatal" };

/**
 * Un intento contra la API. Nunca lanza: cualquier fallo sale clasificado
 * como reintentable o fatal. No serializa jamás el cuerpo ni el error (son
 * fotos de la casa de alguien).
 */
async function intentarLectura(peticion: PeticionVision, timeoutMs: number): Promise<IntentoLectura> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(peticion.url, {
      method: "POST",
      headers: peticion.headers,
      body: peticion.cuerpo,
      signal: ctrl.signal,
    });

    if (!res.ok) {
      // Diagnóstico mínimo. Se registra SOLO el código HTTP y el código de error
      // del proveedor (NOT_FOUND, PERMISSION_DENIED, INVALID_ARGUMENT…), que son
      // metadatos de la API. NUNCA el cuerpo de la petición ni el de la
      // respuesta: ahí viajan las fotos del interior de la casa de alguien.
      //
      // Sin esto, un fallo de configuración —modelo inexistente, clave mala,
      // facturación apagada— es indistinguible de un timeout: todo el mundo cae
      // a modo manual y no queda rastro de por qué.
      let codigo = "";
      try {
        const cuerpoErr = (await res.clone().json()) as { error?: { status?: string } };
        codigo = typeof cuerpoErr?.error?.status === "string" ? cuerpoErr.error.status : "";
      } catch {
        /* respuesta sin JSON: el HTTP solo ya dice bastante */
      }
      console.error(`[alerta:vision] HTTP ${res.status}${codigo ? ` ${codigo}` : ""}`);
      if (!esReintentable(res.status)) return { estado: "fatal" };
      const esperaMs = esperaReintentoMs(res.headers.get("retry-after"));
      return esperaMs === null ? { estado: "fatal" } : { estado: "reintentable", esperaMs };
    }

    try {
      return { estado: "ok", data: await res.json() };
    } catch {
      // Cuerpo cortado a mitad de lectura: es un fallo de transporte, no un
      // payload malo. Se trata igual que una caída de red.
      return { estado: "reintentable", esperaMs: ESPERA_REINTENTO_MS };
    }
  } catch {
    // Timeout (abort), DNS, conexión rechazada… nada que dependa del payload.
    return { estado: "reintentable", esperaMs: ESPERA_REINTENTO_MS };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Llama al modelo de visión con las dos fotos de una grieta. NUNCA recibe el
 * elemento declarado por el usuario (D2). Nunca lanza: cualquier fallo
 * (sin key, apagado, timeout, red, JSON inválido, enum desconocido) resuelve
 * en `{ ok: false, motivo }` — el caller (GrietaWizardJuntos.tsx / la API
 * route) decide el fallback.
 *
 * Motivos posibles:
 *   - "sin_key"    → la lectura automática está apagada (dev, o kill-switch).
 *   - "error"      → falló y no hay nada que la persona pueda hacer al
 *                    respecto: cae a modo manual.
 *   - "foto_mala"  → el modelo SÍ leyó, pero la foto no daba; trae qué falló
 *                    y un consejo para repetirla.
 */
export async function observarGrieta(args: {
  fotoCercaDataUrl: string;
  fotoLejosDataUrl: string;
}): Promise<ObservarGrietaResult> {
  const proveedor = proveedorActivo();
  const key = process.env[proveedor.variableKey];
  if (!key || process.env.ALERTA_VISION_ENABLED !== "true") {
    return { ok: false, motivo: "sin_key" };
  }

  const cerca = parseDataUrl(args.fotoCercaDataUrl);
  const lejos = parseDataUrl(args.fotoLejosDataUrl);
  if (!cerca || !lejos) return { ok: false, motivo: "error" };

  const peticion = proveedor.armar({
    key,
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: MAX_TOKENS,
    cerca,
    lejos,
    textoCerca: "Foto 1 — acercamiento con moneda de referencia:",
    textoLejos: "Foto 2 — elemento completo, de piso a techo:",
  });

  const inicio = Date.now();
  let intento = await intentarLectura(peticion, TIMEOUT_INTENTO_MS);

  if (intento.estado === "reintentable") {
    // Un solo reintento, y solo si alcanza a caber en el presupuesto de la
    // ruta (maxDuration = 60s): mejor caer a modo manual que quedarse sin
    // respuesta cuando la plataforma corte la función.
    const restante = PRESUPUESTO_TOTAL_MS - (Date.now() - inicio) - intento.esperaMs;
    if (restante >= MINIMO_PARA_REINTENTAR_MS) {
      await dormir(intento.esperaMs);
      intento = await intentarLectura(peticion, Math.min(TIMEOUT_INTENTO_MS, restante));
    }
  }

  if (intento.estado !== "ok") return { ok: false, motivo: "error" };

  // Cada proveedor esconde el JSON en un sitio distinto (tool_use en Anthropic,
  // candidates[].content.parts[].text en Gemini). Eso, y solo eso, es lo que
  // cambia entre uno y otro a partir de aquí.
  const entrada = proveedor.extraer(intento.data);
  if (!entrada) {
    console.error(`[alerta:vision] respuesta 200 sin observación utilizable (proveedor: ${proveedor.nombre}, modelo: ${proveedor.modelo})`);
    return { ok: false, motivo: "error" };
  }

  const observacion = normalizarObservacion(entrada);
  if (!observacion) return { ok: false, motivo: "error" };

  // La foto no daba: se le ofrece repetirla en vez de usar una lectura que el
  // propio modelo marcó como dudosa.
  const problema = diagnosticarCalidadFoto(observacion.calidad_foto);
  if (problema) return { ok: false, motivo: "foto_mala", ...problema };

  const notaCruda = (entrada as Record<string, unknown> | null)?.nota_visual;
  const notaVisual = sanitizarNotaVisual(notaCruda);

  return { ok: true, observacion, notaVisual };
}
