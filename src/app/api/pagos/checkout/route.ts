import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, tenantErrorResponse } from "@/lib/tenant";
import { canManageUsers } from "@/lib/access";
import { generarReferencia, urlCheckout, wompiConfigurado } from "@/lib/pagos/wompi";
import { esPlanDePago, precioTotalCentavos, PLANES } from "@/lib/suscripcion";
import type { PlanTipo } from "@/generated/prisma";

/**
 * POST /api/pagos/checkout — inicia el cobro de un plan.
 *
 * Registra el intento en `pagos_suscripcion` (PENDIENTE) y devuelve la URL
 * firmada del Checkout Web de Wompi. La suscripción NO se toca aquí: solo la
 * acredita el webhook cuando Wompi confirma el pago. Que esta ruta no pueda
 * conceder acceso es a propósito — es la única forma de que un usuario no pueda
 * regalarse un plan llamándola.
 *
 * El MONTO lo calcula el servidor a partir del plan, nunca se acepta del
 * cliente. La firma de integridad lo sella para que tampoco se pueda alterar en
 * el navegador.
 */

const PERIODOS_VALIDOS = [1, 6, 12];

export async function POST(req: NextRequest) {
  try {
    const { constructoraId, usuario } = await requireUser();

    // Comprar un plan es administrar la cuenta: mismo nivel que invitar usuarios.
    // `requireUser` devuelve el nombre del rol, no su nivel de acceso — hace
    // falta esta consulta para autorizar por nivel, que es lo que manda.
    const perfil = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!perfil || !canManageUsers(perfil.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para gestionar la suscripción" }, { status: 403 });
    }

    if (!wompiConfigurado()) {
      return NextResponse.json(
        { error: "Los pagos en línea todavía no están habilitados. Escríbenos y lo resolvemos." },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      plan?: string;
      periodoMeses?: number;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    const plan = body.plan as PlanTipo | undefined;
    if (!plan || !(plan in PLANES) || !esPlanDePago(plan)) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    const periodoMeses = body.periodoMeses ?? 1;
    if (!PERIODOS_VALIDOS.includes(periodoMeses)) {
      return NextResponse.json({ error: "Período no válido" }, { status: 400 });
    }

    // El monto SIEMPRE lo calcula el servidor.
    const montoCentavos = precioTotalCentavos(plan, periodoMeses);
    const referencia = generarReferencia(constructoraId);

    await prisma.pagoSuscripcion.create({
      data: {
        constructora_id: constructoraId,
        referencia,
        plan,
        periodo_meses: periodoMeses,
        monto_centavos: montoCentavos,
        estado: "PENDIENTE",
      },
    });

    const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
    const url = urlCheckout({
      referencia,
      montoCentavos,
      urlRedireccion: `${sitio}/dashboard/configuracion?pago=${encodeURIComponent(referencia)}`,
      correoCliente: usuario.email,
    });

    return NextResponse.json({ url, referencia });
  } catch (err) {
    const respuestaTenant = tenantErrorResponse(err);
    if (respuestaTenant) return respuestaTenant;
    console.error("POST /api/pagos/checkout: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
