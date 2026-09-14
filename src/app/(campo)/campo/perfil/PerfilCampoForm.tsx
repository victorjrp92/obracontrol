"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail, Phone, User } from "lucide-react";

interface Props {
  nombre: string;
  email: string;
  telefono: string | null;
}

/**
 * Los datos que el personal de campo SÍ pone él.
 *
 * La cuenta se la crea la empresa (`POST /api/usuarios` la abre en Supabase
 * Auth y Seiricon le manda la contraseña por correo), así que lo único que es
 * suyo es cómo se llama y por dónde se le localiza — y eso lo tiene que poder
 * corregir sin pedirle permiso a nadie: el administrador que lo dio de alta
 * escribió su nombre de oídas y su teléfono de una libreta.
 *
 * El correo no se edita porque es la identidad de la cuenta en Supabase Auth:
 * cambiarlo aquí desincronizaría el login. La contraseña tampoco se cambia
 * desde aquí — para eso está el flujo de recuperación, que es el mismo para
 * todos los roles.
 *
 * Reusa `PATCH /api/perfil`, la misma ruta que el perfil del dashboard. Lo
 * único que no se comparte es la pantalla, porque aquella vive dentro de
 * `(dashboard)`, la zona de administración de la que este rol está fuera.
 */
export default function PerfilCampoForm({ nombre: nombreInicial, email, telefono: telefonoInicial }: Props) {
  const router = useRouter();

  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState(telefonoInicial ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  const hayCambios = nombre !== nombreInicial || telefono !== (telefonoInicial ?? "");

  async function guardar() {
    // La API rechaza un nombre de menos de dos letras en silencio (lo ignora
    // y responde «Sin cambios»); avisarlo aquí evita el «guardé y no pasó nada».
    if (nombre.trim().length < 2) {
      setError("Escribe tu nombre completo.");
      return;
    }
    if (!hayCambios) return;

    setGuardando(true);
    setError("");
    setGuardado(false);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, telefono }),
      });
      if (res.ok) {
        setGuardado(true);
        router.refresh();
        setTimeout(() => setGuardado(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error ?? "No se pudo guardar");
      }
    } catch {
      setError("Error de red");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <h2 className="text-sm font-bold text-slate-800 mb-4">Mis datos</h2>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block" htmlFor="campo-nombre">
            <User className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
            Nombre completo
          </label>
          <input
            id="campo-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block" htmlFor="campo-email">
            <Mail className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
            Correo
          </label>
          <input
            id="campo-email"
            value={email}
            disabled
            className="w-full px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Es el correo con el que entras. Para cambiarlo, pídeselo a quien administra tu empresa.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block" htmlFor="campo-telefono">
            <Phone className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
            Teléfono
          </label>
          <input
            id="campo-telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Ej: +57 300 123 4567"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {guardado && (
        <div className="mt-4 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Cambios guardados
        </div>
      )}

      <div className="flex justify-end mt-5">
        <button
          onClick={guardar}
          disabled={!hayCambios || guardando}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm cursor-pointer transition-colors"
        >
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
