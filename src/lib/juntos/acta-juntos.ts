/**
 * Contrato y validación del Acta de documentación de daños de «Juntos»
 * (/go/juntos/documentar → POST /api/juntos/acta-pdf). Extiende el acta de
 * Fase 1 (src/lib/alerta/acta.ts) con el bloque de identidad del gate de
 * datos. Mismo criterio que acta.ts: TypeScript puro, validación manual
 * estricta como segunda línea de defensa del servidor.
 *
 * REGLA DURA (spec-go-juntos.md): `cedula` y `direccion` viajan SOLO en este
 * request, se imprimen en el PDF y se DESCARTAN. No se persisten en ninguna
 * tabla ni se escriben en ningún log — la ruta que consume este contrato no
 * loguea el body bajo ninguna circunstancia.
 */
import {
  MAX_BODY_BYTES,
  MAX_ESPACIOS,
  MAX_FOTO_BASE64_CHARS,
  MAX_FOTOS,
  type EspacioActa,
  type FotoActa,
  type TipoInmueble,
} from "@/lib/alerta/acta";

export { MAX_BODY_BYTES };

export interface IdentidadActa {
  /** Como aparece en la cédula — se imprime en el documento. */
  nombre: string;
  /** NO se guarda en servidores: se imprime en el PDF y se descarta. */
  cedula: string;
  whatsapp: string;
  /** Dirección del inmueble dañado — va en el documento como ubicación del daño. NO se persiste. */
  direccion: string;
  ciudad: string;
}

export interface ActaJuntosPayload {
  identidad: IdentidadActa;
  inmueble: { tipo: TipoInmueble };
  /** `nota` = pérdidas/daños declarados por espacio (alimenta el resumen inicial del PDF). */
  espacios: EspacioActa[];
}

const TIPOS_VALIDOS: TipoInmueble[] = ["CASA", "APARTAMENTO", "EDIFICIO", "LOCAL"];
const DATA_URL_IMAGEN = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const CEDULA_RE = /^\d{5,15}$/;
const WHATSAPP_RE = /^\+?\d{7,15}$/;
const MAX_LARGO_NOMBRE = 120;
const MAX_LARGO_DIRECCION = 200;
const MAX_LARGO_CIUDAD = 60;
const MAX_LARGO_NOMBRE_ESPACIO = 100;
const MAX_LARGO_NOTA = 500;

export type ValidacionActaJuntos = { ok: true; payload: ActaJuntosPayload } | { ok: false; error: string };

/** Normaliza un número de WhatsApp/celular a solo dígitos (con `+` inicial opcional). */
export function normalizarWhatsapp(crudo: string): string {
  const limpio = crudo.replace(/[\s().-]/g, "");
  return limpio.startsWith("+") ? "+" + limpio.slice(1).replace(/\D/g, "") : limpio.replace(/\D/g, "");
}

/** Normaliza una cédula a solo dígitos (quita puntos de mil). */
export function normalizarCedula(cruda: string): string {
  return cruda.replace(/[.\s]/g, "");
}

export function validarIdentidad(raw: unknown): { ok: true; identidad: IdentidadActa } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Faltan tus datos para el documento." };
  const i = raw as Record<string, unknown>;

  const nombre = typeof i.nombre === "string" ? i.nombre.trim() : "";
  if (nombre.length < 3 || nombre.length > MAX_LARGO_NOMBRE) {
    return { ok: false, error: "Escribe tu nombre como aparece en tu cédula." };
  }

  const cedula = typeof i.cedula === "string" ? normalizarCedula(i.cedula.trim()) : "";
  if (!CEDULA_RE.test(cedula)) {
    return { ok: false, error: "Revisa el número de cédula (solo números)." };
  }

  const whatsapp = typeof i.whatsapp === "string" ? normalizarWhatsapp(i.whatsapp.trim()) : "";
  if (!WHATSAPP_RE.test(whatsapp)) {
    return { ok: false, error: "Revisa el número de WhatsApp." };
  }

  const direccion = typeof i.direccion === "string" ? i.direccion.trim() : "";
  if (direccion.length < 5 || direccion.length > MAX_LARGO_DIRECCION) {
    return { ok: false, error: "Escribe la dirección del inmueble." };
  }

  const ciudad = typeof i.ciudad === "string" ? i.ciudad.trim() : "";
  if (ciudad.length < 2 || ciudad.length > MAX_LARGO_CIUDAD) {
    return { ok: false, error: "Escribe la ciudad del inmueble." };
  }

  return { ok: true, identidad: { nombre, cedula, whatsapp, direccion, ciudad } };
}

