import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Camera, ChevronDown, Image as ImageIcon, MapPin } from "lucide-react";
import { getUsuarioActual } from "@/lib/data";
import { getObraCampo } from "@/lib/data-campo";
import { perfilPuedeProductosTecnicos } from "@/lib/productos-tecnicos/acceso";
import Topbar from "@/components/dashboard/Topbar";
import EstadoTareaBadge from "../../EstadoTareaBadge";
import { ESTADO_OBRA_LABEL } from "../../estados-obra";

export const dynamic = "force-dynamic";

/**
 * Una obra, como se camina: las FASES EN ORDEN (`Fase.orden`) y, dentro de
 * cada una, las tareas agrupadas POR ESPACIO.
 *
 * ══ POR QUÉ `<details>` Y NO UN ACORDEÓN DE REACT ═══════════════════════════
 *
 * Una obra de tres torres tiene diez fases y varios cientos de espacios: todo
 * abierto es un muro de texto imposible de recorrer con el pulgar. Hace falta
 * plegado, pero el plegado con `useState` obliga a convertir toda la pantalla
 * en cliente y a mandar el árbol entero por el hilo. `<details>`/`<summary>`
 * lo hace el navegador, sin JavaScript — que en una obra con media barra de
 * señal es exactamente el JavaScript que no llega.
 *
 * Abierta por defecto viene solo la fase que es el frente de trabajo. El resto
 * cerrado: quien entra aquí viene a ver lo de hoy.
 *
 * Cada tarea es un enlace a su pantalla de reporte: esta lista es el camino
 * para llegar a lo único que el rol hace —reportar avance con evidencia—, no
 * un tablero para mirar.
 */
