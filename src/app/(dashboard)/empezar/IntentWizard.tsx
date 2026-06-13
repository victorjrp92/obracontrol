"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  X,
  Loader2,
  Sparkles,
  PartyPopper,
} from "lucide-react";
import type { TipoCuenta } from "@/generated/prisma";
import {
  TIPOS_OBRA,
  TIPOS_PROPIEDAD,
  ESPACIOS_PERSONAL,
  sugerirTareas,
  type TipoObra,
  type TipoPropiedad,
} from "@/lib/plantillas-personal";
import { crearObraPersonal } from "./actions";

interface TareaItem {
  nombre: string;
  tiempo_acordado_dias: number;
  on: boolean;
}

const TOTAL_PASOS = 4;

export default function IntentWizard({
  tipoCuenta,
  nombreUsuario,
  tituloInicial,
  subtituloInicial,
}: {
  tipoCuenta: TipoCuenta;
  nombreUsuario: string;
  tituloInicial: string;
  subtituloInicial: string;
}) {
  const router = useRouter();
  const esArquitecto = tipoCuenta === "ARQUITECTO";

  const [paso, setPaso] = useState(0);
  const [tipoObra, setTipoObra] = useState<TipoObra | null>(null);
  const [tipoPropiedad, setTipoPropiedad] = useState<TipoPropiedad | null>(null);
  const [nombreObra, setNombreObra] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [espacios, setEspacios] = useState<string[]>([]);
  const [espacioCustom, setEspacioCustom] = useState("");
  const [tareasPorEspacio, setTareasPorEspacio] = useState<Record<string, TareaItem[]>>({});
  const [nuevaTarea, setNuevaTarea] = useState<Record<string, string>>({});

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false);

  const primerNombre = nombreUsuario.split(" ")[0];

  // ── Navegación ──────────────────────────────────────────────────────────
  const puedeAvanzar = useMemo(() => {
    if (paso === 0) return tipoObra !== null;
    if (paso === 1) return tipoPropiedad !== null && nombreObra.trim().length >= 2;
    if (paso === 2) return espacios.length > 0;
    if (paso === 3) return Object.values(tareasPorEspacio).some((ts) => ts.some((t) => t.on));
    return true;
  }, [paso, tipoObra, tipoPropiedad, nombreObra, espacios, tareasPorEspacio]);

  function avanzar() {
    setError("");
    // Al entrar al paso de tareas, prellenamos sugerencias para cada espacio.
    if (paso === 2) {
      setTareasPorEspacio((prev) => {
        const next = { ...prev };
        for (const esp of espacios) {
          if (!next[esp]) {
            next[esp] = sugerirTareas(esp, tipoObra ?? "REFORMA").map((t) => ({ ...t, on: true }));
          }
        }
        // Limpiar espacios que ya no existen
        for (const key of Object.keys(next)) {
          if (!espacios.includes(key)) delete next[key];
        }
        return next;
      });
    }
    setPaso((p) => Math.min(p + 1, TOTAL_PASOS));
  }

  function retroceder() {
    setError("");
    setPaso((p) => Math.max(p - 1, 0));
  }

  // ── Espacios ──────────────────────────────────────────────────────────────
  function toggleEspacio(label: string) {
    setEspacios((prev) => (prev.includes(label) ? prev.filter((e) => e !== label) : [...prev, label]));
  }
  function agregarEspacioCustom() {
    const v = espacioCustom.trim();
    if (!v) return;
    if (!espacios.includes(v)) setEspacios((prev) => [...prev, v]);
    setEspacioCustom("");
  }

  // ── Tareas ──────────────────────────────────────────────────────────────
  function toggleTarea(esp: string, idx: number) {
    setTareasPorEspacio((prev) => ({
      ...prev,
      [esp]: prev[esp].map((t, i) => (i === idx ? { ...t, on: !t.on } : t)),
    }));
  }
  function cambiarDias(esp: string, idx: number, dias: number) {
    setTareasPorEspacio((prev) => ({
      ...prev,
      [esp]: prev[esp].map((t, i) => (i === idx ? { ...t, tiempo_acordado_dias: Math.max(1, dias || 1) } : t)),
    }));
  }
  function agregarTarea(esp: string) {
    const v = (nuevaTarea[esp] ?? "").trim();
    if (!v) return;
    setTareasPorEspacio((prev) => ({
      ...prev,
      [esp]: [...(prev[esp] ?? []), { nombre: v, tiempo_acordado_dias: 1, on: true }],
    }));
    setNuevaTarea((prev) => ({ ...prev, [esp]: "" }));
  }

  // ── Crear ──────────────────────────────────────────────────────────────
  async function crear() {
    setEnviando(true);
    setError("");
    setLimiteAlcanzado(false);

    const tareasPayload: Record<string, { nombre: string; tiempo_acordado_dias: number }[]> = {};
    for (const esp of espacios) {
      tareasPayload[esp] = (tareasPorEspacio[esp] ?? [])
        .filter((t) => t.on)
        .map((t) => ({ nombre: t.nombre, tiempo_acordado_dias: t.tiempo_acordado_dias }));
    }

    const res = await crearObraPersonal({
      tipoObra: tipoObra!,
      tipoPropiedad: tipoPropiedad!,
      nombreObra: nombreObra.trim(),
      clienteNombre: esArquitecto ? clienteNombre.trim() || undefined : undefined,
      espacios,
      tareasPorEspacio: tareasPayload,
    });

    if (res.ok) {
      router.push(`/dashboard/proyectos/${res.proyectoId}`);
      return;
    }
    setError(res.error);
    setLimiteAlcanzado(!!res.limiteAlcanzado);
    setEnviando(false);
  }

  const totalTareas = Object.values(tareasPorEspacio).reduce((acc, ts) => acc + ts.filter((t) => t.on).length, 0);

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
        {/* Encabezado */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-3 py-1 mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Asistente de obra
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {paso === 0 ? `Hola ${primerNombre}, ${tituloInicial.toLowerCase()}` : tituloInicial}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{subtituloInicial}</p>
        </div>

        {/* Progreso */}
        <div className="flex items-center gap-1.5 mb-6">
          {Array.from({ length: TOTAL_PASOS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full flex-1 transition-colors ${i <= paso ? "bg-blue-600" : "bg-slate-200"}`}
            />
          ))}
        </div>

        {error && (
          <div className={`mb-4 px-4 py-3 rounded-xl border text-sm ${limiteAlcanzado ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {error}
          </div>
        )}

        {/* ── Paso 0: ¿Qué vas a hacer? ─────────────────────────────────── */}
        {paso === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-slate-700">¿Qué quieres hacer?</p>
            {TIPOS_OBRA.map((t) => (
              <BigCard
                key={t.key}
                emoji={t.emoji}
                titulo={t.titulo}
                desc={t.desc}
                activo={tipoObra === t.key}
                onClick={() => setTipoObra(t.key)}
              />
            ))}
          </div>
        )}

        {/* ── Paso 1: Propiedad ─────────────────────────────────────────── */}
        {paso === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">¿Dónde es la obra?</p>
              <div className="grid grid-cols-2 gap-3">
                {TIPOS_PROPIEDAD.map((p) => (
                  <ChipGrande key={p.key} emoji={p.emoji} label={p.label} activo={tipoPropiedad === p.key} onClick={() => setTipoPropiedad(p.key)} />
                ))}
              </div>
            </div>

            {esArquitecto && (
              <Campo
                label="¿Para qué cliente? (opcional)"
                placeholder="Ej: Familia Gómez"
                value={clienteNombre}
                onChange={setClienteNombre}
              />
            )}

            <Campo
              label="Ponle un nombre a la obra"
              placeholder={esArquitecto ? "Ej: Remodelación apto Gómez" : "Ej: Remodelación de mi cocina"}
              value={nombreObra}
              onChange={setNombreObra}
              autoFocus
            />
          </div>
        )}

        {/* ── Paso 2: Espacios ──────────────────────────────────────────── */}
        {paso === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-slate-700">¿Qué espacios vas a intervenir?</p>
            <div className="flex flex-wrap gap-2">
              {ESPACIOS_PERSONAL.filter((e) => e.key !== "otro").map((e) => (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => toggleEspacio(e.label)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors cursor-pointer ${
                    espacios.includes(e.label)
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:border-blue-300"
                  }`}
                >
                  <span>{e.emoji}</span> {e.label}
                  {espacios.includes(e.label) && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>

            {/* Espacios personalizados ya agregados que no están en la lista */}
            {espacios.filter((e) => !ESPACIOS_PERSONAL.some((p) => p.label === e)).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {espacios
                  .filter((e) => !ESPACIOS_PERSONAL.some((p) => p.label === e))
                  .map((e) => (
                    <span key={e} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-blue-600 text-white text-sm font-medium">
                      {e}
                      <button type="button" onClick={() => toggleEspacio(e)} className="hover:opacity-70">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={espacioCustom}
                onChange={(e) => setEspacioCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregarEspacioCustom())}
                placeholder="Otro espacio (ej: Sótano)"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              <button
                type="button"
                onClick={agregarEspacioCustom}
                className="inline-flex items-center gap-1 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: Tareas por espacio ────────────────────────────────── */}
        {paso === 3 && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-slate-500">
              Te dejé sugerencias para cada espacio. Quita lo que no harás y agrega lo tuyo. Los días son un estimado que puedes ajustar.
            </p>
            {espacios.map((esp) => {
              const tareas = tareasPorEspacio[esp] ?? [];
              const espMeta = ESPACIOS_PERSONAL.find((e) => e.label === esp);
              return (
                <div key={esp} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <span>{espMeta?.emoji ?? "📍"}</span> {esp}
                  </div>
                  <div className="p-2 flex flex-col">
                    {tareas.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                        <button
                          type="button"
                          onClick={() => toggleTarea(esp, idx)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                            t.on ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                          }`}
                        >
                          {t.on && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <span className={`flex-1 text-sm ${t.on ? "text-slate-800" : "text-slate-400 line-through"}`}>{t.nombre}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            min={1}
                            value={t.tiempo_acordado_dias}
                            onChange={(e) => cambiarDias(esp, idx, parseInt(e.target.value))}
                            className="w-12 text-center text-xs border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <span className="text-[11px] text-slate-400">días</span>
                        </div>
                      </div>
                    ))}
                    {/* Agregar tarea */}
                    <div className="flex gap-2 px-2 py-2">
                      <input
                        value={nuevaTarea[esp] ?? ""}
                        onChange={(e) => setNuevaTarea((prev) => ({ ...prev, [esp]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregarTarea(esp))}
                        placeholder="Agregar otra tarea…"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                      <button
                        type="button"
                        onClick={() => agregarTarea(esp)}
                        className="inline-flex items-center px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Paso 4: Resumen ───────────────────────────────────────────── */}
        {paso === 4 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-blue-600 mb-3">
                <PartyPopper className="w-5 h-5" />
                <span className="font-semibold">¡Todo listo para crear tu obra!</span>
              </div>
              <dl className="text-sm divide-y divide-slate-100">
                <ResumenFila k="Obra" v={nombreObra} />
                {esArquitecto && clienteNombre && <ResumenFila k="Cliente" v={clienteNombre} />}
                <ResumenFila k="Tipo" v={TIPOS_PROPIEDAD.find((p) => p.key === tipoPropiedad)?.label ?? ""} />
                <ResumenFila k="Espacios" v={`${espacios.length} (${espacios.join(", ")})`} />
                <ResumenFila k="Tareas" v={`${totalTareas} en total`} />
              </dl>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Después podrás asignar {esArquitecto ? "contratistas" : "obreros"}, subir fotos y hacer seguimiento.
            </p>
          </div>
        )}

        {/* ── Botones ───────────────────────────────────────────────────── */}
        <div className="flex gap-3 mt-8">
          {paso > 0 && (
            <button
              type="button"
              onClick={retroceder}
              disabled={enviando}
              className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 px-5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
          )}
          {paso < TOTAL_PASOS ? (
            <button
              type="button"
              onClick={avanzar}
              disabled={!puedeAvanzar}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={crear}
              disabled={enviando}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {enviando ? "Creando tu obra…" : "Crear mi obra"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function BigCard({ emoji, titulo, desc, activo, onClick }: { emoji: string; titulo: string; desc: string; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-4 text-left p-4 rounded-2xl border transition-all cursor-pointer ${
        activo ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      <span className="text-3xl flex-shrink-0">{emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900 text-sm">{titulo}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${activo ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
        {activo && <Check className="w-3 h-3 text-white" />}
      </div>
    </button>
  );
}

function ChipGrande({ emoji, label, activo, onClick }: { emoji: string; label: string; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl border transition-all cursor-pointer ${
        activo ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-slate-200 bg-white hover:border-blue-300"
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm font-medium text-slate-800">{label}</span>
    </button>
  );
}

function Campo({ label, placeholder, value, onChange, autoFocus }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
      />
    </div>
  );
}

function ResumenFila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-slate-500 flex-shrink-0">{k}</dt>
      <dd className="text-slate-800 font-medium text-right">{v}</dd>
    </div>
  );
}
