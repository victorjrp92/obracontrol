import { redirect } from "next/navigation";
import type { TipoCuenta } from "@/generated/prisma";
import { getUsuarioActual } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { esCuentaPersonal } from "@/lib/plan";

// Render dinámico: depende de la sesión y del estado de onboarding.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cuéntanos sobre ti — Seiricon",
};

/**
 * Destino final tras completar/omitir el cuestionario:
 * - Propietario y Contratista B2C (cuentas personales) → /empezar (módulo de intención).
 * - Empresa (constructora) → /dashboard.
 */
function destinoTrasOnboarding(tipoCuenta: TipoCuenta): string {
  return esCuentaPersonal(tipoCuenta) ? "/empezar" : "/dashboard";
}

export default async function OnboardingPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora) redirect("/login");

  const tipoCuenta = usuario.constructora.tipo_cuenta;
  const destino = destinoTrasOnboarding(tipoCuenta);

  // ¿Ya completó el cuestionario? Consulta directa (misma fuente que GET
  // /api/onboarding) — evita un round-trip HTTP desde el server component.
  // Además contamos los proyectos de la constructora: las cuentas legacy (creadas
  // antes del wizard, p.ej. vía Google/OAuth) NO tienen fila en PerfilOnboarding,
  // así que solo `completado` las dejaría atrapadas viendo el cuestionario para
  // siempre. Si ya tienen actividad previa (≥1 proyecto), las saltamos también.
  const [perfil, proyectosCount] = await Promise.all([
    prisma.perfilOnboarding.findUnique({
      where: { constructora_id: usuario.constructora_id },
      select: { completado: true },
    }),
    prisma.proyecto.count({
      where: { constructora_id: usuario.constructora_id },
    }),
  ]);

  if (perfil?.completado || proyectosCount > 0) {
    // Ya respondió antes, o es una cuenta con actividad previa: no se vuelve a
    // forzar el cuestionario; va directo a su destino.
    redirect(destino);
  }

  // Import diferido del client component para mantener el server component limpio.
  const { default: OnboardingWizard } = await import("./OnboardingWizard");

  return (
    <OnboardingWizard
      tipoCuenta={tipoCuenta}
      nombreUsuario={usuario.nombre}
      destino={destino}
    />
  );
}
