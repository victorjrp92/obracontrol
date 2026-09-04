import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProyectosMapaGlobal } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import StatCard from "@/components/dashboard/StatCard";
import MapaProyectos from "@/components/mapa/MapaProyectos";
import { Building2, Users, FolderOpen, ClipboardList, ChevronRight, Plus, MapPin, CreditCard } from "lucide-react";
import { estadoPreciosPrueba } from "@/lib/suscripcion";
import { wompiConfigurado, enProduccion } from "@/lib/pagos/wompi";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboard() {
  // "Sistema Seiricon" es la constructora-host de los Super Admin; no es cliente.
  const operationalFilter = { nombre: { not: "Sistema Seiricon" as string } };

  const [
    totalConstructoras,
    totalUsuarios,
    totalProyectos,
    totalTareas,
    constructoras,
  ] = await Promise.all([
    prisma.constructora.count({ where: operationalFilter }),
    prisma.usuario.count({ where: { rol_ref: { nivel_acceso: { not: "SUPER_ADMIN" } } } }),
    prisma.proyecto.count(),
    prisma.tarea.count(),
    prisma.constructora.findMany({
      where: operationalFilter,
      include: {
        _count: { select: { proyectos: true, usuarios: true } },
      },
      orderBy: { created_at: "desc" },
      take: 20,
    }),
  ]);

  const preciosPrueba = estadoPreciosPrueba();
  const cobroConfigurado = wompiConfigurado();
  const cobroEnProduccion = enProduccion();

  // Mapa global: TODAS las obras activas de la plataforma.
  const mapaGlobal = await getProyectosMapaGlobal();

  const stats = [
    { icon: Building2, iconColor: "text-red-600", iconBg: "bg-red-50", label: "Constructoras", value: String(totalConstructoras) },
    { icon: FolderOpen, iconColor: "text-blue-600", iconBg: "bg-blue-50", label: "Proyectos totales", value: String(totalProyectos) },
    { icon: Users, iconColor: "text-violet-600", iconBg: "bg-violet-50", label: "Usuarios totales", value: String(totalUsuarios) },
    { icon: ClipboardList, iconColor: "text-green-600", iconBg: "bg-green-50", label: "Tareas totales", value: String(totalTareas) },
  ];

  return (
    <>
      <Topbar title="Vista global del sistema" subtitle="Panel de Super Admin · Seiricon" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Estado del cobro. Es la única pantalla donde se puede ver si los
            precios de prueba están encendidos: la de plan solo avisa a quien le
            afecta, así que con una lista de correos acotada nadie más se
            enteraría de que siguen activos. */}
        <div
          className={`mb-6 rounded-2xl border p-4 sm:p-5 ${
            preciosPrueba.activo
              ? "border-amber-300 bg-amber-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start gap-3">
            <CreditCard
              className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                preciosPrueba.activo ? "text-amber-600" : "text-slate-400"
              }`}
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-sm">Estado del cobro</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>
                  Pasarela:{" "}
                  <strong>{cobroConfigurado ? "configurada" : "SIN configurar"}</strong>
                  {cobroConfigurado && (
                    <>
                      {" · "}
                      ambiente <strong>{cobroEnProduccion ? "producción (dinero real)" : "pruebas (sandbox)"}</strong>
                    </>
                  )}
                </li>
                <li>
                  Precios:{" "}
                  {preciosPrueba.activo ? (
                    <>
                      <strong className="text-amber-800">DE PRUEBA</strong>
                      {preciosPrueba.correos.length > 0 ? (
                        <> · solo para {preciosPrueba.correos.join(", ")}</>
                      ) : (
                        <> · <strong className="text-amber-800">para TODAS las cuentas</strong></>
                      )}
                    </>
                  ) : (
                    <strong>reales</strong>
                  )}
                </li>
              </ul>
              {preciosPrueba.activo && (
                <p className="mt-2 text-xs text-amber-900">
                  {preciosPrueba.correos.length === 0
                    ? "Cualquier cliente puede comprar el plan Empresa por $3.000. Acota PRECIOS_PRUEBA_CORREOS o apaga PRECIOS_PRUEBA."
                    : "Recuerda apagar PRECIOS_PRUEBA cuando termines de probar."}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* Mapa global: TODA la plataforma */}
        {mapaGlobal.length > 0 && (
          <div className="mb-6 bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-red-600" />
              <h2 className="font-bold text-slate-800">Mapa de obras — toda la plataforma</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {mapaGlobal.length} obra{mapaGlobal.length === 1 ? "" : "s"} activa{mapaGlobal.length === 1 ? "" : "s"} con ubicación, de todas las constructoras y cuentas.
            </p>
            <MapaProyectos proyectos={mapaGlobal} hrefBase="/super-admin/proyectos" />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-slate-800">Constructoras registradas</h2>
            <Link
              href="/super-admin/constructoras/nueva"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Nueva constructora
            </Link>
          </div>

          {constructoras.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">
              Aún no hay constructoras. Crea la primera para empezar.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {constructoras.map((c) => (
                <Link
                  key={c.id}
                  href={`/super-admin/constructoras/${c.id}`}
                  className="group flex items-center justify-between gap-3 bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-200 rounded-xl p-4 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 truncate group-hover:text-red-700">
                      {c.nombre}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {c.ciudad ?? "Sin ciudad"} · NIT {c.nit ?? "—"} · Plan {c.plan_suscripcion}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600 flex-shrink-0">
                    <span><b>{c._count.proyectos}</b> proyectos</span>
                    <span><b>{c._count.usuarios}</b> usuarios</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
