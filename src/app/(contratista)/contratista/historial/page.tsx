import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { getContratistaHistorial } from "@/lib/data-contratista";
import Topbar from "@/components/dashboard/Topbar";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function ContratistaHistorialPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const historial = await getContratistaHistorial(usuario.id, usuario.constructora_id);

  return (
    <>
      <Topbar title="Historial de aprobaciones" subtitle="Registro cronológico de decisiones" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {historial.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <p className="text-sm text-slate-400">Sin historial de aprobaciones aún</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {historial.map((item) => {
              const isAprobada = item.estado === "APROBADA";
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
                        isAprobada ? "bg-green-50" : "bg-red-50"
                      }`}
                    >
                      {isAprobada ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-600" />
                      ) : (
                        <XCircle className="w-4.5 h-4.5 text-red-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Task name + status badge */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-slate-800 text-sm">
                          {item.tarea}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                            isAprobada
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {isAprobada ? "Aprobada" : "No aprobada"}
                        </span>
                      </div>

                      {/* Project + location */}
                      <p className="text-xs text-slate-500 mb-2">
                        {item.proyecto} &middot; {item.edificio} &middot; Apto {item.unidad}
                      </p>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>
                          Revisado por{" "}
                          <span className="font-medium text-slate-600">{item.aprobador}</span>
                        </span>
                        <span>&middot;</span>
                        <span>
                          {new Date(item.fecha).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Rejection justification callout */}
                      {!isAprobada && item.justificacion && (
                        <div className="mt-3 px-3 py-2 rounded-lg border border-red-200 bg-red-50">
                          <p className="text-xs font-medium text-red-700 mb-0.5">
                            Justificacion de rechazo
                          </p>
                          <p className="text-xs text-red-600">{item.justificacion}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
