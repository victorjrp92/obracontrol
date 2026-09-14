import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, HardHat, MapPin } from "lucide-react";
import { getUsuarioActual } from "@/lib/data";
import { getObrasDeCampo } from "@/lib/data-campo";
import Topbar from "@/components/dashboard/Topbar";
import { ESTADO_OBRA_LABEL } from "../estados-obra";

export const dynamic = "force-dynamic";

/**
 * Las obras del personal de campo.
 *
 * No hay buscador, ni filtros, ni paginación: esta lista la escribe un
 * administrador asignando obras una por una, así que son dos o tres, no
 * doscientas. Lo que cada tarjeta tiene que contestar en un vistazo es «¿en
 * qué voy?» — el porcentaje aprobado y la fase donde hay trabajo hoy.
 */
export default async function CampoPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const obras = await getObrasDeCampo({
    usuarioId: usuario.id,
    constructoraId: usuario.constructora_id,
    nivelAcceso: usuario.rol_ref.nivel_acceso,
  });

  return (
    <>
      <Topbar title="Mis obras" subtitle="Las obras que tienes asignadas" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {obras.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <HardHat className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Todavía no tienes obras</h2>
            {/* Decir QUIÉN lo resuelve evita la llamada a soporte: el personal
                de campo no puede asignarse una obra ni aunque quiera. */}
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Un administrador de tu empresa tiene que asignarte las obras que vas a seguir. En
              cuanto lo haga, aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {obras.map((obra) => (
              <Link
                key={obra.id}
                href={`/campo/${obra.id}`}
                className="group bg-white rounded-2xl border border-slate-100 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900 truncate">{obra.nombre}</h2>
                    {obra.ubicacion && (
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {obra.ubicacion}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                </div>

                {ESTADO_OBRA_LABEL[obra.estado] && (
                  <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    {ESTADO_OBRA_LABEL[obra.estado]}
                  </span>
                )}

                <div className="flex items-baseline justify-between mt-4 mb-1.5">
                  <span className="text-xs font-medium text-slate-500">Avance aprobado</span>
                  <span className="text-2xl font-bold text-green-600">
                    {obra.porcentajeAprobado}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${obra.porcentajeAprobado}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {obra.aprobadas} de {obra.total} tareas aprobadas
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  {obra.faseActual ? (
                    <>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                        Fase {obra.posicionFaseActual} de {obra.totalFases}
                      </p>
                      <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">
                        {obra.faseActual.nombre}
                      </p>
                      <p className="text-xs text-slate-500">
                        {obra.faseActual.porcentajeAprobado}% de esta fase aprobado
                        {obra.reportadas > 0 && ` · ${obra.reportadas} esperando revisión`}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {obra.totalFases > 0
                        ? "Todas las fases están aprobadas."
                        : "La obra todavía no tiene tareas cargadas."}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