/**
 * Valida el payload crudo que llega a `POST /api/juntos/acta-pdf`. Mismos
 * topes de espacios/fotos que el acta de Fase 1 (validarActaPayload en
 * acta.ts) + el bloque de identidad. No reusa validarActaPayload porque el
 * contrato difiere (la dirección vive en `identidad`, no en `inmueble`).
 */
export function validarActaJuntosPayload(body: unknown): ValidacionActaJuntos {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Cuerpo de la solicitud inválido." };
  }
  const b = body as Record<string, unknown>;

  const identidadResultado = validarIdentidad(b.identidad);
  if (!identidadResultado.ok) return { ok: false, error: identidadResultado.error };

  const inmueble = b.inmueble as Record<string, unknown> | undefined;
  const tipo = inmueble?.tipo;
  if (typeof tipo !== "string" || !TIPOS_VALIDOS.includes(tipo as TipoInmueble)) {
    return { ok: false, error: "Tipo de inmueble inválido." };
  }

  if (!Array.isArray(b.espacios) || b.espacios.length === 0) {
    return { ok: false, error: "Agrega al menos un espacio con fotos." };
  }
  if (b.espacios.length > MAX_ESPACIOS) {
    return { ok: false, error: `Máximo ${MAX_ESPACIOS} espacios por acta.` };
  }

  let totalFotos = 0;
  const espacios: EspacioActa[] = [];

  for (const raw of b.espacios) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Uno de los espacios tiene un formato inválido." };
    }
    const e = raw as Record<string, unknown>;

    const nombre = typeof e.nombre === "string" ? e.nombre.trim() : "";
    if (!nombre) return { ok: false, error: "Cada espacio necesita un nombre." };
    if (nombre.length > MAX_LARGO_NOMBRE_ESPACIO) {
      return { ok: false, error: `El nombre del espacio "${nombre.slice(0, 30)}…" es muy largo.` };
    }

    const notaCruda = typeof e.nota === "string" ? e.nota.trim() : "";
    const nota = notaCruda ? notaCruda.slice(0, MAX_LARGO_NOTA) : null;

    if (!Array.isArray(e.fotos) || e.fotos.length === 0) {
      return { ok: false, error: `El espacio "${nombre}" necesita al menos una foto.` };
    }

    const fotos: FotoActa[] = [];
    for (const rawFoto of e.fotos) {
      const dataUrl = (rawFoto as Record<string, unknown> | null)?.dataUrl;
      if (typeof dataUrl !== "string") {
        return { ok: false, error: `Una de las fotos del espacio "${nombre}" no tiene un formato válido.` };
      }
      // Tope POR IMAGEN además del agregado (spec-go-juntos.md, Seguridad).
      if (dataUrl.length > MAX_FOTO_BASE64_CHARS) {
        return { ok: false, error: `Una de las fotos del espacio "${nombre}" es demasiado pesada. Repítela e intenta de nuevo.` };
      }
      if (!DATA_URL_IMAGEN.test(dataUrl)) {
        return { ok: false, error: `Una de las fotos del espacio "${nombre}" no tiene un formato válido.` };
      }
      fotos.push({ dataUrl });
    }

    totalFotos += fotos.length;
    if (totalFotos > MAX_FOTOS) {
      return { ok: false, error: `Máximo ${MAX_FOTOS} fotos por acta.` };
    }

    espacios.push({ nombre, nota, fotos });
  }

  return {
    ok: true,
    payload: {
      identidad: identidadResultado.identidad,
      inmueble: { tipo: tipo as TipoInmueble },
      espacios,
    },
  };
}

/** Mensaje 413 de POST /api/juntos/acta-pdf (mismo criterio que acta.ts). */
export function mensajeActaJuntosMuyPesada(): string {
  const mb = (MAX_BODY_BYTES / (1024 * 1024)).toFixed(1);
  return `El acta es muy pesada (máximo ${mb}MB). Elimina algunas fotos e intenta de nuevo.`;
}
