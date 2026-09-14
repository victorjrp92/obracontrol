import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, MapPin, MapPinOff, Navigation } from "lucide-react";
import Topbar from "@/components/dashboard/Topbar";
import StatCard from "@/components/dashboard/StatCard";
import MapaEvidencias from "@/components/dashboard/MapaEvidencias";
import { getUsuarioActual } from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";
import { getMapaEvidencias, getObrasParaMapaEvidencias } from "@/lib/data-mapa-evidencias";
import { formatearDistancia, radioValido } from "@/lib/distancia-obra";
import FiltrosEvidencias from "./FiltrosEvidencias";
import { detalleEvidenciaAction } from "./actions";

// ---------------------------------------------------------------------------
// MAPA DE EVIDENCIAS — «¿esta foto se tomó en el apartamento 301, o desde la
// casa del contratista?».
//
// El sistema ya contesta CUÁNTO se avanzó. Esta pantalla contesta DÓNDE, que es
// el dato que estaba capturado desde hace meses —3.399 de 3.401 evidencias
// llevan coordenadas— y no llegaba a ninguna parte: el GPS solo se veía como
// cinco decimales dentro del detalle de UNA tarea.
//
// Tres cosas que esta pantalla NO hace, a propósito:
//   · No esconde las fotos sin coordenadas. Existen y cuentan; se listan aparte.
//     Enseñar solo las ubicadas convertiría el reporte en una mentira por
//     omisión —«todas las fotos están en la obra»— justo sobre lo que promete
//     probar.
//   · No inventa distancias cuando la obra no está ubicada. Dice que no puede y
//     ofrece ubicarla.
//   · No llama sospechosa a ninguna foto. El radio es ancho, es visible y es
//     ajustable, porque el GPS de un móvil falla decenas de metros pegado al
//     hormigón y acusar en falso a un contratista es peor que no avisar.
// ---------------------------------------------------------------------------

/** Porcentaje con coma decimal, que es como se lee en Colombia. */
function porcentaje(parte: number, total: number): string {
  if (total === 0) return "0%";
  const p = (parte / total) * 100;
  // Un entero no se muestra con ",0"; 99,94% no se redondea a 100%, que sería
  // decir que están TODAS.
  // `toFixed(1)` redondea 99,97 a «100,0», que es exactamente lo que este
  // comentario dice que no debe pasar: diria que estan TODAS cuando falta una.
  // Mientras no sea el total exacto, el porcentaje se trunca hacia abajo.
  const completo = parte === total;
  const texto = Number.isInteger(p)
    ? String(p)
    : completo
      ? p.toFixed(1)
      : (Math.floor(p * 10) / 10).toFixed(1);
  return `${texto.replace(".", ",")}%`;
}

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
}

