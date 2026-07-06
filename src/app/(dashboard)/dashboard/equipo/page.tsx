import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { puede } from "@/lib/plan";
import Topbar from "@/components/dashboard/Topbar";
import ObreroManager from "@/components/dashboard/ObreroManager";

export const dynamic = "force-dynamic";

export default async function EquipoPersonalPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora) redirect("/login");

  // Solo cuentas personales con capacidad de equipo (contratista B2C/propietario).
  if (!puede(usuario.constructora.tipo_cuenta, "equipo")) redirect("/dashboard");

  return (
    <>
      <Topbar
        title="Mi equipo"
        subtitle="Agrega a las personas de tu equipo y comparte su enlace para que reporten desde el celular"
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5 rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800 mb-1">¿Cómo funciona?</p>
          <p>
            Agrega a cada persona con sus datos, copia su <strong>enlace personal</strong> y compártelo
            (WhatsApp, etc.). Desde su celular verá las tareas de tu obra, subirá fotos y te las enviará.
            Tú las revisas y apruebas en <strong>Tareas</strong>.
          </p>
        </div>
        <ObreroManager />
      </main>
    </>
  );
}
