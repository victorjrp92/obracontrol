import Topbar from "@/components/dashboard/Topbar";
import { getUsuarioActual } from "@/lib/data";
import { Settings, Shield } from "lucide-react";

export default async function ConfiguracionSuperAdminPage() {
  const usuario = await getUsuarioActual();

  return (
    <>
      <Topbar title="Configuración" subtitle="Preferencias del sistema" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold text-slate-900">Tu cuenta de Super Admin</h2>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-500">Nombre</dt>
            <dd className="font-semibold text-slate-800">{usuario?.nombre ?? "—"}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-mono text-xs text-slate-700">{usuario?.email ?? "—"}</dd>
            <dt className="text-slate-500">Rol</dt>
            <dd>
              <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-semibold px-2 py-0.5 rounded">
                <Shield className="w-3 h-3" /> {usuario?.rol_ref?.nombre ?? "Super Admin"}
              </span>
            </dd>
          </dl>
        </div>

        <div className="max-w-2xl bg-white rounded-2xl border border-slate-100 p-6 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-bold text-slate-900">Más ajustes</h2>
          </div>
          <p className="text-sm text-slate-500">
            Próximamente: gestión de planes, integraciones globales, y políticas de tenant.
          </p>
        </div>
      </main>
    </>
  );
}