export default async function ObraCampoPage({
  params,
}: {
  // Next 16: los params de ruta son Promise.
  params: Promise<{ proyectoId: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { proyectoId } = await params;

  const obra = await getObraCampo(
    {
      usuarioId: usuario.id,
      constructoraId: usuario.constructora_id,
      nivelAcceso: usuario.rol_ref.nivel_acceso,
    },
    proyectoId,
  );
  // `getObraCampo` ya contesta igual a «no existe» y a «no es tuya»; aquí
  // tampoco se distingue: un 404 no confirma que la obra exista.
  if (!obra) notFound();

  // Los planos se cierran por TIPO DE CUENTA, no por nivel de acceso
  // (`src/lib/productos-tecnicos/acceso.ts`). Una cuenta CONTRATISTA o
  // PROPIETARIO no tiene el módulo, así que el enlace ni se ofrece.
  const tipoCuenta = usuario.constructora?.tipo_cuenta ?? "CONSTRUCTORA";
  const hayPlanos = perfilPuedeProductosTecnicos(tipoCuenta);

  return (
    <>
      <Topbar title={obra.nombre} subtitle="Fases y tareas de la obra" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Link
            href="/campo"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
          >
            <ArrowLeft className="w-4 h-4" /> Mis obras
          </Link>
          {hayPlanos && (
            <Link
              href={`/campo/${obra.id}/planos`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ImageIcon className="w-4 h-4" /> Planos y renders
            </Link>
          )}
        </div>

        {/* Resumen de la obra */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">{obra.nombre}</h2>
                {ESTADO_OBRA_LABEL[obra.estado] && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    {ESTADO_OBRA_LABEL[obra.estado]}
                  </span>
                )}
              </div>
              {obra.ubicacion && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {obra.ubicacion}
                </p>
              )}
            </div>
            <span className="text-2xl font-bold text-green-600">{obra.porcentajeAprobado}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mt-3">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${obra.porcentajeAprobado}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              {obra.aprobadas} aprobadas de {obra.total}
            </span>
            {obra.totalReportadas > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {obra.totalReportadas} esperando revisión
              </span>
            )}
            {obra.totalDevueltas > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                {obra.totalDevueltas} devueltas
              </span>
            )}
          </div>
        </div>

        {/* Fases, en orden */}
        {obra.fases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <p className="text-sm text-slate-500">
              Esta obra todavía no tiene fases cargadas.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {obra.fases.map((fase, indice) => {
              const esFrente = fase.avance.id === obra.faseActualId;
              return (
                <li key={fase.avance.id}>
                  <details
                    open={esFrente}
                    className="group bg-white rounded-2xl border border-slate-100 overflow-hidden open:border-slate-200"
                  >
                    <summary className="flex items-center gap-3 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-slate-50">
                      {/* El número de orden es lo que convierte la lista en un
                          recorrido: «voy por la 4 de 10», no «voy por Enchapes». */}
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          fase.avance.completa
                            ? "bg-green-50 text-green-600"
                            : esFrente
                              ? "bg-blue-600 text-white"
                              : "bg-slate-50 text-slate-500"
                        }`}
                      >
                        {indice + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {fase.avance.nombre}
                          </h3>
                          {esFrente && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Frente de trabajo
                            </span>
                          )}
                          {fase.avance.completa && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                              Completa
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {fase.avance.total === 0
                            ? "Sin tareas todavía"
                            : `${fase.avance.aprobadas} de ${fase.avance.total} aprobadas · ${fase.espacios.length} espacio${fase.espacios.length === 1 ? "" : "s"}`}
                          {fase.avance.reportadas > 0 &&
                            ` · ${fase.avance.reportadas} esperando revisión`}
                          {fase.avance.devueltas > 0 && ` · ${fase.avance.devueltas} devueltas`}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-800">
                            {fase.avance.porcentajeAprobado}%
                          </div>
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${fase.avance.porcentajeAprobado}%` }}
                            />
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
                      </div>
                    </summary>

                    {/* Tareas por espacio */}
                    <div className="border-t border-slate-100 p-4 flex flex-col gap-3 bg-slate-50/60">
                      {fase.espacios.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Esta fase todavía no tiene tareas asignadas a ningún espacio.
                        </p>
                      ) : (
                        fase.espacios.map((espacio) => (
                          <div
                            key={espacio.id}
                            className="bg-white rounded-xl border border-slate-100 overflow-hidden"
                          >
                            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100">
                              <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-slate-800 truncate">
                                  {espacio.nombre}
                                </h4>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {espacio.ubicacion}
                                </p>
                              </div>
                              <span className="text-xs text-slate-500 flex-shrink-0">
                                {espacio.aprobadas}/{espacio.total}
                              </span>
                            </div>
                            <ul className="divide-y divide-slate-50">
                              {espacio.tareas.map((tarea) => {
                                // Las dos que el servidor deja reportar. En las
                                // otras el enlace lleva a ver la evidencia que
                                // ya se envió.
                                const sePuedeReportar =
                                  tarea.estado === "PENDIENTE" || tarea.estado === "NO_APROBADA";
                                return (
                                  <li key={tarea.id}>
                                    {/* La fila ENTERA es el destino, no un botón
                                        dentro de ella: esto se toca con guantes
                                        y a pleno sol, y un blanco de 60px
                                        metido en una fila de 300 es un fallo de
                                        puntería esperando a ocurrir. */}
                                    <Link
                                      href={`/campo/${obra.id}/tarea/${tarea.id}`}
                                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-sm text-slate-800 truncate">
                                          {tarea.nombre}
                                        </p>
                                        <p className="text-[11px] text-slate-400 truncate">
                                          {tarea.subfase ? `${tarea.subfase} · ` : ""}
                                          {tarea.asignadoNombre ?? "Sin asignar"} ·{" "}
                                          {tarea.tiempoAcordadoDias} día
                                          {tarea.tiempoAcordadoDias === 1 ? "" : "s"}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {sePuedeReportar && (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                            <Camera className="w-3 h-3" />
                                            Reportar
                                          </span>
                                        )}
                                        <EstadoTareaBadge estado={tarea.estado} />
                                      </div>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </>
  );
}
