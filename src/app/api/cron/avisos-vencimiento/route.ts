import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { vencimientoEmailHtml } from "@/lib/email-templates/vencimiento";
import { avisosDeHoy, fechaLarga, type CuentaParaAviso } from "@/lib/pagos/avisos";
import { PLANES } from "@/lib/suscripcion";
import { canManageUsers } from "@/lib/access";

/**
 * POST /api/cron/avisos-vencimiento — avisa a quien está por vencer.
 *
 * La ejecuta una tarea programada (ver `.github/workflows/avisos.yml`), una vez
 * al día. La decisión de A QUIÉN avisar vive en `@/lib/pagos/avisos`, que es
 * puro y está verificado aparte; aquí solo se lee, se manda y se cuenta.
 *
 * PROTECCIÓN: `CRON_SECRET` en la cabecera `Authorization`. Sin secreto
 * configurado la ruta responde 503 en vez de quedar abierta — una ruta que
 * dispara correos a todos tus clientes no puede depender de que nadie adivine
 * la URL.
 *
 * Los correos van de uno en uno y un fallo NO detiene al resto: que a un cliente
 * le rebote el correo no puede dejar sin avisar a los otros once.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado; la ruta está deshabilitada." },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Solo las que pueden vencer. Las PERSONAL no vencen nunca y las que no
    // tienen fecha son cortesías: ni unas ni otras entran en la consulta.
    const cuentas = await prisma.constructora.findMany({
      where: {
        plan_suscripcion: { not: "PERSONAL" },
        suscripcion_vence_el: { not: null },
      },
      select: {
        id: true,
        nombre: true,
        plan_suscripcion: true,
        estado_suscripcion: true,
        suscripcion_vence_el: true,
      },
    });

    const paraAviso: CuentaParaAviso[] = cuentas.map((c) => ({
      constructora_id: c.id,
      plan_suscripcion: c.plan_suscripcion,
      estado_suscripcion: c.estado_suscripcion,
      suscripcion_vence_el: c.suscripcion_vence_el,
    }));

    const avisos = avisosDeHoy(paraAviso);
    const porId = new Map(cuentas.map((c) => [c.id, c]));

    const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
    const urlPlan = `${sitio}/dashboard/configuracion/plan`;

    let enviados = 0;
    let fallos = 0;

    for (const aviso of avisos) {
      const cuenta = porId.get(aviso.constructora_id);
      if (!cuenta?.suscripcion_vence_el) continue;

      // Solo a quien PUEDE renovar. Mandarle a un obrero que su empresa se
      // vence no le sirve de nada y le hace pensar que se queda sin trabajo.
      const destinatarios = await prisma.usuario.findMany({
        where: { constructora_id: cuenta.id },
        select: { email: true, nombre: true, rol_ref: { select: { nivel_acceso: true } } },
      });

      const puedenRenovar = destinatarios.filter((u) =>
        canManageUsers(u.rol_ref.nivel_acceso),
      );
      if (puedenRenovar.length === 0) {
        console.error(`avisos-vencimiento: la cuenta ${cuenta.id} no tiene a nadie que pueda renovar`);
        continue;
      }

      for (const destinatario of puedenRenovar) {
        try {
          await sendEmail({
            to: destinatario.email,
            subject: aviso.vencido
              ? "Tu plan de Seiricon venció"
              : `Tu plan de Seiricon vence ${aviso.diasRestantes === 1 ? "mañana" : `en ${aviso.diasRestantes} días`}`,
            html: vencimientoEmailHtml({
              nombre: destinatario.nombre,
              nombreCuenta: cuenta.nombre,
              nombrePlan: PLANES[cuenta.plan_suscripcion].nombre,
              diasRestantes: aviso.diasRestantes,
              fechaVence: fechaLarga(cuenta.suscripcion_vence_el),
              urlPlan,
            }),
          });
          enviados++;
        } catch {
          // Sin el correo ni el error en el log: identifican a un cliente.
          fallos++;
          console.error(`avisos-vencimiento: no se pudo enviar a un usuario de ${cuenta.id}`);
        }
      }
    }

    return NextResponse.json({ ok: true, cuentas: avisos.length, enviados, fallos });
  } catch {
    console.error("POST /api/cron/avisos-vencimiento: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
