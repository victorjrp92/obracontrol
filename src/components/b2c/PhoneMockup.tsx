import { Camera, MapPin, CheckCircle2, Bell } from "lucide-react";
import PhotoSlot from "./PhotoSlot";

/**
 * Maqueta de la app dentro de un teléfono, hecha en puro CSS/JSX.
 * Muestra de un vistazo la promesa B2C: foto del avance + semáforo + aprobar.
 * No usa fotos externas (salvo el hueco de evidencia, que cae al placeholder).
 */
export default function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]">
      {/* Glow cálido detrás */}
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-orange-300/40 via-amber-200/30 to-blue-300/40 blur-2xl" />

      {/* Marco del teléfono */}
      <div className="rounded-[2.6rem] border-[6px] border-slate-900 bg-slate-900 p-1.5 shadow-2xl shadow-blue-900/20">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-slate-50">
          {/* Notch */}
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />

          {/* Header app */}
          <div className="flex items-center justify-between bg-white px-4 pb-3 pt-7">
            <div>
              <p className="text-[10px] font-medium text-slate-400">Mi proyecto</p>
              <p className="text-[13px] font-extrabold leading-tight text-slate-900">
                Reforma de cocina
              </p>
            </div>
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
              <Bell className="h-4 w-4 text-blue-600" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
            </div>
          </div>

          <div className="space-y-3 px-3 pb-5">
            {/* Tarjeta de evidencia */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
              <div className="h-28 w-full">
                <PhotoSlot
                  label="Foto del avance de hoy"
                  icon={Camera}
                  rounded="rounded-none"
                />
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                  <MapPin className="h-3 w-3 text-emerald-500" />
                  Hoy 2:14 p. m. · GPS ✓
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Verificada
                </span>
              </div>
            </div>

            {/* Semáforo de avance */}
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">
                  Avance de tu obra
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Va bien
                </span>
              </div>
              {/* Barra doble: reportado vs aprobado */}
              <div className="space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-[72%] rounded-full bg-blue-300" />
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-[64%] rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] text-slate-400">
                <span>Reportado 72%</span>
                <span>Aprobado por ti 64%</span>
              </div>
            </div>

            {/* Acción de aprobar */}
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-[11px] font-medium text-slate-700">
                  Enchape de cocina terminado
                </span>
              </div>
              <button
                className="mt-2.5 w-full rounded-xl bg-orange-500 py-2 text-[11px] font-bold text-white shadow-sm shadow-orange-500/30"
                tabIndex={-1}
              >
                Aprobar avance
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
