import { createHash, randomBytes } from "crypto";
import type { EstadoPagoSuscripcion } from "@/generated/prisma";

/**
 * ─── Adaptador de Wompi (pasarela de Bancolombia) — SOLO SERVIDOR ───────────
 *
 * Sin SDK: `fetch` y `crypto` del runtime, igual que `src/lib/deepseek.ts` y
 * `src/lib/alerta/observar-grieta.ts`. Menos superficie de supply-chain y una
 * dependencia menos que mantener en una ruta que mueve dinero.
 *
 * PSE NO PERMITE COBROS RECURRENTES — es la restricción que define todo el
 * diseño. Wompi solo admite como «fuente de pago» reutilizable la tarjeta,
 * Nequi, DaviPlata y la transferencia Bancolombia; PSE es siempre un pago
 * único que la persona autoriza en su banco cada vez. Y en Colombia PSE es
 * justamente como paga una empresa. De ahí que el modelo sea híbrido:
 *
 *   - Renovación MANUAL (PSE y cualquier método): cada período se genera un
 *     cobro nuevo y se le manda el enlace. Es el camino por defecto.
 *   - Renovación AUTOMÁTICA (tarjeta / Nequi / Bancolombia): se guarda una
 *     fuente de pago y se cobra sin la persona presente.
 *
 * Variables de entorno (ninguna con NEXT_PUBLIC_ salvo la llave pública, que
 * por definición viaja al navegador):
 *   NEXT_PUBLIC_WOMPI_PUBLIC_KEY   pub_prod_… / pub_test_…  (va en el checkout)
 *   WOMPI_PRIVATE_KEY              prv_prod_…               (llamadas a la API)
 *   WOMPI_INTEGRITY_SECRET         prod_integrity_…         (firma del checkout)
 *   WOMPI_EVENTS_SECRET            prod_events_…            (firma de webhooks)
 *   WOMPI_AMBIENTE                 "produccion" | "pruebas" (por defecto pruebas)
 */

const API_PRODUCCION = "https://production.wompi.co/v1";
const API_PRUEBAS = "https://sandbox.wompi.co/v1";
const CHECKOUT_URL = "https://checkout.wompi.co/p/";

export function enProduccion(): boolean {
  return process.env.WOMPI_AMBIENTE === "produccion";
}

export function apiBase(): string {
  return enProduccion() ? API_PRODUCCION : API_PRUEBAS;
}

/** ¿Están las cuatro variables necesarias? Si no, el cobro se apaga sin romper la app. */
export function wompiConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY &&
      process.env.WOMPI_PRIVATE_KEY &&
      process.env.WOMPI_INTEGRITY_SECRET &&
      process.env.WOMPI_EVENTS_SECRET
  );
}

// ─── Referencia ─────────────────────────────────────────────────────────────

/**
 * Referencia única de la transacción. Es también la llave de idempotencia del
 * webhook, así que NO puede ser adivinable ni repetirse: lleva 8 bytes
 * aleatorios además del prefijo y la marca de tiempo.
 */
