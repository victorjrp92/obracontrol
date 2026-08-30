"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ArrowLeft, Briefcase } from "lucide-react";
import Link from "next/link";

interface Cliente {
  id: string;
  nombre: string;
  nit: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [nit, setNit] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchClientes = useCallback(async () => {
    const res = await fetch("/api/clientes");
    if (res.ok) setClientes(await res.json());
    setLoading(false);
  }, []);

  // La carga inicial se envuelve en una función async en vez de llamar a
  // `fetchClientes()` suelto en el cuerpo del efecto. No es cosmética: deja
  // explícito que el `setState` llega DESPUÉS del await, no en cascada con el
  // render, que es justo lo que exige `react-hooks/set-state-in-effect`.
  useEffect(() => {
    void (async () => {
      await fetchClientes();
    })();
  }, [fetchClientes]);

  async function handleAdd() {
    if (!nombre.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), nit: nit.trim() || undefined, contacto: contacto.trim() || undefined, telefono: telefono.trim() || undefined, email: email.trim() || undefined }),
    });
    if (res.ok) {
      setNombre(""); setNit(""); setContacto(""); setTelefono(""); setEmail("");
      fetchClientes();
    } else {
      const data = await res.json();
      setError(data.error || "Error al crear cliente");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este cliente?")) return;
    setError("");
    const res = await fetch("/api/clientes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al eliminar");
      return;
    }
    fetchClientes();
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard/configuracion" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Configuración
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Clientes</h1>
            <p className="text-xs text-slate-500">Empresas externas que contratan proyectos</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Agregar cliente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la empresa" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">NIT</label>
              <input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="Ej: 900123456-1" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Contacto</label>
              <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Persona de contacto" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Teléfono</label>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 3001234567" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="empresa@ejemplo.com" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <button onClick={handleAdd} disabled={saving || !nombre.trim()} className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-xs cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            {saving ? "Guardando..." : "Agregar"}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Clientes registrados ({clientes.length})</h3>
          </div>
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-8">Cargando...</p>
          ) : clientes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No hay clientes registrados</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {clientes.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{c.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {[c.nit, c.contacto, c.telefono, c.email].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
