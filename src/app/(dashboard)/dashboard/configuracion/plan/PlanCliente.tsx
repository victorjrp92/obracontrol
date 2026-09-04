"use client";

import { useState } from "react";
import { AlertTriangle, Check, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import type { EstadoAcceso } from "@/lib/suscripcion";

/**
 * Pantalla de plan y facturación. Toda la plata la decide el servidor: aquí solo
 * se elige plan y período, y `/api/pagos/checkout` calcula el monto, lo firma y
 * devuelve la URL. El navegador nunca manda un precio.
 */

interface DefPlan {
  precioCentavos: number;
  limiteObras: number;
  nombre: string;
}

interface PagoVista {
  id: string;
  referencia: string;
  plan: string;
  periodoMeses: number;
  montoCentavos: number;
  metodo: string | null;
  estado: string;
  cubreHasta: string | null;
  fecha: string;
}

interface Props {
  planActual: string;
  tipoCuenta: string;
  acceso: EstadoAcceso;
  venceEl: string | null;
  pagos: PagoVista[];
  pagoDeVuelta: { referencia: string; estado: string } | null;
  pagosHabilitados: boolean;
  planes: Record<string, DefPlan>;
  /** Precios de prueba activos para ESTA cuenta: se cobran montos simbólicos. */
  preciosDePrueba: boolean;
  /** Techo del cobro cuando hay precios de prueba. El servidor aplica el mismo. */
  topeCentavos: number;
}

const ORDEN_PLANES = ["OBRA", "PROYECTO", "EMPRESA"];

/** Descuento por pagar por adelantado. Debe coincidir con PERIODOS_VALIDOS del API. */
const PERIODOS = [
  { meses: 1, etiqueta: "Mensual" },
  { meses: 6, etiqueta: "6 meses" },
  { meses: 12, etiqueta: "12 meses" },
];

function pesos(centavos: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  APROBADO: { texto: "Pagado", clase: "bg-emerald-50 text-emerald-700" },
  PENDIENTE: { texto: "En proceso", clase: "bg-amber-50 text-amber-700" },
  RECHAZADO: { texto: "Rechazado", clase: "bg-red-50 text-red-700" },
  ANULADO: { texto: "Anulado", clase: "bg-slate-100 text-slate-600" },
  ERROR: { texto: "Con error", clase: "bg-red-50 text-red-700" },
};

const METODO_LEGIBLE: Record<string, string> = {
  CARD: "Tarjeta",
  PSE: "PSE",
  NEQUI: "Nequi",
  BANCOLOMBIA_TRANSFER: "Bancolombia",
  DAVIPLATA: "DaviPlata",
};

export default function PlanCliente({
  planActual,
  acceso,
  venceEl,
  pagos,
  pagoDeVuelta,
  pagosHabilitados,
  planes,
  preciosDePrueba,
  topeCentavos,
}: Props) {
  const [periodoMeses, setPeriodoMeses] = useState(1);
  const [comprando, setComprando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function comprar(plan: string) {
    if (comprando) return; // single-flight: dos clics no crean dos cobros
    setError(null);
    setComprando(plan);
    try {
      const res = await fetch("/api/pagos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, periodoMeses }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error ?? "No pudimos abrir el pago. Intenta de nuevo.");
      }
      // Wompi cobra en su propio dominio y devuelve a /dashboard/configuracion/plan.
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos abrir el pago.");
      setComprando(null);
    }
  }

  const esGratuito = planActual === "PERSONAL";

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Vuelta desde Wompi */}
      {pagoDeVuelta && (
        <div
          className={`rounded-2xl p-4 text-sm ${
            pagoDeVuelta.estado === "APROBADO"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-amber-50 text-amber-900 border border-amber-200"
          }`}
        >
          {pagoDeVuelta.estado === "APROBADO" ? (
            <p className="font-semibold">Listo, tu pago quedó registrado. Ya puedes seguir trabajando.</p>
          ) : (
            <>
              <p className="font-semibold">Tu pago está en proceso.</p>
              <p className="mt-1">
                Con PSE la confirmación del banco puede tardar unos minutos. No hace falta que pagues otra vez:
                en cuanto llegue, tu plan se activa solo y verás el cobro como «Pagado» aquí abajo.
              </p>
            </>
          )}
        </div>
      )}

      {/* Estado actual */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tu plan</p>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              {planes[planActual]?.nombre ?? planActual}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {esGratuito ? (
                <>Plan gratuito. No vence — su límite es por número de obras.</>
              ) : acceso.permite ? (
                <>
                  {acceso.motivo === "prueba" ? "Prueba gratis" : "Activo"}
                  {venceEl && <> · vence el {fechaLarga(venceEl)}</>}
                </>
              ) : (
                <span className="text-red-700 font-semibold">
                  Vencido{venceEl && <> el {fechaLarga(venceEl)}</>}
                </span>
              )}
            </p>
          </div>
          {typeof acceso.diasRestantes === "number" && acceso.permite && (
            <div
              className={`rounded-xl px-4 py-2 text-center ${
                acceso.porVencer ? "bg-amber-50" : "bg-slate-50"
              }`}
            >
              <div
                className={`text-2xl font-extrabold ${
                  acceso.porVencer ? "text-amber-700" : "text-slate-800"
                }`}
              >
                {acceso.diasRestantes}
              </div>
              <div className="text-xs text-slate-500">
                {acceso.diasRestantes === 1 ? "día restante" : "días restantes"}
              </div>
            </div>
          )}
        </div>

        {!acceso.permite && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Tu suscripción venció. Puedes seguir entrando y viendo todo lo que ya está registrado, pero
              no podrás crear obras nuevas hasta que renueves.
            </p>
          </div>
        )}
        {acceso.permite && acceso.porVencer && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              {acceso.motivo === "prueba"
                ? "Se está acabando tu prueba. Elige un plan para no quedarte sin crear obras."
                : "Tu plan está por vencer. Renueva para no perder acceso."}
            </p>
          </div>
        )}
      </section>

      {/* Elegir período */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-bold text-slate-900">Elige tu plan</h3>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {PERIODOS.map((p) => (
              <button
                key={p.meses}
                type="button"
                onClick={() => setPeriodoMeses(p.meses)}
                aria-pressed={periodoMeses === p.meses}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  periodoMeses === p.meses ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {/* Si esto queda encendido por descuido, se vende el plan Empresa por
            mil pesos. Que se vea, y que se vea aquí: es la pantalla donde se
            compra. */}
        {preciosDePrueba && (
          <div className="mb-3 rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm text-amber-900">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Precios de prueba activos
            </p>
            <p className="mt-1">
              Los montos de abajo no son los precios reales: son cobros simbólicos para verificar la
              pasarela de pagos. El cobro es real y se debita de verdad.
            </p>
          </div>
        )}

        {!pagosHabilitados && (
          <div className="mb-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
            El pago en línea todavía no está habilitado en este entorno. Escríbenos y activamos tu plan a mano.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {ORDEN_PLANES.map((clave) => {
            const def = planes[clave];
            if (!def) return null;
            const esActual = clave === planActual && acceso.permite && acceso.motivo !== "prueba";
            // Mismo cálculo que `precioTotalCentavos` en el servidor, tope
            // incluido: lo que se muestra es exactamente lo que se va a cobrar.
            const bruto = def.precioCentavos * periodoMeses;
            const total = preciosDePrueba ? Math.min(bruto, topeCentavos) : bruto;
            const destacado = clave === "PROYECTO";

            return (
              <div
                key={clave}
                className={`rounded-2xl border p-5 flex flex-col ${
                  destacado ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900">{def.nombre}</h4>
                  {esActual && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5" /> Actual
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                    {pesos(def.precioCentavos)}
                  </div>
                  <div className="text-xs text-slate-500">COP / mes</div>
                  {periodoMeses > 1 && (
                    <div className="text-xs text-slate-600 mt-1">
                      {pesos(total)} por {periodoMeses} meses
                    </div>
                  )}
                </div>

                <ul className="mt-4 space-y-1.5 text-sm text-slate-700 flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    {def.limiteObras === 1 ? "1 obra activa" : `Hasta ${def.limiteObras} obras activas`}
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    Evidencia con foto, GPS y hora
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    Equipo y contratistas sin límite
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={() => comprar(clave)}
                  disabled={!pagosHabilitados || comprando !== null}
                  className={`mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    destacado
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-slate-300 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {comprando === clave ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Abriendo el pago…
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      {esActual ? "Renovar" : "Elegir"}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <p className="mt-3 text-xs text-slate-500">
          Pagas con tarjeta, PSE, Nequi o Bancolombia a través de Wompi, la pasarela de Bancolombia. Seiricon
          nunca ve ni guarda los datos de tu medio de pago.
        </p>
      </section>

      {/* Historial */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="font-bold text-slate-900 mb-3">Historial de pagos</h3>
        {pagos.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay pagos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Plan</th>
                  <th className="pb-2 font-semibold">Medio</th>
                  <th className="pb-2 font-semibold text-right">Monto</th>
                  <th className="pb-2 font-semibold text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => {
                  const et = ETIQUETA_ESTADO[p.estado] ?? {
                    texto: p.estado,
                    clase: "bg-slate-100 text-slate-600",
                  };
                  return (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="py-2.5 text-slate-700">{fechaLarga(p.fecha)}</td>
                      <td className="py-2.5 text-slate-700">
                        {planes[p.plan]?.nombre ?? p.plan}
                        {p.periodoMeses > 1 && (
                          <span className="text-slate-400"> · {p.periodoMeses} meses</span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {p.metodo ? (METODO_LEGIBLE[p.metodo] ?? p.metodo) : "—"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-800">
                        {pesos(p.montoCentavos)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${et.clase}`}>
                          {et.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
