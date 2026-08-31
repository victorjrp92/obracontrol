import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { canManageUsers } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import { estadoDeAcceso, PLANES } from "@/lib/suscripcion";
import { wompiConfigurado } from "@/lib/pagos/wompi";
import PlanCliente from "./PlanCliente";

/**
 * /dashboard/configuracion/plan — plan actual, historial de cobros y compra.
 *
 * Server component: lee el estado real de la suscripción. Antes esta
 * información estaba QUEMADA en la página de configuración («Plan Proyecto ·
 * $1.800.000 · Próxima facturación: 7 Mayo 2026»), sin relación con la base de
 * datos.
 *
 * Los precios salen de `src/lib/suscripcion.ts`, el mismo sitio del que los toma
 * el servidor para cobrar: así lo que ve la persona y lo que se le cobra no
 * pueden divergir nunca.
 */
export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ pago?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  // Comprar y cambiar de plan es administrar la cuenta: mismo nivel que invitar
  // usuarios, y el mismo que exige /api/pagos/checkout. La UI y la API no pueden
  // discrepar sobre quién puede gastar dinero.
  if (!canManageUsers(usuario.rol_ref.nivel_acceso)) redirect("/dashboard");

  const { pago: referenciaVuelta } = await searchParams;
  const c = usuario.constructora;

  const acceso = estadoDeAcceso({
    plan_suscripcion: c.plan_suscripcion,
    estado_suscripcion: c.estado_suscripcion,
    suscripcion_vence_el: c.suscripcion_vence_el,
  });

  const pagos = await prisma.pagoSuscripcion.findMany({
    where: { constructora_id: c.id },
    orderBy: { created_at: "desc" },
    take: 12,
    select: {
      id: true,
      referencia: true,
      plan: true,
      periodo_meses: true,
      monto_centavos: true,
      metodo: true,
      estado: true,
      cubre_hasta: true,
      created_at: true,
    },
  });

  // Si vuelve de Wompi, se busca ese cobro concreto para decirle cómo quedó.
  const pagoDeVuelta = referenciaVuelta
    ? (pagos.find((p) => p.referencia === referenciaVuelta) ?? null)
    : null;

  return (
    <>
      <Topbar title="Plan y facturación" subtitle="Tu suscripción a Seiricon" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <PlanCliente
          planActual={c.plan_suscripcion}
          tipoCuenta={c.tipo_cuenta}
          acceso={acceso}
          venceEl={c.suscripcion_vence_el?.toISOString() ?? null}
          pagos={pagos.map((p) => ({
            id: p.id,
            referencia: p.referencia,
            plan: p.plan,
            periodoMeses: p.periodo_meses,
            montoCentavos: p.monto_centavos,
            metodo: p.metodo,
            estado: p.estado,
            cubreHasta: p.cubre_hasta?.toISOString() ?? null,
            fecha: p.created_at.toISOString(),
          }))}
          pagoDeVuelta={
            pagoDeVuelta
              ? { referencia: pagoDeVuelta.referencia, estado: pagoDeVuelta.estado }
              : null
          }
          // Si faltan las credenciales, la UI lo dice en vez de mostrar un botón
          // que devolvería 503.
          pagosHabilitados={wompiConfigurado()}
          planes={Object.fromEntries(
            Object.entries(PLANES).map(([k, v]) => [
              k,
              { precioCentavos: v.precioCentavos, limiteObras: v.limiteObras, nombre: v.nombre },
            ])
          )}
        />
      </main>
    </>
  );
}
