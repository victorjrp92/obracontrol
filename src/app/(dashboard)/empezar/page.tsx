import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { esCuentaPersonal, tonoPerfil } from "@/lib/plan";
import IntentWizard from "./IntentWizard";

// Render dinámico: depende de la sesión y del tipo de cuenta.
export const dynamic = "force-dynamic";

export default async function EmpezarPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora) redirect("/login");

  const tipoCuenta = usuario.constructora.tipo_cuenta;
  // El módulo de intención es solo para cuentas personales.
  // Una empresa que llegue aquí va a su flujo normal de proyecto.
  if (!esCuentaPersonal(tipoCuenta)) redirect("/dashboard/proyectos/nuevo");

  const tono = tonoPerfil(tipoCuenta);

  return (
    <IntentWizard
      tipoCuenta={tipoCuenta}
      nombreUsuario={usuario.nombre}
      tituloInicial={tono.intencionTitulo}
      subtituloInicial={tono.intencionSubtitulo}
    />
  );
}
