import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import StatCard from "@/components/dashboard/StatCard";
import { Building2, Users, FolderOpen, ClipboardList, ChevronRight, Plus } from "lucide-react";

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

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
