"use client";

import { useState } from "react";
import { CheckSquare, Square, ChevronDown, Loader2, CheckCircle2 } from "lucide-react";
import CameraCapture, { CapturedPhoto } from "@/components/evidencia/CameraCapture";

interface Unidad {
  id: string;
  nombre: string;
}

interface Edificio {
  id: string;
  nombre: string;
  unidades: Unidad[];
}

interface Proyecto {
  id: string;
  nombre: string;
  edificios: Edificio[];
}

interface SugerirTareaFormProps {
  proyectos: Proyecto[];
}

export default function SugerirTareaForm({ proyectos }: SugerirTareaFormProps) {
  const [proyectoId, setProyectoId] = useState("");
  const [edificioId, setEdificioId] = useState("");
  const [unidadesSeleccionadas, setUnidadesSeleccionadas] = useState<string[]>([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const proyectoActual = proyectos.find((p) => p.id === proyectoId) ?? null;
  const edificioActual = proyectoActual?.edificios.find((e) => e.id === edificioId) ?? null;
  const unidades = edificioActual?.unidades ?? [];

  function handleProyectoChange(id: string) {
    setProyectoId(id);
    setEdificioId("");
    setUnidadesSeleccionadas([]);
  }

  function handleEdificioChange(id: string) {
    setEdificioId(id);
    setUnidadesSeleccionadas([]);
  }

  function toggleUnidad(id: string) {
    setUnidadesSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  }

  function selectAllUnidades() {
    if (unidadesSeleccionadas.length === unidades.length) {
      setUnidadesSeleccionadas([]);
    } else {
      setUnidadesSeleccionadas(unidades.map((u) => u.id));
    }
  }

  function resetForm() {
    setProyectoId("");
    setEdificioId("");
    setUnidadesSeleccionadas([]);
    setNombre("");
    setDescripcion("");
    setPhotos([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!proyectoId || !nombre || unidadesSeleccionadas.length === 0) {
      setErrorMsg("Completa proyecto, nombre y selecciona al menos una unidad.");
      return;
    }

    setLoading(true);
    try {
      let foto_url: string | null = null;

      // Upload photo if provided
      if (photos.length > 0) {
        const fd = new FormData();
        fd.append("file", photos[0].blob, "sugerencia.jpg");
        const uploadRes = await fetch("/api/sugerencias/upload", {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          throw new Error(data.error ?? "Error subiendo la foto");
        }
        const uploadData = await uploadRes.json();
        foto_url = uploadData.path;
      }

      const res = await fetch("/api/sugerencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          edificio_id: edificioId || undefined,
          unidades: unidadesSeleccionadas,
          nombre,
          descripcion: descripcion || undefined,
          foto_url: foto_url ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar la sugerencia");

      setSuccess(true);
      resetForm();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al enviar la sugerencia");
    } finally {
      setLoading(false);
    }
  }

  if (proyectos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
        <p className="text-slate-500 text-sm">
          No tienes proyectos asignados para sugerir tareas.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
      {success && (
        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-600" />
          Sugerencia enviada correctamente. El equipo la revisará pronto.
        </div>
      )}

      {errorMsg && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Proyecto */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Proyecto <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              value={proyectoId}
              onChange={(e) => handleProyectoChange(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              required
            >
              <option value="">Seleccionar proyecto...</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* Edificio */}
        {proyectoActual && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Edificio / Bloque
            </label>
            <div className="relative">
              <select
                value={edificioId}
                onChange={(e) => handleEdificioChange(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                <option value="">Todos los edificios</option>
                {proyectoActual.edificios.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        )}

        {/* Unidades multi-select */}
        {unidades.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700">
                Unidades <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={selectAllUnidades}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {unidadesSeleccionadas.length === unidades.length
                  ? "Deseleccionar todas"
                  : "Seleccionar todas"}
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto flex flex-col gap-1">
              {unidades.map((u) => {
                const selected = unidadesSeleccionadas.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUnidad(u.id)}
                    className={`flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                      selected
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    {selected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    {u.nombre}
                  </button>
                );
              })}
            </div>
            {unidadesSeleccionadas.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                {unidadesSeleccionadas.length} unidad{unidadesSeleccionadas.length !== 1 ? "es" : ""} seleccionada{unidadesSeleccionadas.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Nombre de la tarea <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Instalación de cerámica en baño"
            required
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Descripción <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalla el trabajo que necesitas sugerir..."
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
          />
        </div>

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Foto de referencia <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <CameraCapture
            proyectoNombre={proyectoActual?.nombre}
            tareaNombre={nombre || undefined}
            maxPhotos={1}
            onChange={(p) => setPhotos(p)}
            initialPhotos={[]}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !proyectoId || !nombre || unidadesSeleccionadas.length === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            "Enviar sugerencia"
          )}
        </button>
      </form>
    </div>
  );
}
