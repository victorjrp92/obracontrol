"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Plus,
  Trash2,
} from "lucide-react";
import { ICONO_PROPIEDAD, IconBox } from "@/components/personal/icons";
import { TIPOS_PROPIEDAD } from "@/lib/plantillas-personal";
import { blobToDataUrl } from "@/lib/media/overlay";
import {
  MAX_BODY_BYTES,
  MAX_ESPACIOS,
  MAX_FOTOS,
  estimarBytesBase64,
  type ActaPayload,
  type TipoInmueble,
} from "@/lib/alerta/acta";
import ActaCameraCapture, { type CapturedPhotoActa } from "./ActaCameraCapture";

type Paso = "datos" | "espacios" | "resumen";

interface EspacioGuardado {
  id: string;
  nombre: string;
  nota: string;
  fotos: CapturedPhotoActa[];
}

/**
 * Estado y flujo completo del Acta de daños (/alerta/documentar), en un solo
 * client component (spec addendum F.0: `documentar/page.tsx` es server
 * component, todo el wizard vive acá). Todo en memoria del navegador — nada
 * se persiste hasta que el usuario pide el PDF o el correo.
 */
export default function ActaWizard() {
  const [paso, setPaso] = useState<Paso>("datos");

  // Paso 1 — datos básicos del inmueble.
  const [tipoInmueble, setTipoInmueble] = useState<TipoInmueble>("CASA");
  const [descripcionInmueble, setDescripcionInmueble] = useState("");

  // Paso 2 — espacios ya guardados + el espacio en edición.
  const [espacios, setEspacios] = useState<EspacioGuardado[]>([]);
  const [espacioKey, setEspacioKey] = useState(0);
  const [nombreActual, setNombreActual] = useState("");
  const [notaActual, setNotaActual] = useState("");
  const [fotosActual, setFotosActual] = useState<CapturedPhotoActa[]>([]);
  const [errorEspacio, setErrorEspacio] = useState<string | null>(null);

  // Paso 4 — generar PDF / enviar por correo.
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const [mostrarFormEmail, setMostrarFormEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState(""); // campo señuelo, ver spec addendum R3
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [errorEmail, setErrorEmail] = useState<string | null>(null);

  // ─── Topes globales (spec addendum R1) — se cuentan en vivo sumando TODAS las fotos, guardadas + en edición.
  const totalFotos = espacios.reduce((n, e) => n + e.fotos.length, 0) + fotosActual.length;
  const totalBytesBinarios =
    espacios.reduce((n, e) => n + e.fotos.reduce((m, f) => m + f.blob.size, 0), 0) +
    fotosActual.reduce((m, f) => m + f.blob.size, 0);
  const topeFotosAlcanzado = totalFotos >= MAX_FOTOS || estimarBytesBase64(totalBytesBinarios) >= MAX_BODY_BYTES;
  const puedeAgregarMasEspacios = espacios.length < MAX_ESPACIOS;

  function quitarEspacio(id: string) {
    setEspacios((prev) => {
      const objetivo = prev.find((e) => e.id === id);
      objetivo?.fotos.forEach((f) => URL.revokeObjectURL(f.preview));
      return prev.filter((e) => e.id !== id);
    });
  }

  /** Valida y guarda el espacio en edición en la lista. Devuelve false si hay error de validación. */
  function guardarEspacioActual(): boolean {
    const nombre = nombreActual.trim();
    if (!nombre) {
      setErrorEspacio("Ponle un nombre al espacio (ej: Cocina, Fachada, Habitación principal).");
      return false;
    }
    if (fotosActual.length === 0) {
      setErrorEspacio("Agrega al menos una foto de este espacio.");
      return false;
    }
    setEspacios((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nombre, nota: notaActual.trim(), fotos: fotosActual },
    ]);
    setNombreActual("");
    setNotaActual("");
    setFotosActual([]);
    setEspacioKey((k) => k + 1);
    setErrorEspacio(null);
    return true;
  }

  function handleAgregarOtroEspacio() {
    guardarEspacioActual();
  }

  function handleTerminarEspacios() {
    const hayContenidoSinGuardar = nombreActual.trim() !== "" || fotosActual.length > 0;
    if (hayContenidoSinGuardar) {
      if (!guardarEspacioActual()) return;
      setPaso("resumen");
      return;
    }
    if (espacios.length === 0) {
      setErrorEspacio("Agrega al menos un espacio con fotos antes de continuar.");
      return;
    }
    setPaso("resumen");
  }

  async function construirPayload(): Promise<ActaPayload> {
    const espaciosPayload = await Promise.all(
      espacios.map(async (e) => ({
        nombre: e.nombre,
        nota: e.nota.trim() || null,
        fotos: await Promise.all(e.fotos.map(async (f) => ({ dataUrl: await blobToDataUrl(f.blob) }))),
      }))
    );
    return {
      inmueble: { tipo: tipoInmueble, descripcion: descripcionInmueble.trim() },
      espacios: espaciosPayload,
    };
  }

  async function generarPdf() {
    if (generandoPdf) return; // single-flight: sin auth ni rate limit en el endpoint (addendum R3)
    setErrorPdf(null);
    setGenerandoPdf(true);
    try {
      const payload = await construirPayload();
      const res = await fetch("/api/alerta/acta-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No pudimos generar el acta en PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acta-de-danos-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorPdf(err instanceof Error ? err.message : "No pudimos generar el acta en PDF.");
    } finally {
      setGenerandoPdf(false);
    }
  }

  async function enviarPorCorreo(e: React.FormEvent) {
    e.preventDefault();
    if (enviandoEmail) return; // single-flight
    setErrorEmail(null);
    setEnviandoEmail(true);
    try {
      const payload = await construirPayload();
      const res = await fetch("/api/alerta/acta-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, email, honeypot }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos enviar el correo.");
      setEmailEnviado(true);
    } catch (err) {
      setErrorEmail(err instanceof Error ? err.message : "No pudimos enviar el correo.");
    } finally {
      setEnviandoEmail(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <IndicadorPaso paso={paso} />

      {paso === "datos" && (
        <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">¿Qué tipo de inmueble es?</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TIPOS_PROPIEDAD.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTipoInmueble(t.key)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                    tipoInmueble === t.key ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <IconBox Icon={ICONO_PROPIEDAD[t.key]} active={tipoInmueble === t.key} />
                  <span className="text-sm font-semibold text-slate-800">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="acta-descripcion" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Dirección o descripción del inmueble
            </label>
            <textarea
              id="acta-descripcion"
              value={descripcionInmueble}
              onChange={(e) => setDescripcionInmueble(e.target.value)}
              placeholder="Ej: Calle 5 #23-10, Barrio San Fernando, Cali"
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <p className="mt-1 text-xs text-slate-400">No se geocodifica ni se valida contra un mapa — es texto libre.</p>
          </div>

          <button
            type="button"
            onClick={() => setPaso("espacios")}
            disabled={!descripcionInmueble.trim()}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {paso === "espacios" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-500">
            <span>
              {totalFotos}/{MAX_FOTOS} fotos · {espacios.length}/{MAX_ESPACIOS} espacios
            </span>
          </div>

          {espacios.length > 0 && (
            <div className="flex flex-col gap-2">
              {espacios.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{e.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {e.fotos.length} foto{e.fotos.length !== 1 ? "s" : ""}
                      {e.nota ? ` · ${e.nota}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarEspacio(e.id)}
                    aria-label={`Quitar ${e.nombre}`}
                    className="flex-shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {puedeAgregarMasEspacios ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-sm font-bold text-slate-900">
                {espacios.length === 0 ? "Agrega el primer espacio dañado" : "Agrega otro espacio dañado"}
              </h2>

              <div>
                <label htmlFor="acta-espacio-nombre" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nombre del espacio
                </label>
                <input
                  id="acta-espacio-nombre"
                  type="text"
                  value={nombreActual}
                  onChange={(e) => setNombreActual(e.target.value)}
                  placeholder="Ej: Cocina, Fachada, Habitación principal"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Fotos del espacio</label>
                <ActaCameraCapture
                  key={espacioKey}
                  espacioNombre={nombreActual || "Espacio sin nombre"}
                  maxPhotos={MAX_FOTOS}
                  disabled={topeFotosAlcanzado}
                  onChange={setFotosActual}
                />
              </div>

              <div>
                <label htmlFor="acta-espacio-nota" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nota <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <textarea
                  id="acta-espacio-nota"
                  value={notaActual}
                  onChange={(e) => setNotaActual(e.target.value)}
                  placeholder="Ej: Grieta desde la esquina de la ventana hasta el piso"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              {errorEspacio && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorEspacio}</p>
              )}

              <button
                type="button"
                onClick={handleAgregarOtroEspacio}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Plus className="h-4 w-4" /> Agregar espacio y seguir con otro
              </button>
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Llegaste al máximo de {MAX_ESPACIOS} espacios por acta.
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPaso("datos")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Atrás
            </button>
            <button
              type="button"
              onClick={handleTerminarEspacios}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              Terminar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {paso === "resumen" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Resumen del acta</h2>
              <button
                type="button"
                onClick={() => setPaso("espacios")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Editar
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Inmueble</p>
              <p className="text-sm font-semibold text-slate-800">
                {TIPOS_PROPIEDAD.find((t) => t.key === tipoInmueble)?.label} — {descripcionInmueble}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {espacios.map((e) => (
                <div key={e.id} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-sm font-semibold text-slate-800">{e.nombre}</p>
                  {e.nota && <p className="mb-2 text-xs text-slate-500">{e.nota}</p>}
                  <div className="flex flex-wrap gap-2">
                    {e.fotos.map((f, i) => (
                      <img
                        key={i}
                        src={f.preview}
                        alt={`Foto ${i + 1} de ${e.nombre}`}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errorPdf && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorPdf}</p>}

          <button
            type="button"
            onClick={generarPdf}
            disabled={generandoPdf}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generandoPdf ? "Generando PDF..." : "Descargar acta en PDF"}
          </button>

          {!mostrarFormEmail && !emailEnviado && (
            <button
              type="button"
              onClick={() => setMostrarFormEmail(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Mail className="h-4 w-4" /> Enviarme una copia por correo
            </button>
          )}

          {mostrarFormEmail && !emailEnviado && (
            <form
              onSubmit={enviarPorCorreo}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <label htmlFor="acta-email" className="text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <input
                id="acta-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />

              {/* Honeypot: campo señuelo oculto a humanos, visible a bots simples (addendum R3). */}
              <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="acta-website">No llenar este campo</label>
                <input
                  id="acta-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {errorEmail && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorEmail}</p>}

              <button
                type="submit"
                disabled={enviandoEmail}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviandoEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {enviandoEmail ? "Enviando..." : "Enviar por correo"}
              </button>
            </form>
          )}

          {emailEnviado && (
            <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
              Te enviamos el acta a {email}.
            </div>
          )}

          <button
            type="button"
            onClick={() => setPaso("espacios")}
            className="inline-flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Atrás
          </button>

          {/* Flujo terminado (el acta ya está lista): única línea de puente a
              /repara. Nunca antes de este punto — ver PuenteRepara.tsx. */}
          {/* Puente al flujo de reparación: lo monta el build de Juntos (spec-go-juntos.md) */}
        </div>
      )}
    </div>
  );
}

function IndicadorPaso({ paso }: { paso: Paso }) {
  const pasos: { key: Paso; label: string }[] = [
    { key: "datos", label: "Inmueble" },
    { key: "espacios", label: "Espacios y fotos" },
    { key: "resumen", label: "Resumen" },
  ];
  const indiceActual = pasos.findIndex((p) => p.key === paso);

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
      {pasos.map((p, i) => (
        <span key={p.key} className="flex items-center gap-2">
          <span className={i <= indiceActual ? "font-semibold text-blue-600" : ""}>{p.label}</span>
          {i < pasos.length - 1 && <span className="text-slate-300">→</span>}
        </span>
      ))}
    </div>
  );
}
