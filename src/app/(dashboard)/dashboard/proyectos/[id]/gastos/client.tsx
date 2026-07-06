"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Loader2,
  Check,
  X,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Receipt,
  HandCoins,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";

// ─── Tipos compartidos con la page (server) ──────────────────────────────────
export type EstadoGasto = "REGISTRADO" | "APROBADO" | "RECHAZADO";

export interface GastoVista {
  id: string;
  descripcion: string;
  monto: number;
  estado: EstadoGasto;
  facturaUrl: string | null;
  fecha: string;
  espacioNombre: string | null;
  tareaNombre: string | null;
  registradoPor: string | null;
  aprobadoPor: string | null;
  material: string | null;
  cantidad: number | null;
  unidad: string | null;
  precioUnitario: number | null;
}

export interface AnticipoVista {
  id: string;
  monto: number;
  fecha: string;
  nota: string | null;
  entregadoA: string | null;
  registradoPor: string | null;
}

export interface OpcionEspacio {
  id: string;
  nombre: string;
}

export interface OpcionTarea {
  id: string;
  nombre: string;
  espacioNombre: string;
}

interface Receptor {
  id: string;
  nombre: string;
}

interface Props {
  proyectoId: string;
  presupuestoTotal: number | null;
  manoDeObra: number;
  puedeAprobar: boolean;
  gastos: GastoVista[];
  anticipos: AnticipoVista[];
  espacios: OpcionEspacio[];
  tareas: OpcionTarea[];
  receptores: Receptor[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

// Parsea un string con separadores de miles a entero (COP no usa decimales).
function parseMonto(s: string): number {
  const limpio = s.replace(/[^\d]/g, "");
  return limpio ? parseInt(limpio, 10) : 0;
}

function formatMiles(s: string): string {
  const n = parseMonto(s);
  return n ? new Intl.NumberFormat("es-CO").format(n) : "";
}

const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(iso));

const estadoStyle: Record<EstadoGasto, { label: string; cls: string }> = {
  REGISTRADO: { label: "Por aprobar", cls: "bg-amber-100 text-amber-700 border border-amber-200" },
  APROBADO: { label: "Aprobado", cls: "bg-green-100 text-green-700 border border-green-200" },
  RECHAZADO: { label: "Rechazado", cls: "bg-red-100 text-red-700 border border-red-200" },
};

export default function GastosClient({
  proyectoId,
  presupuestoTotal,
  manoDeObra,
  puedeAprobar,
  gastos,
  anticipos,
  espacios,
  tareas,
  receptores,
}: Props) {
  const router = useRouter();

  // ── Cálculos anti-robo (memoizados) ────────────────────────────────────────
  const sumaAprobados = useMemo(
    () => gastos.filter((g) => g.estado === "APROBADO").reduce((s, g) => s + g.monto, 0),
    [gastos],
  );
  const sumaAnticipos = useMemo(() => anticipos.reduce((s, a) => s + a.monto, 0), [anticipos]);

  // Vista 1: Presupuesto vs gastado
  // materiales aprobados + mano de obra (suma de precios de tareas)
  const gastadoTotal = sumaAprobados + manoDeObra;
  const pctUsado =
    presupuestoTotal && presupuestoTotal > 0
      ? Math.round((gastadoTotal / presupuestoTotal) * 100)
      : null;
  const sobrepasado = presupuestoTotal != null && gastadoTotal > presupuestoTotal;

  // Vista 2: Plata entregada vs sustentada
  // sin sustentar = anticipos − gastos aprobados (la alarma)
  const sinSustentar = sumaAnticipos - sumaAprobados;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* ── LAS 2 VISTAS QUE DAN PAZ (siempre arriba) ───────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Vista 1: Presupuesto vs gastado */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900">¿En qué va tu dinero?</h2>
          </div>
          {presupuestoTotal != null ? (
            <>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="text-2xl font-extrabold text-slate-900">{cop(gastadoTotal)}</div>
                  <div className="text-xs text-slate-500">de {cop(presupuestoTotal)} presupuestado</div>
                </div>
                {pctUsado != null && (
                  <div className={`text-2xl font-extrabold ${sobrepasado ? "text-red-600" : "text-slate-900"}`}>
                    {pctUsado}%
                  </div>
                )}
              </div>
              <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${sobrepasado ? "bg-red-500" : "bg-blue-600"}`}
                  style={{ width: `${Math.min(pctUsado ?? 0, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <div className="text-2xl font-extrabold text-slate-900 mb-1">{cop(gastadoTotal)}</div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Materiales (aprobados)</div>
              <div className="font-bold text-slate-800">{cop(sumaAprobados)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Mano de obra</div>
              <div className="font-bold text-slate-800">{cop(manoDeObra)}</div>
            </div>
          </div>

          {presupuestoTotal == null && (
            <p className="text-xs text-slate-400 mt-3">
              Agrega un presupuesto a la obra para ver cuánto te queda disponible.
            </p>
          )}
          {sobrepasado && (
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-600">
              <AlertTriangle className="w-4 h-4" /> Has superado el presupuesto en {cop(gastadoTotal - presupuestoTotal!)}.
            </div>
          )}
        </div>

        {/* Vista 2: Plata entregada vs sustentada (LA ALARMA) */}
        <div
          className={`rounded-2xl border p-5 ${
            sinSustentar > 0 ? "border-red-300 bg-red-50" : "border-green-200 bg-green-50/60"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            {sinSustentar > 0 ? (
              <ShieldAlert className="w-5 h-5 text-red-600" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-green-600" />
            )}
            <h2 className="font-bold text-slate-900">¿Te están sustentando?</h2>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div className="rounded-xl bg-white/70 p-3">
              <div className="text-xs text-slate-500">Has entregado</div>
              <div className="font-bold text-slate-800">{cop(sumaAnticipos)}</div>
            </div>
            <div className="rounded-xl bg-white/70 p-3">
              <div className="text-xs text-slate-500">Sustentó (aprobado)</div>
              <div className="font-bold text-slate-800">{cop(sumaAprobados)}</div>
            </div>
          </div>

          {sinSustentar > 0 ? (
            <div className="rounded-xl bg-red-600 text-white p-4 text-center">
              <div className="text-xs font-medium opacity-90">Sin sustentar</div>
              <div className="text-3xl font-extrabold">{cop(sinSustentar)}</div>
              <div className="text-xs mt-1 opacity-90">Nadie cobra sin factura. Solicita las cuentas.</div>
            </div>
          ) : (
            <div className="rounded-xl bg-green-600 text-white p-4 text-center">
              <div className="text-sm font-bold">Todo sustentado</div>
              <div className="text-xs mt-1 opacity-90">Cada peso entregado tiene factura aprobada.</div>
            </div>
          )}
        </div>
      </div>

      {/* ── REGISTRAR GASTO ─────────────────────────────────────────────────── */}
      <RegistrarGasto
        proyectoId={proyectoId}
        espacios={espacios}
        tareas={tareas}
        onDone={() => router.refresh()}
      />

      {/* ── LISTA DE GASTOS ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-5 h-5 text-slate-700" />
          <h2 className="font-bold text-slate-900">Tus gastos</h2>
          <span className="text-sm text-slate-400">{gastos.length}</span>
        </div>
        {gastos.length === 0 ? (
          <p className="text-sm text-slate-400 bg-white border border-slate-100 rounded-2xl p-6 text-center">
            Aún no hay gastos. Registra el primero con la foto de la factura.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {gastos.map((g) => (
              <GastoCard
                key={g.id}
                gasto={g}
                proyectoId={proyectoId}
                puedeAprobar={puedeAprobar}
                onDone={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── ANTICIPOS ───────────────────────────────────────────────────────── */}
      <Anticipos
        proyectoId={proyectoId}
        anticipos={anticipos}
        receptores={receptores}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

// ─── Registrar gasto ────────────────────────────────────────────────────────
function RegistrarGasto({
  proyectoId,
  espacios,
  tareas,
  onDone,
}: {
  proyectoId: string;
  espacios: OpcionEspacio[];
  tareas: OpcionTarea[];
  onDone: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [detallado, setDetallado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Foto factura
  const [facturaPath, setFacturaPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Campos
  const [montoStr, setMontoStr] = useState("");
  const [espacioId, setEspacioId] = useState("");
  const [tareaId, setTareaId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  // Detallado
  const [material, setMaterial] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("");
  const [precioUnitStr, setPrecioUnitStr] = useState("");

  function reset() {
    setFacturaPath(null);
    setPreview(null);
    setMontoStr("");
    setEspacioId("");
    setTareaId("");
    setDescripcion("");
    setMaterial("");
    setCantidad("");
    setUnidad("");
    setPrecioUnitStr("");
    setDetallado(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/proyectos/${proyectoId}/gastos/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error subiendo la factura");
      setFacturaPath(data.path);
      setPreview(URL.createObjectURL(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error subiendo la factura");
    } finally {
      setSubiendo(false);
    }
  }

  async function submit() {
    setError(null);
    const monto = parseMonto(montoStr);
    if (monto <= 0) {
      setError("Indica el monto del gasto.");
      return;
    }
    if (!descripcion.trim()) {
      setError("Escribe qué compraste (descripción corta).");
      return;
    }
    setEnviando(true);
    try {
      const body: Record<string, unknown> = {
        descripcion: descripcion.trim(),
        monto,
        espacio_id: espacioId || null,
        tarea_id: tareaId || null,
        factura_url: facturaPath,
      };
      if (detallado) {
        if (material.trim()) body.material = material.trim();
        const cant = cantidad ? parseFloat(cantidad.replace(",", ".")) : null;
        if (cant != null && !Number.isNaN(cant)) body.cantidad = cant;
        if (unidad.trim()) body.unidad = unidad.trim();
        const pu = parseMonto(precioUnitStr);
        if (pu > 0) body.precio_unitario = pu;
      }
      const res = await fetch(`/api/proyectos/${proyectoId}/gastos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error registrando el gasto");
      reset();
      setAbierto(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error registrando el gasto");
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl py-4 transition-colors"
      >
        <Plus className="w-5 h-5" /> Registrar un gasto
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-slate-900">Nuevo gasto</h2>
        <button onClick={() => { reset(); setAbierto(false); }} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* 1. Foto de la factura */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            Foto de la factura <span className="text-slate-400">(la prueba)</span>
          </label>
          {preview ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Factura" className="h-40 rounded-xl border border-slate-200 object-cover" />
              <button
                type="button"
                onClick={() => { setFacturaPath(null); setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}
                className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center ring-2 ring-white"
                aria-label="Quitar foto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="h-40 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFoto}
                disabled={subiendo}
                className="hidden"
              />
              {subiendo ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <>
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-xs font-medium">Toma la foto de la factura</span>
                </>
              )}
            </label>
          )}
        </div>

        {/* 2. Monto */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">¿Cuánto?</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
            <input
              inputMode="numeric"
              value={montoStr}
              onChange={(e) => setMontoStr(formatMiles(e.target.value))}
              placeholder="0"
              className="w-full pl-7 pr-3 py-3 rounded-xl border border-slate-200 text-lg font-bold focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
            />
          </div>
        </div>

        {/* 3. A qué espacio/tarea + descripción */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Espacio</label>
            <select
              value={espacioId}
              onChange={(e) => setEspacioId(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:border-blue-400 outline-none bg-white"
            >
              <option value="">— Sin asignar —</option>
              {espacios.map((es) => (
                <option key={es.id} value={es.id}>{es.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Tarea</label>
            <select
              value={tareaId}
              onChange={(e) => setTareaId(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:border-blue-400 outline-none bg-white"
            >
              <option value="">— Sin asignar —</option>
              {tareas.map((t) => (
                <option key={t.id} value={t.id}>{t.espacioNombre} · {t.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">¿Qué compraste?</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej. Cemento, cerámica cocina..."
            maxLength={300}
            className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:border-blue-400 outline-none"
          />
        </div>

        {/* Toggle detallar materiales */}
        <button
          type="button"
          onClick={() => setDetallado((d) => !d)}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 self-start"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${detallado ? "rotate-180" : ""}`} />
          Detallar materiales
        </button>

        {detallado && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Material</label>
              <input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="Ej. Cemento gris 50kg"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Cantidad</label>
              <input
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Unidad</label>
              <input
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="saco, m², bulto"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Precio por unidad</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  inputMode="numeric"
                  value={precioUnitStr}
                  onChange={(e) => setPrecioUnitStr(formatMiles(e.target.value))}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={enviando || subiendo}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          Guardar gasto
        </button>
      </div>
    </div>
  );
}

// ─── Tarjeta de gasto ─────────────────────────────────────────────────────────
function GastoCard({
  gasto,
  proyectoId,
  puedeAprobar,
  onDone,
}: {
  gasto: GastoVista;
  proyectoId: string;
  puedeAprobar: boolean;
  onDone: () => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const est = estadoStyle[gasto.estado];

  async function decidir(estado: "APROBADO" | "RECHAZADO") {
    setError(null);
    setTrabajando(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/gastos/${gasto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setTrabajando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col">
      {/* Foto grande = la prueba */}
      {gasto.facturaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gasto.facturaUrl} alt="Factura" className="w-full h-48 object-cover bg-slate-100" />
      ) : (
        <div className="w-full h-48 bg-slate-100 flex flex-col items-center justify-center text-slate-400">
          <Receipt className="w-8 h-8 mb-1" />
          <span className="text-xs">Sin factura</span>
        </div>
      )}

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xl font-extrabold text-slate-900">{cop(gasto.monto)}</div>
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${est.cls}`}>
            {est.label}
          </span>
        </div>

        <div className="text-sm font-medium text-slate-800">{gasto.descripcion}</div>

        <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
          {gasto.espacioNombre && (
            <span className="bg-slate-100 px-2 py-0.5 rounded-full">{gasto.espacioNombre}</span>
          )}
          {gasto.tareaNombre && (
            <span className="bg-slate-100 px-2 py-0.5 rounded-full">{gasto.tareaNombre}</span>
          )}
          <span>{fechaCorta(gasto.fecha)}</span>
        </div>

        {gasto.material && (
          <div className="text-xs text-slate-500">
            {gasto.material}
            {gasto.cantidad != null && ` · ${gasto.cantidad}${gasto.unidad ? " " + gasto.unidad : ""}`}
            {gasto.precioUnitario != null && ` · ${cop(gasto.precioUnitario)} c/u`}
          </div>
        )}

        {gasto.registradoPor && (
          <div className="text-[11px] text-slate-400">Lo registró {gasto.registradoPor}</div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Aprobación (solo dueño) */}
        {puedeAprobar && gasto.estado === "REGISTRADO" && (
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => decidir("APROBADO")}
              disabled={trabajando}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2"
            >
              {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprobar
            </button>
            <button
              onClick={() => decidir("RECHAZADO")}
              disabled={trabajando}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-60 text-red-600 text-sm font-semibold rounded-lg py-2"
            >
              <X className="w-4 h-4" /> Rechazar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Anticipos ────────────────────────────────────────────────────────────────
function Anticipos({
  proyectoId,
  anticipos,
  receptores,
  onDone,
}: {
  proyectoId: string;
  anticipos: AnticipoVista[];
  receptores: Receptor[];
  onDone: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [montoStr, setMontoStr] = useState("");
  const [entregadoA, setEntregadoA] = useState("");
  const [nota, setNota] = useState("");

  async function submit() {
    setError(null);
    const monto = parseMonto(montoStr);
    if (monto <= 0) {
      setError("Pon cuánto le entregaste.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/anticipos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto,
          entregado_a: entregadoA || null,
          nota: nota.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error registrando el anticipo");
      setMontoStr("");
      setEntregadoA("");
      setNota("");
      setAbierto(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error registrando el anticipo");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HandCoins className="w-5 h-5 text-slate-700" />
          <h2 className="font-bold text-slate-900">Plata que entregaste</h2>
        </div>
        {!abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600"
          >
            <Plus className="w-4 h-4" /> Registrar
          </button>
        )}
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 mb-4 rounded-xl bg-slate-50 p-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
            <input
              inputMode="numeric"
              value={montoStr}
              onChange={(e) => setMontoStr(formatMiles(e.target.value))}
              placeholder="¿Cuánto entregaste?"
              className="w-full pl-7 pr-3 py-3 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-400"
            />
          </div>
          <select
            value={entregadoA}
            onChange={(e) => setEntregadoA(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-blue-400"
          >
            <option value="">— ¿A quién? (opcional) —</option>
            {receptores.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional)"
            maxLength={300}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={enviando}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl py-2.5"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
            </button>
            <button
              onClick={() => { setAbierto(false); setError(null); }}
              className="px-4 rounded-xl border border-slate-200 text-slate-600 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {anticipos.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no has registrado anticipos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {anticipos.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="font-bold text-slate-800">{cop(a.monto)}</div>
                <div className="text-xs text-slate-500">
                  {a.entregadoA ? `Para ${a.entregadoA}` : "Sin destinatario"}
                  {a.nota ? ` · ${a.nota}` : ""}
                </div>
              </div>
              <div className="text-xs text-slate-400">{fechaCorta(a.fecha)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
