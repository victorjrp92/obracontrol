"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
// Del submódulo, no del barril: el barril reexporta el adaptador de Prisma y
// esto es un componente de cliente. `perfil-firma.ts` son rutas y validaciones.
import { EXTENSIONES_FIRMA, MATRICULA_LARGO_MAX } from "@/lib/documentos/perfil-firma";

interface Perfil {
  matricula: string | null;
  tieneImagen: boolean;
  imagenUrl?: string | null;
}

/**
 * El perfil de firma del profesional: imagen y matrícula, una sola vez.
 *
 * La matrícula que se guarda aquí es la VIGENTE. Cambiarla no altera ningún
 * documento ya firmado —allí quedó congelada la del día de la firma— y el texto
 * lo dice, porque es justo la duda que le va a dar a alguien al editarla.
 */
export default function PerfilDeFirma() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [matricula, setMatricula] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/documentos/perfil-firma")
      .then((r) => (r.ok ? r.json() : null))
      .then((datos: Perfil | null) => {
        if (!vivo || !datos) return;
        setPerfil(datos);
        setMatricula(datos.matricula ?? "");
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  async function subirImagen(archivo: File) {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("firma", archivo);
      const res = await fetch("/api/documentos/perfil-firma", { method: "POST", body: cuerpo });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos?.error ?? "No se pudo subir la imagen.");
        return;
      }
      setPerfil(datos as Perfil);
      setAviso("Imagen de firma guardada.");
    } catch {
      setError("No se pudo subir la imagen. Revisa tu conexión.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarMatricula() {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch("/api/documentos/perfil-firma", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos?.error ?? "No se pudo guardar la matrícula.");
        return;
      }
      setPerfil((previo) => ({ ...(previo ?? { tieneImagen: false }), ...datos }));
      setAviso("Matrícula guardada. Los documentos ya firmados no cambian.");
    } catch {
      setError("No se pudo guardar la matrícula. Revisa tu conexión.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-bold text-slate-900">Tu firma</h2>
      <p className="mt-1 text-sm text-slate-500">
        Se configura una vez y se usa en todos los documentos que emitas.
      </p>

      {/* ── Imagen de firma ────────────────────────────────────────────── */}
      <div className="mt-5">
        <p className="text-sm font-medium text-slate-700">Imagen de la firma</p>
        {perfil?.imagenUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={perfil.imagenUrl}
            alt="Tu firma"
            className="mt-2 h-20 w-auto rounded-lg border border-slate-100 bg-white p-2"
          />
        )}
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          <Upload className="h-4 w-4" />
          {perfil?.tieneImagen ? "Cambiar imagen" : "Subir imagen"}
          <input
            type="file"
            accept={EXTENSIONES_FIRMA.map((e) => `.${e}`).join(",")}
            className="hidden"
            disabled={guardando}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void subirImagen(archivo);
            }}
          />
        </label>
        <p className="mt-1.5 text-xs text-slate-400">
          PNG, JPG o WEBP, máximo 2 MB. Se guarda en privado y solo se muestra en tus documentos.
        </p>
      </div>

      {/* ── Matrícula ──────────────────────────────────────────────────── */}
      <div className="mt-6">
        <label htmlFor="matricula" className="block text-sm font-medium text-slate-700">
          Matrícula profesional
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="matricula"
            type="text"
            value={matricula}
            maxLength={MATRICULA_LARGO_MAX}
            onChange={(e) => setMatricula(e.target.value)}
            placeholder="Como aparece en tu tarjeta profesional"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
          <button
            type="button"
            onClick={guardarMatricula}
            disabled={guardando}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:bg-slate-300"
          >
            Guardar
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Queda impresa en cada documento y se congela al firmar: si la actualizas, los documentos
          ya emitidos siguen mostrando la que tenían.
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
      {aviso && <p className="mt-4 text-sm text-slate-600">{aviso}</p>}
    </section>
  );
}
