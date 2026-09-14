"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { formatearBytes } from "@/lib/productos-tecnicos";
import { obtenerUrlDescarga } from "@/components/productos-tecnicos/logica/api-productos-tecnicos";

/** Una fila de la lista, ya resuelta por el servidor (nombres y ubicación). */
export interface ProductoCampoItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  version: number;
  fecha: string;
  bytes: number;
  subidoPor: string | null;
  ubicacion: string;
}

interface Props {
  titulo: string;
  vacio: string;
  items: ProductoCampoItem[];
}

/**
 * Planos o renders de la obra, PARA MIRARLOS.
 *
 * Es la única parte cliente de esta pantalla y existe por una sola razón: la
 * URL del archivo se firma por cinco minutos (`api/productos-tecnicos/[id]/descarga`),
 * así que no se puede pintar con la página — para cuando alguien hace clic ya
 * habría caducado. Se pide en el momento del clic y se abre.
 *
 * Lo que NO hay aquí, y no es un olvido: subir, reemplazar, borrar y cambiar
 * qué versión es la vigente. El personal de campo construye con el plano, no
 * lo emite.
 */
export default function ListaProductosCampo({ titulo, vacio, items }: Props) {
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function abrir(id: string) {
    setAbriendo(id);
    setError("");
    const res = await obtenerUrlDescarga(id);
    setAbriendo(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // `noopener` siempre: la pestaña del archivo no tiene por qué poder tocar
    // la que la abrió.
    window.open(res.datos.url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-800">{titulo}</h2>
        <span className="text-xs text-slate-400">{items.length}</span>
      </div>

      {error && (
        <div className="mx-5 mt-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500 text-center">{vacio}</p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-9 h-9 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.nombre}</p>
                  {/* El número de versión va SIEMPRE visible: quien está en la
                      obra tiene que poder decir por teléfono con cuál está
                      construyendo. */}
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 flex-shrink-0">
                    v{item.version}
                  </span>
                </div>
                {item.descripcion && (
                  <p className="text-xs text-slate-500 truncate">{item.descripcion}</p>
                )}
                <p className="text-[11px] text-slate-400 truncate">
                  {item.ubicacion} · {formatearBytes(item.bytes)}
                  {item.subidoPor ? ` · ${item.subidoPor}` : ""} ·{" "}
                  {new Date(item.fecha).toLocaleDateString("es-CO")}
                </p>
              </div>

              <button
                onClick={() => abrir(item.id)}
                disabled={abriendo === item.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer flex-shrink-0"
              >
                {abriendo === item.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Abrir
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