export function generarReferencia(constructoraId: string): string {
  const corto = constructoraId.slice(-6);
  return `SRC-${corto}-${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
}

// ─── Firma de integridad del Checkout ───────────────────────────────────────

/**
 * SHA-256 de `referencia + monto_en_centavos + moneda [+ expiracion] + secreto`,
 * en hexadecimal MINÚSCULA. Sin ella Wompi rechaza el checkout, y con ella nadie
 * puede alterar el monto desde el navegador — que es su verdadera razón de ser.
 */
export function firmaIntegridad(args: {
  referencia: string;
  montoCentavos: number;
  moneda?: string;
  /** ISO 8601. Si se manda, DEBE ir también en el checkout como expiration-time. */
  expiracion?: string;
}): string {
  const moneda = args.moneda ?? "COP";
  const secreto = process.env.WOMPI_INTEGRITY_SECRET ?? "";
  const cadena = `${args.referencia}${args.montoCentavos}${moneda}${args.expiracion ?? ""}${secreto}`;
  return createHash("sha256").update(cadena).digest("hex");
}

/** URL del Checkout Web ya firmada. El monto viaja en CENTAVOS. */
export function urlCheckout(args: {
  referencia: string;
  montoCentavos: number;
  urlRedireccion: string;
  correoCliente?: string;
  moneda?: string;
}): string {
  const moneda = args.moneda ?? "COP";
  const params = new URLSearchParams({
    "public-key": process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ?? "",
    currency: moneda,
    "amount-in-cents": String(args.montoCentavos),
    reference: args.referencia,
    "redirect-url": args.urlRedireccion,
    "signature:integrity": firmaIntegridad({
      referencia: args.referencia,
      montoCentavos: args.montoCentavos,
      moneda,
    }),
  });
  if (args.correoCliente) params.set("customer-data:email", args.correoCliente);
  return `${CHECKOUT_URL}?${params.toString()}`;
}

// ─── Verificación de webhooks ───────────────────────────────────────────────

export interface EventoWompi {
  event: string;
  data: Record<string, unknown>;
  environment?: string;
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
  sent_at?: string;
}

/** Lee `transaction.status` dentro de `data` siguiendo la ruta con puntos. */
function valorPorRuta(objeto: unknown, ruta: string): unknown {
  return ruta.split(".").reduce<unknown>((acc, parte) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[parte];
    return undefined;
  }, objeto);
}

/** Comparación en tiempo constante: no filtra por cuánto tardó en fallar. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/**
 * Valida la firma de un evento de Wompi.
 *
 * Se concatenan, EN ORDEN: los valores de los campos que lista
 * `signature.properties` (resueltos dentro de `data`), luego `timestamp`, y por
 * último el secreto de eventos. SHA-256 de eso debe dar `signature.checksum`.
 *
 * Sin esta verificación, la ruta del webhook es un endpoint público donde
 * cualquiera podría declarar aprobado un pago que nunca ocurrió. Es la línea
 * más importante de todo este módulo.
 */
export function eventoEsAutentico(evento: EventoWompi): boolean {
  const secreto = process.env.WOMPI_EVENTS_SECRET;
  if (!secreto) return false;

  const propiedades = evento.signature?.properties;
  const checksum = evento.signature?.checksum;
  if (!Array.isArray(propiedades) || propiedades.length === 0 || !checksum) return false;
  if (typeof evento.timestamp !== "number") return false;

  let cadena = "";
  for (const ruta of propiedades) {
    const valor = valorPorRuta(evento.data, ruta);
    if (valor === undefined || valor === null) return false;
    cadena += String(valor);
  }
  cadena += String(evento.timestamp) + secreto;

  const calculado = createHash("sha256").update(cadena).digest("hex");
  return igualSeguro(calculado.toLowerCase(), checksum.toLowerCase());
}

// ─── Consulta a la API ──────────────────────────────────────────────────────

export interface TransaccionWompi {
  id: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING";
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
}

/**
 * Consulta una transacción por su id. El webhook trae el estado, pero
 * verificarlo contra la API antes de dar acceso cierra el hueco de un evento
 * repetido o manipulado: la fuente de verdad es Wompi, no el cuerpo que llegó.
 *
 * Nunca lanza: un fallo de red devuelve `null` y quien llama decide.
 */
export async function consultarTransaccion(id: string): Promise<TransaccionWompi | null> {
  const llave = process.env.WOMPI_PRIVATE_KEY;
  if (!llave) return null;

  try {
    const res = await fetch(`${apiBase()}/transactions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${llave}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const t = json?.data;
    if (!t || typeof t.id !== "string" || typeof t.status !== "string") return null;
    return {
      id: t.id,
      status: t.status,
      reference: String(t.reference ?? ""),
      amount_in_cents: Number(t.amount_in_cents ?? 0),
      currency: String(t.currency ?? "COP"),
      payment_method_type: t.payment_method_type ? String(t.payment_method_type) : undefined,
    };
  } catch {
    return null;
  }
}

/** Traduce el estado de Wompi al enum `EstadoPago` del esquema. */
export function traducirEstado(status: string): EstadoPagoSuscripcion {
  switch (status) {
    case "APPROVED":
      return "APROBADO";
    case "DECLINED":
      return "RECHAZADO";
    case "VOIDED":
      return "ANULADO";
    case "ERROR":
      return "ERROR";
    default:
      return "PENDIENTE";
  }
}
