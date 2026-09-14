import { redirect } from "next/navigation";
import { getUsuarioActual, getProyectosConProgreso } from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";
import Topbar from "@/components/dashboard/Topbar";
import { Download } from "lucide-react";
import { getTareasVelocidad } from "@/lib/data-velocidad";
import ReporteVelocidad from "@/components/dashboard/ReporteVelocidad";
import SelectorObraReporte from "@/components/dashboard/SelectorObraReporte";
import DescargarReportes from "@/components/dashboard/DescargarReportes";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ proyecto?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  const proyectos = await getProyectosConProgreso(usuario.constructora_id, accessible);

  // La obra del reporte de velocidad. El id que llega por URL se valida contra
  // las obras a las que el usuario tiene acceso: sin eso, cambiarlo a mano
  // serviria el reporte de otra constructora.
  const { proyecto: pedido } = await searchParams;
  const elegida = proyectos.find((p) => p.id === pedido) ?? proyectos[0];
  const velocidad = elegida
    ? await getTareasVelocidad(elegida.id, usuario.constructora_id)
    : null;

  return (
    <>
      <Topbar title="Reportes" subtitle="Generación y descarga de reportes" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ── Descargas ──────────────────────────────────────────────────
            Un desplegable con buscador y casillas en vez de un boton por obra:
            con treinta obras, la lista era una pantalla entera y el cierre de
            mes, treinta clics.

            El score de contratistas SALIO de aqui a proposito. Es informacion
            sobre el desempeno de personas y no la puede ver cualquiera dentro
            de la constructora; vive en super admin. Quitar el enlace no bastaba:
            el endpoint tambien quedo cerrado a SUPER_ADMIN, porque un boton
            escondido con una API abierta no protege nada. */}
        {/* Arriba de las graficas y con ancho acotado: es una accion corta
            -elegir obra y bajar- y estirada a toda la pantalla parecia la
            seccion principal cuando lo que se viene a ver son las graficas. */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-xl mb-6">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-1">
            <Download className="w-4 h-4 text-blue-600" /> Descargar avance en PDF
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Estado de avance con detalle por edificio. Elige una obra o varias.
          </p>
          <DescargarReportes
            obras={proyectos.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              porcentaje: p.progreso.porcentajeAprobado,
              aprobadas: p.progreso.aprobadas,
              total: p.progreso.total,
            }))}
          />
        </div>

        {elegida && (
          <>
            <div className="flex items-center justify-end mb-3">
              <SelectorObraReporte
                proyectos={proyectos.map((p) => ({ id: p.id, nombre: p.nombre }))}
                activo={elegida.id}
              />
            </div>
            {velocidad && (
              <ReporteVelocidad
                tareas={velocidad.tareas}
                diasHabilesSemana={velocidad.diasHabilesSemana}
              />
            )}
          </>
        )}

        <p className="text-[11px] text-slate-400 mt-4 px-1">
          Próximamente: reporte de extensiones de tiempo y consumo de materiales.
        </p>
      </main>
    </>
  );
}
