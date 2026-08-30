"use client";

import { useMemo, useState } from "react";
import { AlertCircle, FileText, Image as ImageIcon, Plus, X } from "lucide-react";
import type { EstadoCupo } from "@/lib/productos-tecnicos";
import CupoBarra from "@/components/productos-tecnicos/CupoBarra";
import ListaPlanos from "@/components/productos-tecnicos/ListaPlanos";
import ListaRenders from "@/components/productos-tecnicos/ListaRenders";
import SubidaProductoDialog, {
  type ProductoAReemplazar,
} from "@/components/productos-tecnicos/SubidaProductoDialog";
import type { EdificioOpcion } from "@/components/productos-tecnicos/SelectorUbicacion";
import {
  marcarVersionVigente,
  obtenerUrlDescarga,
  type ProductoApi,
} from "@/components/productos-tecnicos/logica/api-productos-tecnicos";
import { aProductoParaVista } from "@/components/productos-tecnicos/logica/mapear-producto";
import {
  agruparPlanos,
  renderesVigentes,
  type ProductoParaVista,
  type PlanoAgrupado,
  type RenderVista,
} from "@/components/productos-tecnicos/logica/vista-planos";

type Pestana = "PLANOS" | "RENDERS";

export default function ProductosTecnicosClient({
  proyectoId,
  edificios,
  cupoInicial,
  productosIniciales,
  usuarioActualId,
  usuarioActualNombre,
}: {
  proyectoId: string;
  edificios: EdificioOpcion[];
  cupoInicial: EstadoCupo;
  productosIniciales: ProductoParaVista[];
  usuarioActualId: string;
  usuarioActualNombre: string;
}) {
  const [productos, setProductos] = useState<ProductoParaVista[]>(productosIniciales);
  const [cupo, setCupo] = useState<EstadoCupo>(cupoInicial);
  const [pestana, setPestana] = useState<Pestana>("PLANOS");
  const [dialogo, setDialogo] = useState<{
    tipo: "PLANO" | "RENDER";
    reemplazo: ProductoAReemplazar | null;
  } | null>(null);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [urlsRenders, setUrlsRenders] = useState<Record<string, string>>({});
  const [cargandoRenderId, setCargandoRenderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planos = useMemo<PlanoAgrupado[]>(
    () => agruparPlanos(productos.filter((p) => p.tipo === "PLANO")),
    [productos],
  );
  const renders = useMemo<RenderVista[]>(
    () => renderesVigentes(productos.filter((p) => p.tipo === "RENDER")),
    [productos],
  );

  function integrarProductoSubido(producto: ProductoApi, nuevoCupo: EstadoCupo) {
    setCupo(nuevoCupo);
    const vista = aProductoParaVista(producto, {
      nombrePorId: new Map([[usuarioActualId, usuarioActualNombre]]),
      edificios,
    });
    setProductos((prev) => {
      const conAnteriorApagada = producto.reemplaza_a
        ? prev.map((p) => (p.id === producto.reemplaza_a ? { ...p, vigente: false } : p))
        : prev;
      return [...conAnteriorApagada, vista];
    });
    setDialogo(null);
  }

  async function descargar(id: string) {
    setError(null);
    setDescargandoId(id);
    const resultado = await obtenerUrlDescarga(id);
    setDescargandoId(null);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    window.open(resultado.datos.url, "_blank", "noopener,noreferrer");
  }

  async function usarEstaVersion(id: string) {
    setError(null);
    setRestaurandoId(id);
    const resultado = await marcarVersionVigente(id);
    setRestaurandoId(null);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    const { versiones } = resultado.datos;
    setProductos((prev) =>
      prev.map((p) => {
        const match = versiones.find((v) => v.id === p.id);
        return match ? { ...p, vigente: match.vigente } : p;
      }),
    );
  }

  async function cargarImagenRender(id: string) {
    setError(null);
    setCargandoRenderId(id);
    const resultado = await obtenerUrlDescarga(id);
    setCargandoRenderId(null);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setUrlsRenders((prev) => ({ ...prev, [id]: resultado.datos.url }));
  }

  function abrirSubidaPlano(reemplazo?: ProductoAReemplazar) {
    setDialogo({ tipo: "PLANO", reemplazo: reemplazo ?? null });
  }
  function abrirSubidaRender(reemplazo?: ProductoAReemplazar) {
    setDialogo({ tipo: "RENDER", reemplazo: reemplazo ?? null });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <CupoBarra estado={cupo} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setPestana("PLANOS")}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-colors ${
              pestana === "PLANOS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <FileText className="w-4 h-4" />
            Planos
            <span className="text-xs text-slate-400">{planos.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setPestana("RENDERS")}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-colors ${
              pestana === "RENDERS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Renders
            <span className="text-xs text-slate-400">{renders.length}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => (pestana === "PLANOS" ? abrirSubidaPlano() : abrirSubidaRender())}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {pestana === "PLANOS" ? "Subir plano" : "Subir render"}
        </button>
      </div>

      {pestana === "PLANOS" ? (
        <ListaPlanos
          planos={planos}
          descargandoId={descargandoId}
          restaurandoId={restaurandoId}
          onDescargar={descargar}
          onUsarEstaVersion={usarEstaVersion}
          onSubirVersionNueva={(plano) =>
            abrirSubidaPlano({ id: plano.id, nombre: plano.nombre, pisoId: plano.pisoId, unidadId: plano.unidadId })
          }
          onSubirPrimero={() => abrirSubidaPlano()}
        />
      ) : (
        <ListaRenders
          renders={renders}
          urls={urlsRenders}
          cargandoId={cargandoRenderId}
          onCargarImagen={cargarImagenRender}
          onReemplazar={(render) =>
            abrirSubidaRender({ id: render.id, nombre: render.nombre, pisoId: render.pisoId, unidadId: render.unidadId })
          }
          onSubirPrimero={() => abrirSubidaRender()}
        />
      )}

      {dialogo && (
        <SubidaProductoDialog
          proyectoId={proyectoId}
          tipo={dialogo.tipo}
          edificios={edificios}
          cupo={cupo}
          reemplazo={dialogo.reemplazo}
          onCerrar={() => setDialogo(null)}
          onSubido={({ producto, cupo: nuevoCupo }) => integrarProductoSubido(producto, nuevoCupo)}
        />
      )}
    </div>
  );
}
