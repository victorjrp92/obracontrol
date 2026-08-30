import type { EstadoCupo } from "@/lib/productos-tecnicos";
import type { TipoProductoTecnico } from "@/generated/prisma";

/**
 * El único sitio del módulo que llama `fetch()`. Las rutas ya existen
 * (`src/app/api/productos-tecnicos/**`) — esto solo las envuelve para que
 * los componentes no repitan el parseo de la respuesta ni el manejo de error.
 */

/** La forma exacta de `CAMPOS_PUBLICOS`, tal como sale de la API en JSON. */
export interface ProductoApi {
  id: string;
  proyecto_id: string;
  piso_id: string | null;
  unidad_id: string | null;
  tipo: TipoProductoTecnico;
  nombre: string;
  descripcion: string | null;
  mime: string;
  bytes: number;
  version: number;
  vigente: boolean;
  reemplaza_a: string | null;
  subido_por_id: string;
  created_at: string;
}

export type ResultadoApi<T> = { ok: true; datos: T } | { ok: false; error: string; codigo?: string };

async function leerError(res: Response): Promise<{ error: string; codigo?: string }> {
  try {
    const cuerpo = await res.json();
    return { error: cuerpo.error ?? `Error ${res.status}`, codigo: cuerpo.codigo };
  } catch {
    return { error: `Error ${res.status}` };
  }
}

export async function subirProducto(form: FormData): Promise<ResultadoApi<{ producto: ProductoApi; cupo: EstadoCupo }>> {
  const res = await fetch("/api/productos-tecnicos", { method: "POST", body: form });
  if (!res.ok) {
    const { error, codigo } = await leerError(res);
    return { ok: false, error, codigo };
  }
  return { ok: true, datos: await res.json() };
}

export interface VersionResumen {
  id: string;
  version: number;
  vigente: boolean;
}

export async function marcarVersionVigente(
  id: string,
): Promise<ResultadoApi<{ producto: ProductoApi; versiones: VersionResumen[] }>> {
  const res = await fetch(`/api/productos-tecnicos/${id}/vigente`, { method: "PATCH" });
  if (!res.ok) {
    const { error, codigo } = await leerError(res);
    return { ok: false, error, codigo };
  }
  return { ok: true, datos: await res.json() };
}

export async function obtenerUrlDescarga(id: string): Promise<ResultadoApi<{ url: string }>> {
  const res = await fetch(`/api/productos-tecnicos/${id}/descarga`);
  if (!res.ok) {
    const { error, codigo } = await leerError(res);
    return { ok: false, error, codigo };
  }
  return { ok: true, datos: await res.json() };
}
