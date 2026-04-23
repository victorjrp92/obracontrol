"use client";

import { useState } from "react";
import { Building2, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface EmpresaFormProps {
  initialData: {
    nombre: string;
    nit: string;
    logo_url: string | null;
    direccion: string;
    ciudad: string;
    telefono: string;
    sitio_web: string;
    descripcion: string;
  };
}

export default function EmpresaForm({ initialData }: EmpresaFormProps) {
  const [nombre, setNombre] = useState(initialData.nombre);
  const [nit, setNit] = useState(initialData.nit);
  const [direccion, setDireccion] = useState(initialData.direccion);
  const [ciudad, setCiudad] = useState(initialData.ciudad);
  const [telefono, setTelefono] = useState(initialData.telefono);
  const [sitioWeb, setSitioWeb] = useState(initialData.sitio_web);
  const [descripcion, setDescripcion] = useState(initialData.descripcion);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/constructora", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          nit,
          direccion,
          ciudad,
          telefono,
          sitio_web: sitioWeb,
          descripcion,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }

      setMessage({ type: "success", text: "Datos actualizados correctamente" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Error al guardar" });
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/configuracion"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a configuración
      </Link>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Datos de la constructora</h2>
            <p className="text-xs text-slate-500">Edita la información principal de tu empresa</p>
          </div>
        </div>

        {/* Datos principales */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-800 mb-2">Datos principales</legend>

          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-slate-700 mb-1.5">
              Nombre de la constructora
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="nit" className="block text-sm font-medium text-slate-700 mb-1.5">
              NIT
            </label>
            <input
              id="nit"
              type="text"
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              className={inputClass}
              placeholder="Opcional"
            />
          </div>
        </fieldset>

        {/* Contacto */}
        <fieldset className="space-y-4 pt-4 border-t border-slate-100">
          <legend className="text-sm font-semibold text-slate-800 mb-2">Contacto</legend>

          <div>
            <label htmlFor="direccion" className="block text-sm font-medium text-slate-700 mb-1.5">
              Dirección
            </label>
            <input
              id="direccion"
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className={inputClass}
              placeholder="Ej: Cra 7 #45-12, Oficina 301"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ciudad" className="block text-sm font-medium text-slate-700 mb-1.5">
                Ciudad
              </label>
              <input
                id="ciudad"
                type="text"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className={inputClass}
                placeholder="Ej: Bogotá"
              />
            </div>

            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-slate-700 mb-1.5">
                Teléfono
              </label>
              <input
                id="telefono"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputClass}
                placeholder="Ej: +57 300 123 4567"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sitio_web" className="block text-sm font-medium text-slate-700 mb-1.5">
              Sitio web
            </label>
            <input
              id="sitio_web"
              type="url"
              value={sitioWeb}
              onChange={(e) => setSitioWeb(e.target.value)}
              className={inputClass}
              placeholder="https://www.ejemplo.com"
            />
          </div>
        </fieldset>

        {/* Descripción */}
        <fieldset className="space-y-4 pt-4 border-t border-slate-100">
          <legend className="text-sm font-semibold text-slate-800 mb-2">Descripción</legend>

          <div>
            <label htmlFor="descripcion" className="block text-sm font-medium text-slate-700 mb-1.5">
              Acerca de la empresa
            </label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              className={`${inputClass} resize-none`}
              placeholder="Breve descripción de la constructora..."
            />
          </div>
        </fieldset>

        {message && (
          <div
            className={`px-4 py-3 rounded-xl text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