export default async function MapaEvidenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ proyecto?: string; radio?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const accesibles = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  const obras = await getObrasParaMapaEvidencias(usuario.constructora_id, accesibles);

  // El id que llega por URL se valida contra las obras a las que el usuario
  // tiene acceso: sin eso, cambiarlo a mano serviría las coordenadas —y las
  // fotos— de otra constructora.
  const { proyecto: pedida, radio: radioPedido } = await searchParams;
  const elegida = obras.find((o) => o.id === pedida) ?? obras[0];
  const radioMetros = radioValido(radioPedido);

  const datos = elegida
    ? await getMapaEvidencias(elegida.id, usuario.constructora_id, radioMetros)
    : null;

  return (
    <>
      <Topbar title="Mapa de evidencias" subtitle="Dónde se tomó cada foto de la obra" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Link
            href="/dashboard/reportes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a Reportes
          </Link>
          {elegida && (
            <FiltrosEvidencias obras={obras} obraActiva={elegida.id} radioMetros={radioMetros} />
          )}
        </div>

        {!datos && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <MapPin className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">
              Todavía no hay obras a las que puedas ver sus evidencias.
            </p>
          </div>
        )}

        {datos && (
          <>
            {/* ── Contadores ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
              <StatCard
                icon={Camera}
                iconColor="text-slate-600"
                iconBg="bg-slate-100"
                label="Fotos y videos"
                value={datos.conteo.total}
                sub={datos.obra.nombre}
              />
              <StatCard
                icon={MapPin}
                iconColor="text-blue-600"
                iconBg="bg-blue-50"
                label="Con ubicación"
                value={datos.conteo.conUbicacion}
                sub={`${porcentaje(datos.conteo.conUbicacion, datos.conteo.total)} del total`}
              />
              <StatCard
                icon={MapPinOff}
                iconColor="text-slate-500"
                iconBg="bg-slate-100"
                label="Sin ubicación"
                value={datos.conteo.sinUbicacion}
                sub="Sótano, interior o permiso denegado"
              />
              <StatCard
                icon={Navigation}
                iconColor={datos.conteo.fueraDelRadio ? "text-amber-600" : "text-slate-400"}
                iconBg={datos.conteo.fueraDelRadio ? "bg-amber-50" : "bg-slate-100"}
                label="Lejos de la obra"
                // Sin obra ubicada NO se pinta un 0: un 0 se leería como
                // «ninguna es sospechosa», y lo que pasa es que no se sabe.
                value={datos.conteo.fueraDelRadio ?? "—"}
                sub={
                  datos.conteo.fueraDelRadio === null
                    ? "La obra no está ubicada"
                    : `A más de ${formatearDistancia(radioMetros)} del punto`
                }
              />
            </div>

            {/* ── La obra no está ubicada ───────────────────────────────── */}
            {!datos.obra.ubicacion && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 mb-4">
                <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-1">
                  <MapPinOff className="w-4 h-4" /> Esta obra no tiene un punto en el mapa
                </h2>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Las {datos.conteo.conUbicacion} fotos con coordenadas se pintan igual abajo, pero
                  sin el punto de la obra no hay contra qué medirlas: no se puede decir a cuántos
                  metros se tomó ninguna. Ubica la obra y esta pantalla empieza a contestarlo.
                </p>
                <Link
                  href={`/dashboard/proyectos/${datos.obra.id}/editar`}
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-amber-900 underline underline-offset-2 hover:text-amber-950"
                >
                  <MapPin className="w-3.5 h-3.5" /> Ubicar la obra
                </Link>
              </div>
            )}

            {/* ── El mapa ───────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 mb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" /> {datos.obra.nombre}
                </h2>
                {datos.obra.direccion && (
                  <span className="text-xs text-slate-400">{datos.obra.direccion}</span>
                )}
              </div>
              <MapaEvidencias
                proyectoId={datos.obra.id}
                obra={{ nombre: datos.obra.nombre, ubicacion: datos.obra.ubicacion }}
                puntos={datos.puntos}
                radioMetros={radioMetros}
                obtenerDetalle={detalleEvidenciaAction}
              />
            </div>

            {/* ── Las que no tienen dónde ──────────────────────────────── */}
            {datos.sinUbicacion.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6">
                <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-1">
                  <MapPinOff className="w-4 h-4 text-slate-400" /> Sin ubicación (
                  {datos.conteo.sinUbicacion})
                </h2>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Estas fotos existen y cuentan como evidencia: el móvil no pudo fijar la posición
                  —sótano, interior de la estructura o permiso de ubicación denegado—. Aparecen
                  aquí y no escondidas, porque enseñar solo las ubicadas haría creer que todas las
                  fotos de la obra se tomaron en la obra.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="py-2 pr-3">Tarea</th>
                        <th className="py-2 pr-3 hidden sm:table-cell">Ubicación en la obra</th>
                        <th className="py-2 pr-3">Quién</th>
                        <th className="py-2">Cuándo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.sinUbicacion.map((e) => (
                        <tr key={e.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 pr-3">
                            <Link
                              href={`/dashboard/tareas/${e.tareaId}`}
                              className="font-semibold text-blue-700 hover:underline"
                            >
                              {e.tarea}
                            </Link>
                            {e.tipo === "VIDEO" && (
                              <span className="ml-1.5 text-[10px] text-slate-400">(video)</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-slate-500 hidden sm:table-cell">
                            {e.ubicacion}
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{e.autor}</td>
                          <td className="py-2 text-slate-500 whitespace-nowrap">
                            {formatearFecha(e.fecha)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {datos.conteo.sinUbicacion > datos.sinUbicacion.length && (
                  <p className="text-[11px] text-slate-400 mt-3">
                    Se listan las {datos.sinUbicacion.length} más recientes de{" "}
                    {datos.conteo.sinUbicacion}.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
