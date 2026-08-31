import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import { Plus, Building2 } from "lucide-react";
import type { TipoCuenta } from "@/generated/prisma";

export const dynamic = "force-dynamic";

// Etiqueta + color del tipo de cuenta para distinguir de un vistazo.
const TIPO_CUENTA_BADGE: Record<TipoCuenta, { label: string; cls: string }> = {
  CONSTRUCTORA: { label: "Empresa", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  CONTRATISTA: { label: "Contratista", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  ARQUITECTO: { label: "Arquitecto", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  PROPIETARIO: { label: "Propietario", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default async function ConstructorasPage() {
  const constructoras = await prisma.constructora.findMany({
    where: { nombre: { not: "Sistema Seiricon" } },
    include: {
      _count: { select: { proyectos: true, usuarios: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return (
    <>
      <Topbar title="Constructoras" subtitle="Gestión global de empresas en el sistema" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-slate-500">
            {constructoras.length} cuentas ·{" "}
            {constructoras.filter((c) => c.tipo_cuenta === "CONSTRUCTORA").length} empresas ·{" "}
            {constructoras.filter((c) => c.tipo_cuenta === "CONTRATISTA").length} contratistas ·{" "}
            {constructoras.filter((c) => c.tipo_cuenta === "ARQUITECTO").length} arquitectos ·{" "}
            {constructoras.filter((c) => c.tipo_cuenta === "PROPIETARIO").length} propietarios
          </p>
          <Link
            href="/super-admin/constructoras/nueva"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Nueva constructora
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {constructoras.map((c) => (
            <Link
              key={c.id}
              href={`/super-admin/constructoras/${c.id}`}
              className="bg-white border border-slate-100 hover:border-red-200 hover:shadow-md rounded-2xl p-5 transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{c.nombre}</div>
                  <div className="text-xs text-slate-500">{c.ciudad ?? "Sin ciudad"}</div>
                </div>
                <span
                  className={`ml-auto flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TIPO_CUENTA_BADGE[c.tipo_cuenta].cls}`}
                >
                  {TIPO_CUENTA_BADGE[c.tipo_cuenta].label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="text-slate-400">Proyectos</div>
                  <div className="font-bold text-slate-800 text-base">{c._count.proyectos}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="text-slate-400">Usuarios</div>
                  <div className="font-bold text-slate-800 text-base">{c._count.usuarios}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-3">
                Plan: <span className="font-semibold text-slate-600">{c.plan_suscripcion}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
