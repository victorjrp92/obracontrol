import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/data";
import { canManageUsers } from "@/lib/access";
import Topbar from "@/components/dashboard/Topbar";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  FileText,
  Users,
  FolderKanban,
  Pencil,
} from "lucide-react";

export default async function EmpresaProfilePage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (!canManageUsers(usuario.rol_ref.nivel_acceso)) redirect("/dashboard");

  const [totalUsuarios, proyectosActivos] = await Promise.all([
    prisma.usuario.count({
      where: { constructora_id: usuario.constructora_id },
    }),
    prisma.proyecto.count({
      where: { constructora_id: usuario.constructora_id, estado: "ACTIVO" },
    }),
  ]);

  const c = usuario.constructora;

  return (
    <>
      <Topbar title="Empresa" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl space-y-6">
          {/* Company info card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{c.nombre}</h2>
                  <p className="text-sm text-slate-500">
                    NIT: {c.nit || "\u2014"}
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/configuracion/empresa"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Dirección</div>
                  <div className="text-sm text-slate-800">
                    {c.direccion || "\u2014"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Ciudad</div>
                  <div className="text-sm text-slate-800">
                    {c.ciudad || "\u2014"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Teléfono</div>
                  <div className="text-sm text-slate-800">
                    {c.telefono || "\u2014"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Sitio web</div>
                  {c.sitio_web ? (
                    <a
                      href={c.sitio_web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {c.sitio_web}
                    </a>
                  ) : (
                    <div className="text-sm text-slate-800">{"\u2014"}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500">Descripción</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {c.descripcion || "\u2014"}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500">Usuarios</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{totalUsuarios}</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FolderKanban className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500">Proyectos activos</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{proyectosActivos}</div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
