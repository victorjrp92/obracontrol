"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Loader2, Upload, X } from "lucide-react";
import type { TipoProductoTecnico } from "@/generated/prisma";
import { formatearBytes, MAX_BYTES_POR_ARCHIVO, type EstadoCupo, type NivelUbicacion } from "@/lib/productos-tecnicos";
import { subirProducto, type ProductoApi } from "./logica/api-productos-tecnicos";
import { cabeEnCupo, cupoParaPintar } from "./logica/vista-cupo";
import { acceptDeTipo, etiquetaFormatos } from "./logica/vista-formatos";
import SelectorUbicacion, { type EdificioOpcion } from "./SelectorUbicacion";

const TITULOS: Record<TipoProductoTecnico, string> = {
  PLANO: "Subir plano",
  RENDER: "Subir render",
  REGISTRO_INICIAL: "Subir registro fotográfico",
};

export interface ProductoAReemplazar {
  id: string;
  nombre: string;
  pisoId: string | null;
  unidadId: string | null;
}

/**
 * El formulario de subida, en modal. Sirve tanto para "subir el primero" como
 * para "subir versión nueva" / "reemplazar" — la diferencia es `reemplazo`:
 * si viene, el archivo nuevo se ata al mismo plano/render (mismo id enviado
 * como `reemplaza_a`) y la ubicación se prellena con la que tenía.
 */
export default function SubidaProductoDialog({
  proyectoId,
  tipo,
  edificios,
  cupo,
  reemplazo,
  onCerrar,
  onSubido,
}: {
  proyectoId: string;
  tipo: TipoProductoTecnico;
  edificios: EdificioOpcion[];
  cupo: EstadoCupo;
  reemplazo?: ProductoAReemplazar | null;
  onCerrar: () => void;
  onSubido: (resultado: { producto: ProductoApi; cupo: EstadoCupo }) => void;
}) {
  const [nombre, setNombre] = useState(reemplazo?.nombre ?? "");
  const [descripcion, setDescripcion] = useState("");
  const [nivel, setNivel] = useState<NivelUbicacion>(
    reemplazo?.unidadId ? "UNIDAD" : reemplazo?.pisoId ? "PISO" : "OBRA",
  );
  const [pisoId, setPisoId] = useState<string | null>(reemplazo?.pisoId ?? null);
  const [unidadId, setUnidadId] = useState<string | null>(reemplazo?.unidadId ?? null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const vistaCupo = cupoParaPintar(cupo);
  const cabe = archivo ? cabeEnCupo(cupo, archivo.size) : true;

  function elegirArchivo(file: File | null) {
    setArchivo(file);
    setError(null);
    if (file && !nombre.trim()) {
      const sinExtension = file.name.replace(/\.[^.]+$/, "");
      setNombre(sinExtension);
    }
  }

  async function enviar() {
    setError(null);

    if (!nombre.trim()) {
      setError("Ponle un nombre.");
      return;
    }
    if (!archivo) {
      setError("Elige un archivo.");
      return;
    }
    if (nivel === "PISO" && !pisoId) {
      setError("Elige a qué piso pertenece.");
      return;
    }
    if (nivel === "UNIDAD" && !unidadId) {
      setError("Elige a qué unidad pertenece.");
      return;
    }
    if (!cabe) {
      setError(`Este archivo no cabe: quedan ${vistaCupo.restanteLegible} libres en la obra.`);
      return;
    }

    const form = new FormData();
    form.set("file", archivo);
    form.set("proyecto_id", proyectoId);
    form.set("tipo", tipo);
    form.set("nombre", nombre.trim());
    if (descripcion.trim()) form.set("descripcion", descripcion.trim());
    if (nivel === "PISO" && pisoId) form.set("piso_id", pisoId);
    if (nivel === "UNIDAD" && unidadId) form.set("unidad_id", unidadId);
    if (reemplazo) form.set("reemplaza_a", reemplazo.id);

    setEnviando(true);
    const resultado = await subirProducto(form);
    setEnviando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onSubido(resultado.datos);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-900">
            {reemplazo ? `Reemplazar «${reemplazo.nombre}»` : TITULOS[tipo]}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className={`rounded-xl px-3 py-2 text-xs font-medium ${
            vistaCupo.nivel === "critico"
              ? "bg-red-50 text-red-700"
              : vistaCupo.nivel === "aviso"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-50 text-slate-600"
          }`}>
            Cupo de la obra: {vistaCupo.usadoLegible} de {vistaCupo.limiteLegible} usados · quedan{" "}
            {vistaCupo.restanteLegible}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={tipo === "RENDER" ? "Fachada principal, vista aérea…" : "Planta arquitectónica nivel 1…"}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            />
          </div>

          {reemplazo ? (
            <p className="text-xs text-slate-500">
              Se sube como una versión nueva de este mismo plano; la anterior queda en el histórico.
            </p>
          ) : (
            <SelectorUbicacion
              edificios={edificios}
              nivel={nivel}
              pisoId={pisoId}
              unidadId={unidadId}
              onCambiar={(s) => {
                setNivel(s.nivel);
                setPisoId(s.pisoId);
                setUnidadId(s.unidadId);
              }}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Archivo</label>
            <button
              type="button"
              onClick={() => inputArchivoRef.current?.click()}
              className="flex items-center gap-2 text-sm text-slate-600 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl px-4 py-3 transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="truncate">{archivo ? archivo.name : "Elegir archivo…"}</span>
            </button>
            <input
              ref={inputArchivoRef}
              type="file"
              accept={acceptDeTipo(tipo)}
              className="hidden"
              onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-slate-400">
              {etiquetaFormatos(tipo)} · hasta {formatearBytes(MAX_BYTES_POR_ARCHIVO)} por archivo
            </p>
            {archivo && !cabe && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                No cabe: pesa {formatearBytes(archivo.size)} y quedan {vistaCupo.restanteLegible} libres.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="text-sm font-medium text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || (!!archivo && !cabe)}
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
            >
              {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
              {enviando ? "Subiendo…" : "Subir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
