"use client";

import { useEffect, useState } from "react";
import {
  Share2,
  Copy,
  Check,
  Loader2,
  Link2,
  RefreshCw,
  Trash2,
} from "lucide-react";

/**
 * Compartir avance con el cliente (cuentas personales: Contratista B2C / Propietario).
 *
 * - Al montar hace GET del token activo del proyecto.
 * - Si existe: muestra el enlace `/c/{token}` + botón Copiar, Regenerar y Revocar.
 * - Si no existe: botón Generar enlace (POST).
 *
 * El backend ya valida sesión + tenant + rol (solo el dueño de la cuenta puede
 * gestionar el enlace), así que aquí solo orquestamos la UI.
 */
export default function CompartirAvanceCliente({
  proyectoId,
}: {
  proyectoId: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState<
    "generar" | "regenerar" | "revocar" | null
  >(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/proyectos/${proyectoId}/cliente-token`;

  const enlaceCompleto =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/c/${token}`
      : token
        ? `/c/${token}`
        : "";

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch(base);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (activo) setToken(data.token ?? null);
      } catch {
        if (activo) setError("No se pudo cargar el enlace.");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId]);

  async function generar(regenerar = false) {
    setAccion(regenerar ? "regenerar" : "generar");
    setError(null);
    try {
      const res = await fetch(`${base}${regenerar ? "?regenerar=1" : ""}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setToken(data.token);
      setCopiado(false);
    } catch {
      setError("No se pudo generar el enlace. Inténtalo de nuevo.");
    } finally {
      setAccion(null);
    }
  }

  async function revocar() {
    if (
      !window.confirm(
        "¿Seguro que quieres revocar el enlace? El cliente dejará de ver el avance.",
      )
    ) {
      return;
    }
    setAccion("revocar");
    setError(null);
    try {
      const res = await fetch(base, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setToken(null);
      setCopiado(false);
    } catch {
      setError("No se pudo revocar el enlace. Inténtalo de nuevo.");
    } finally {
      setAccion(null);
    }
  }

  function copiar() {
    if (!enlaceCompleto) return;
    navigator.clipboard.writeText(enlaceCompleto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Share2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900">
            Compartir avance con el cliente
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Genera un enlace de solo lectura para que tu cliente vea el progreso
            de la obra, sin necesidad de cuenta.
          </p>

          {cargando ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : token ? (
            <div className="mt-4">
              {/* Enlace + copiar */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <Link2 className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span className="truncate text-sm text-slate-600">
                    {enlaceCompleto}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copiar}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  {copiado ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>

              {/* Regenerar / Revocar */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => generar(true)}
                  disabled={accion !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  {accion === "regenerar" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Regenerar
                </button>
                <button
                  type="button"
                  onClick={revocar}
                  disabled={accion !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                >
                  {accion === "revocar" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Revocar
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Cualquiera con este enlace podrá ver el avance. Al regenerar, el
                enlace anterior dejará de funcionar.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => generar(false)}
              disabled={accion !== null}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {accion === "generar" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Generar enlace
            </button>
          )}

          {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
