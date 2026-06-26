import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, tenantErrorResponse } from "@/lib/tenant";

// ─── Sets permitidos (enums-string del cuestionario) ─────────────────────────
// Mantener sincronizados con el wizard del frontend y con el spec (Fase 2).

const OFICIOS = new Set([
  "ARQUITECTO",
  "MAESTRO_DE_OBRA",
  "PINTOR",
  "CARPINTERO_EBANISTA",
  "ELECTRICISTA",
  "PLOMERO_HIDROSANITARIO",
  "ENCHAPADOR_ACABADOS",
  "INSTALADOR_COCINAS_CLOSETS",
  "ESTUCO_DRYWALL",
  "OBRA_GRIS_MAMPOSTERIA",
  "CERRAJERIA_ESTRUCTURAS",
  "OTRO",
]);

const TAMANO_EQUIPO = new Set([
  "SOLO_YO",
  "DE_2_A_5",
  "DE_6_A_10",
  "DE_11_A_20",
  "MAS_DE_20",
]);

const CONTROL_ACTUAL = new Set([
  "WHATSAPP_FOTOS",
  "EXCEL_CUADERNO",
  "OTRA_APP",
  "SIN_CONTROL",
]);

const TIENE_CONTRATISTA = new Set([
  "YA_TENGO",
  "LO_ESTOY_BUSCANDO",
]);

const OBRAS_ACTIVAS = new Set([
  "UNA",
  "DE_2_A_5",
  "DE_6_A_15",
  "MAS_DE_15",
]);

const TIPO_OBRA = new Set([
  "VIS_VIP",
  "ESTRATO_MEDIO_ALTO",
  "COMERCIAL",
  "REMODELACION",
  "INFRAESTRUCTURA",
]);

const NUM_CONTRATISTAS = new Set([
  "DE_1_A_5",
  "DE_6_A_15",
  "DE_16_A_30",
  "MAS_DE_30",
]);

// ─── Payload ─────────────────────────────────────────────────────────────────

interface OnboardingBody {
  // Contratista B2C
  oficio?: string;
  tamano_equipo?: string;
  control_actual?: string;
  // Propietario
  primera_obra?: boolean;
  tiene_contratista?: string;
  // Empresa
  obras_activas?: string;
  tipo_obra?: string;
  num_contratistas?: string;
  // Común (cascada DIVIPOLA)
  departamento?: string;
  ciudad?: string;
}

const MAX_LEN = 80; // depto/ciudad y cualquier string libre acotado

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

// Valida un campo enum-string opcional contra su set permitido.
// Devuelve `null` si es válido (o ausente), o un mensaje de error.
function checkEnum(
  value: unknown,
  allowed: Set<string>,
  field: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !allowed.has(value)) {
    return `Valor no permitido en "${field}"`;
  }
  return null;
}

// Valida un string libre acotado (depto/ciudad). Recorta y limita longitud.
function checkText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return `"${field}" debe ser texto`;
  if (value.trim().length > MAX_LEN) {
    return `"${field}" excede ${MAX_LEN} caracteres`;
  }
  return null;
}

// ─── POST /api/onboarding ────────────────────────────────────────────────────
// Guarda (upsert idempotente por constructora_id) las respuestas del
// cuestionario del usuario autenticado y marca `completado: true`.
export async function POST(req: NextRequest) {
  try {
    const { constructoraId } = await requireUser();

    let body: OnboardingBody;
    try {
      body = (await req.json()) as OnboardingBody;
    } catch {
      return badRequest("Cuerpo inválido");
    }
    if (typeof body !== "object" || body === null) {
      return badRequest("Cuerpo inválido");
    }

    // Validación de enums-string y textos.
    const errors = [
      checkEnum(body.oficio, OFICIOS, "oficio"),
      checkEnum(body.tamano_equipo, TAMANO_EQUIPO, "tamano_equipo"),
      checkEnum(body.control_actual, CONTROL_ACTUAL, "control_actual"),
      checkEnum(body.tiene_contratista, TIENE_CONTRATISTA, "tiene_contratista"),
      checkEnum(body.obras_activas, OBRAS_ACTIVAS, "obras_activas"),
      checkEnum(body.tipo_obra, TIPO_OBRA, "tipo_obra"),
      checkEnum(body.num_contratistas, NUM_CONTRATISTAS, "num_contratistas"),
      checkText(body.departamento, "departamento"),
      checkText(body.ciudad, "ciudad"),
    ].filter(Boolean);

    if (
      body.primera_obra !== undefined &&
      typeof body.primera_obra !== "boolean"
    ) {
      errors.push('"primera_obra" debe ser booleano');
    }

    if (errors.length > 0) {
      return badRequest(errors[0]!);
    }

    // El tipo_cuenta lo determina la cuenta (constructora) del usuario, no el
    // payload: así el dato no es falsificable desde el cliente.
    const constructora = await prisma.constructora.findUnique({
      where: { id: constructoraId },
      select: { tipo_cuenta: true },
    });
    if (!constructora) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 },
      );
    }

    const data = {
      oficio: body.oficio ?? null,
      tamano_equipo: body.tamano_equipo ?? null,
      control_actual: body.control_actual ?? null,
      primera_obra: body.primera_obra ?? null,
      tiene_contratista: body.tiene_contratista ?? null,
      obras_activas: body.obras_activas ?? null,
      tipo_obra: body.tipo_obra ?? null,
      num_contratistas: body.num_contratistas ?? null,
      departamento: body.departamento?.trim() || null,
      ciudad: body.ciudad?.trim() || null,
      completado: true,
    };

    await prisma.perfilOnboarding.upsert({
      where: { constructora_id: constructoraId },
      create: {
        constructora_id: constructoraId,
        tipo_cuenta: constructora.tipo_cuenta,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({ ok: true, completado: true });
  } catch (err) {
    const tenantRes = tenantErrorResponse(err);
    if (tenantRes) return tenantRes;
    console.error("POST /api/onboarding", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── GET /api/onboarding ─────────────────────────────────────────────────────
// Indica si la cuenta ya completó el cuestionario, para que el frontend decida
// si mostrarlo o saltarlo.
export async function GET() {
  try {
    const { constructoraId } = await requireUser();

    const perfil = await prisma.perfilOnboarding.findUnique({
      where: { constructora_id: constructoraId },
      select: { completado: true },
    });

    return NextResponse.json({ completado: perfil?.completado ?? false });
  } catch (err) {
    const tenantRes = tenantErrorResponse(err);
    if (tenantRes) return tenantRes;
    console.error("GET /api/onboarding", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
