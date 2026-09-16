import Link from "next/link";
import {
  Building2,
  FileText,
  FolderKanban,
  Globe,
  MapPin,
  Pencil,
  Phone,
  Users,
} from "lucide-react";

/**
 * Ficha de la constructora, como SECCIÓN del perfil.
 *
 * Antes era la pestaña «Empresa» del menú lateral. Lo que muestra —NIT,
 * dirección, datos de contacto— es configuración de la cuenta, no una zona de
 * trabajo diaria, así que ocupaba un sitio del menú que sí se usa.
 *
 * No duplica el formulario de edición: «Editar» sigue llevando al único
 * formulario que existe, /dashboard/configuracion/empresa (EmpresaForm), que es
 * quien habla con PATCH /api/constructora.
 *
 * Es sólo presentación: NO decide quién la ve. Esa condición vive en page.tsx
 * y es la misma que gobernaba la pestaña.
 */

interface EmpresaSeccionProps {
  nombre: string;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  sitioWeb: string | null;
  descripcion: string | null;
  totalUsuarios: number;
  proyectosActivos: number;
  /** El enlace a edición sólo se pinta si de verdad puede guardar. */
  puedeEditar: boolean;
}

/** Guion largo para los campos vacíos, igual que en el resto del perfil. */
const VACIO = "—";

export default function EmpresaSeccion({
  nombre,
  nit,
  direccion,
  ciudad,
  telefono,
  sitioWeb,
  descripcion,
  totalUsuarios,
  proyectosActivos,
  puedeEditar,
}: EmpresaSeccionProps) {
  return (
    // `scroll-mt` deja aire bajo la Topbar cuando se llega por el ancla
    // #empresa (el marcador viejo de /dashboard/empresa redirige aquí).
    <section id="empresa" className="scroll-mt-20">
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 truncate">{nombre}</h3>
              <p className="text-xs text-slate-500">NIT: {nit || VACIO}</p>
            </div>
          </div>
          {puedeEditar && (
            <Link
              href="/dashboard/configuracion/empresa"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Dirección</div>
              <div className="text-sm text-slate-800">{direccion || VACIO}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Ciudad</div>
              <div className="text-sm text-slate-800">{ciudad || VACIO}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Teléfono</div>
              <div className="text-sm text-slate-800">{telefono || VACIO}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Globe className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Sitio web</div>
              {sitioWeb ? (
                <a
                  href={sitioWeb}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  {sitioWeb}
                </a>
              ) : (
                <div className="text-sm text-slate-800">{VACIO}</div>
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
            {descripcion || VACIO}
          </p>
        </div>

        {/* Cifras de la cuenta — superficie de datos: plana, línea fina. */}
        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">Usuarios</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{totalUsuarios}</div>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">Proyectos activos</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{proyectosActivos}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
