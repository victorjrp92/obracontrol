import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getDashboardStats,
  getProyectosConProgreso,
  getTareasParaAprobar,
  getResumenSemanal,
  getUsuarioActual,
} from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";
import { esCuentaPersonal } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import StatCard from "@/components/dashboard/StatCard";
import ProgressBar from "@/components/dashboard/ProgressBar";
import MapaProyectos from "@/components/mapa/MapaProyectos";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderOpen,
  MapPin,
  TrendingUp,
  XCircle,
} from "lucide-react";

const semaforoColors: Record<string, string> = {
  "verde-intenso": "bg-green-700",
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
  vinotinto: "bg-red-900",
};

export default async function DashboardPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  // Primera experiencia: una cuenta personal sin obras va directo al asistente.
  const personal = esCuentaPersonal(usuario.constructora?.tipo_cuenta ?? "CONSTRUCTORA");
  if (personal) {
    const totalProyectos = await prisma.proyecto.count({
      where: { constructora_id: usuario.constructora_id },
    });
    if (totalProyectos === 0) redirect("/empezar");
  }

  if (
    usuario.rol_ref.nivel_acceso === "ADMIN_PROYECTO" &&
    (usuario.proyectos_administrados?.length ?? 0) === 0
  ) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-slate-500 text-sm text-center max-w-sm">
          No tienes proyectos asignados. Contacta al administrador general para que te asigne al menos un proyecto.
        </p>
      </main>
    );
  }

  const cid = usuario.constructora_id;
  const accessible = await getAccessibleProjectIds(
    usuario.id,
    cid,
    usuario.rol_ref.nivel_acceso,
  );

  const [stats, proyectos, tareasParaAprobar, resumenSemanal] = await Promise.all([
    getDashboardStats(cid, accessible),
    getProyectosConProgreso(cid, accessible),
    getTareasParaAprobar(cid, 6, accessible),
    getResumenSemanal(cid, accessible),
  ]);

  const statCards = [
    {
      icon: FolderOpen,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      label: "Proyectos activos",
      value: String(stats.proyectosActivos),
    },
    {
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      label: "Esperando aprobación",
      value: String(stats.tareasReportadas),
      sub: "Tareas reportadas",
    },
    {
      icon: Clock,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      label: "Tareas en riesgo",
      value: String(stats.tareasEnRiesgo),
      sub: "Fuera de tiempo",
    },
    {
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      label: "Progreso global",
      value: `${stats.porcentajeAprobado}%`,
      sub: `${stats.tareasAprobadas} de ${stats.total} aprobadas`,
    },
  ];

  const taskBreakdown = [
    { label: "Aprobadas", value: stats.tareasAprobadas, color: "bg-green-500", pct: stats.total > 0 ? Math.round((stats.tareasAprobadas / stats.total) * 100) : 0 },
    { label: "Reportadas", value: stats.tareasReportadas, color: "bg-blue-500", pct: stats.total > 0 ? Math.round((stats.tareasReportadas / stats.total) * 100) : 0 },
    { label: "Pendientes", value: stats.tareasPendientes, color: "bg-slate-300", pct: stats.total > 0 ? Math.round((stats.tareasPendientes / stats.total) * 100) : 0 },
    { label: "No aprobadas", value: stats.tareasNoAprobadas, color: "bg-red-500", pct: stats.total > 0 ? Math.round((stats.tareasNoAprobadas / stats.total) * 100) : 0 },
  ];

  // Datos para el mapa de obras (solo proyectos con coordenadas).
  const proyectosMapa = proyectos
    .filter((p) => p.ubicacion_lat != null && p.ubicacion_lng != null)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      lat: p.ubicacion_lat as number,
      lng: p.ubicacion_lng as number,
      porcentaje: p.progreso.porcentajeAprobado,
    }));
  const proyectosSinUbicacion = proyectos.filter(
    (p) => p.ubicacion_lat == null || p.ubicacion_lng == null,
  );

  // Mapa de obras:
  //  - Constructoras (B2B): se muestra siempre que haya al menos una obra ubicada.
  //  - Cuentas personales (B2C): solo a partir de 2 obras activas. Con una sola
  //    obra, un mapa con un único punto no aporta y satura la vista; la ubicación
  //    se sigue capturando en la creación (alimenta nuestra DB y el mapa global
  //    del super admin), simplemente no se le muestra aquí.
  const mostrarMapa = personal
    ? stats.proyectosActivos >= 2 && proyectosMapa.length > 0
    : proyectosMapa.length > 0;
  // El banner "sin ubicación" invita a verlas en el mapa: solo tiene sentido si
  // la cuenta va a ver el mapa (B2B siempre; personal solo con ≥2 obras activas).
  const mostrarBannerSinUbicacion =
    proyectosSinUbicacion.length > 0 && (!personal || stats.proyectosActivos >= 2);

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle={`Resumen general · ${usuario.constructora?.nombre ?? "Seiricon"}`}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Stats grid — 4 cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {statCards.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* Banner: proyectos sin ubicación */}
        {mostrarBannerSinUbicacion && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">
                {proyectosSinUbicacion.length} proyecto{proyectosSinUbicacion.length === 1 ? "" : "s"} sin ubicación.
              </span>{" "}
              Agrégala para verlo{proyectosSinUbicacion.length === 1 ? "" : "s"} en el mapa:{" "}
              {proyectosSinUbicacion.map((p, i) => (
                <span key={p.id}>
                  <Link href={`/dashboard/proyectos/${p.id}/editar`} className="underline font-medium hover:text-amber-900">
                    {p.nombre}
                  </Link>
                  {i < proyectosSinUbicacion.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Mapa de obras */}
        {mostrarMapa && (
          <div className="mb-6 bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-blue-600" />
              <h2 className="font-bold text-slate-800">Mapa de obras</h2>
            </div>
            <MapaProyectos proyectos={proyectosMapa} hrefBase="/dashboard/proyectos" />
          </div>
        )}

        {/* Row 2: Projects + Task breakdown */}
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {/* Project cards */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-800">Proyectos</h2>
              <Link
                href="/dashboard/proyectos"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {proyectos.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400 mb-3">Sin proyectos activos</p>
                <Link
                  href={personal ? "/empezar" : "/dashboard/proyectos/nuevo"}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {personal ? "Iniciar mi obra" : "Crear primer proyecto"}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {proyectos.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/proyectos/${p.id}`}
                    className="block p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${semaforoColors[p.semaforo] ?? "bg-green-500"}`} />
                        <span className="text-sm font-semibold text-slate-800 truncate">{p.nombre}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-500 tabular-nums">{p.totalUnidades} uds</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                    <ProgressBar
                      label=""
                      reported={p.progreso.porcentajeReportado}
                      approved={p.progreso.porcentajeAprobado}
                      semaforoColor={p.semaforo}
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Task breakdown + weekly summary */}
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
              <h2 className="font-bold text-slate-800 mb-4">Estado de tareas</h2>
              <div className="flex flex-col gap-3">
                {taskBreakdown.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${item.color} flex-shrink-0`} />
                    <span className="text-sm text-slate-600 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-800 tabular-nums">{item.value}</span>
                    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly summary */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
              <h2 className="font-bold text-slate-800 mb-3">Últimos 7 días</h2>
              {resumenSemanal.total === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Sin actividad esta semana</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-slate-600 flex-1">Aprobadas</span>
                    <span className="text-sm font-bold text-green-600 tabular-nums">{resumenSemanal.aprobadas}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm text-slate-600 flex-1">Reportadas</span>
                    <span className="text-sm font-bold text-blue-600 tabular-nums">{resumenSemanal.reportadas}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-slate-600 flex-1">Rechazadas</span>
                    <span className="text-sm font-bold text-red-600 tabular-nums">{resumenSemanal.rechazadas}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Require action */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Requieren tu aprobación</h2>
            <Link
              href="/dashboard/tareas"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todas
            </Link>
          </div>

          {tareasParaAprobar.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No hay tareas pendientes de aprobación</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tareasParaAprobar.map((t) => (
                <Link
                  key={t.id}
                  href={`/dashboard/tareas/${t.id}`}
                  className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${semaforoColors[t.semaforo] ?? "bg-green-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{t.nombre}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {t.proyecto} · {t.unidad}
                    </div>
                    {t.contratista && (
                      <div className="text-xs text-slate-400 truncate">{t.contratista}</div>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200">
                        <AlertTriangle className="w-3 h-3" />
                        Reportada
                      </span>
                      {t.diasRestantes < 0 && (
                        <span className="text-[10px] font-medium text-red-500">
                          {Math.abs(t.diasRestantes)}d atraso
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
