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
import { clasesBoton } from "@/components/ui/Boton";
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

/* Receta única del panel: superficie de datos, plana, con la línea fina del
   sistema. El `border-slate-100` de antes (1px, #f1f5f9) era casi invisible y
   dependía de una sombra difuminada para separarse del fondo; la línea de
   1.5px en --linea se ve por sí sola, que es lo que permite quitar la sombra. */
const PANEL = "bg-white rounded-tarjeta border-[1.5px] border-linea p-4 sm:p-5";

/* Fila de lista dentro de un panel. El sangrado negativo hace que la línea
   divisoria y el realce al pasar por encima lleguen al borde del panel: así se
   lee como UNA lista y no como tarjetas metidas dentro de otra tarjeta.
   A propósito NO trae utilidad de `display`: quien la usa pone la suya
   (`block` o `flex`). Si la trajera, cada llamada que necesita `flex` dejaría
   dos utilidades de display peleando en el mismo elemento y el ganador lo
   decidiría el orden interno del CSS de Tailwind, no lo que se lee aquí. */
const FILA =
  "group border-t border-linea first:border-t-0 -mx-4 px-4 sm:-mx-5 sm:px-5 hover:bg-azul-50 transition-colors";

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
        <p className="text-gris text-sm text-center max-w-sm">
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

        {/* Banner: proyectos sin ubicación.
            Es el patrón `.aviso` de la landing tal cual: ámbar-50 con borde
            ámbar-bde y texto ámbar-txt. El ámbar se queda porque en este
            producto ya significa «falta algo / está esperando». */}
        {mostrarBannerSinUbicacion && (
          <div className="mb-6 rounded-xl bg-ambar-50 border-[1.5px] border-ambar-bde px-4 py-3 flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-ambar-txt mt-0.5 flex-shrink-0" />
            {/* El ámbar se queda en el icono y en la frase de alarma; el
                cuerpo y los enlaces van en tinta. Pintarlo TODO de ámbar-txt
                —que es lo que hace `.aviso` en la landing— habría bajado el
                contraste de 6.84:1 (amber-800 sobre amber-50) a 4.69:1: pasa
                AA, pero es una pérdida gratuita. Así el texto que hay que leer
                sube a 17.5:1 y el tono ámbar no se pierde. */}
            <div className="text-[12.5px] font-semibold leading-relaxed text-tinta">
              <span className="font-extrabold text-ambar-txt">
                {proyectosSinUbicacion.length} proyecto{proyectosSinUbicacion.length === 1 ? "" : "s"} sin ubicación.
              </span>{" "}
              Agrégala para verlo{proyectosSinUbicacion.length === 1 ? "" : "s"} en el mapa:{" "}
              {proyectosSinUbicacion.map((p, i) => (
                <span key={p.id}>
                  <Link
                    href={`/dashboard/proyectos/${p.id}/editar`}
                    className="underline underline-offset-2 font-extrabold hover:text-ambar-txt"
                  >
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
          <div className={`mb-6 ${PANEL}`}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-azul" />
              <h2 className="font-extrabold tracking-[-0.02em] text-tinta">Mapa de obras</h2>
            </div>
            <MapaProyectos proyectos={proyectosMapa} hrefBase="/dashboard/proyectos" />
          </div>
        )}

        {/* Row 2: Projects + Task breakdown */}
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {/* Proyectos — lista de línea fina, no tarjeta dentro de tarjeta. */}
          <div className={`lg:col-span-2 ${PANEL}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold tracking-[-0.02em] text-tinta">Proyectos</h2>
              <Link
                href="/dashboard/proyectos"
                className="text-xs font-bold text-azul hover:text-tinta transition-colors flex items-center gap-1"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {proyectos.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gris mb-4">Sin proyectos activos</p>
                {/* Empty state: esto SÍ se pulsa, así que lleva el gesto
                    completo —pastilla de tinta con sombra dura que se hunde—. */}
                <Link
                  href={personal ? "/empezar" : "/dashboard/proyectos/nuevo"}
                  className={clasesBoton("principal", "chico")}
                >
                  {personal ? "Iniciar mi obra" : "Crear primer proyecto"}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col">
                {proyectos.map((p) => (
                  <Link key={p.id} href={`/dashboard/proyectos/${p.id}`} className={`${FILA} block py-3.5`}>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${semaforoColors[p.semaforo] ?? "bg-green-500"}`} />
                        <span className="text-sm font-bold text-tinta truncate">{p.nombre}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-gris tabular-nums">{p.totalUnidades} uds</span>
                        <ChevronRight className="w-4 h-4 text-gris-bde group-hover:text-azul transition-colors" />
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
            <div className={PANEL}>
              <h2 className="font-extrabold tracking-[-0.02em] text-tinta mb-4">Estado de tareas</h2>
              <div className="flex flex-col gap-3">
                {/* Los cuatro colores de estado NO se tocan: verde=aprobada,
                    azul=reportada, gris=pendiente, rojo=no aprobada es el
                    único código de color que el usuario ya tiene aprendido. */}
                {taskBreakdown.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${item.color} flex-shrink-0`} />
                    <span className="text-sm font-medium text-gris flex-1">{item.label}</span>
                    <span className="text-sm font-extrabold text-tinta tabular-nums">{item.value}</span>
                    <span className="w-16 h-1.5 rounded-full bg-linea overflow-hidden">
                      <span className={`block h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly summary */}
            <div className={PANEL}>
              <h2 className="font-extrabold tracking-[-0.02em] text-tinta mb-3">Últimos 7 días</h2>
              {resumenSemanal.total === 0 ? (
                <p className="text-sm text-gris text-center py-4">Sin actividad esta semana</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gris flex-1">Aprobadas</span>
                    <span className="text-sm font-extrabold text-green-600 tabular-nums">{resumenSemanal.aprobadas}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gris flex-1">Reportadas</span>
                    <span className="text-sm font-extrabold text-blue-600 tabular-nums">{resumenSemanal.reportadas}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gris flex-1">Rechazadas</span>
                    <span className="text-sm font-extrabold text-red-600 tabular-nums">{resumenSemanal.rechazadas}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Requieren tu aprobación.
            Era una rejilla de hasta 3 columnas de tarjetitas: cada dato iba
            truncado y el conjunto era tarjeta-dentro-de-tarjeta. Pasa a lista
            de ancho completo con línea fina: el nombre de la tarea y la obra
            dejan de cortarse, y la bandeja se lee de arriba abajo, que es como
            se trabaja una cola de aprobación. */}
        <div className={PANEL}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold tracking-[-0.02em] text-tinta">Requieren tu aprobación</h2>
            <Link
              href="/dashboard/tareas"
              className="text-xs font-bold text-azul hover:text-tinta transition-colors"
            >
              Ver todas
            </Link>
          </div>

          {tareasParaAprobar.length === 0 ? (
            <p className="text-sm text-gris text-center py-6">No hay tareas pendientes de aprobación</p>
          ) : (
            <div className="flex flex-col">
              {tareasParaAprobar.map((t) => (
                <Link key={t.id} href={`/dashboard/tareas/${t.id}`} className={`${FILA} flex items-start gap-3 py-3`}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-[7px] ${semaforoColors[t.semaforo] ?? "bg-green-500"}`} />
                  <div className="flex-1 min-w-0">
                    {/* El atraso va PEGADO al nombre, no empujado al otro
                        extremo: en una fila de ancho completo, «14d de atraso»
                        alineado a la derecha queda a más de mil píxeles de la
                        tarea que califica y deja de leerse como suyo.
                        El rojo se queda —ya significa problema— pero sube de
                        red-500 a red-600, que además de ser el --rojo del
                        sistema pasa AA (4.83:1; red-500 daba 3.76:1). */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-tinta truncate">{t.nombre}</span>
                      {t.diasRestantes < 0 && (
                        <span className="flex-shrink-0 text-[11px] font-extrabold text-red-600 tabular-nums">
                          {Math.abs(t.diasRestantes)}d de atraso
                        </span>
                      )}
                    </div>
                    {/* Aquí iba una pastilla «Reportada» en cada renglón. La
                        quité: getTareasParaAprobar filtra por
                        `estado: "REPORTADA"`, así que el chip era constante en
                        las seis filas y no distinguía ninguna de ninguna —el
                        título del panel ya dice que están esperando—. Repetir
                        un chip que nunca cambia enseña a no leer los chips, y
                        es justo el código de color que este producto no puede
                        permitirse gastar. El semáforo del punto sí varía y es
                        el que queda. */}
                    <div className="mt-0.5 text-xs font-medium text-gris truncate">
                      {t.proyecto} · {t.unidad}
                      {t.contratista ? ` · ${t.contratista}` : ""}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gris-bde group-hover:text-azul transition-colors flex-shrink-0 mt-1.5" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
