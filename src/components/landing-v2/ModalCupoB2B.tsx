"use client";

import { useCallback, useEffect, useRef, useState, type SubmitEvent } from "react";
import { Check, X } from "lucide-react";

/** Detalle con el que un CTA pide abrir el modal. */
export interface AperturaCupoB2B {
  origen: string;
  /** Botón que abrió el modal, para devolverle el foco al cerrar. */
  abridor?: HTMLElement;
}

const EVENTO_ABRIR = "lv2-abrir-cupo";

/** Abre el modal desde cualquier CTA de la landing B2B. */
export function abrirModalCupoB2B(detalle: AperturaCupoB2B) {
  window.dispatchEvent(new CustomEvent<AperturaCupoB2B>(EVENTO_ABRIR, { detail: detalle }));
}

/** La pregunta segmentadora: sus tramos son exactamente los de los planes. */
const OBRAS_OPCIONES = ["1 obra", "2 o 3 obras", "4 a 15 obras", "Más de 15"];

/**
 * Lista de espera de Seiricon B2B — «Reserva tu cupo».
 *
 * POR QUÉ EXISTE: mientras la pasarela de pagos no esté viva, «Empezar gratis»
 * crea una cuenta que se queda con el plan superior sin vencimiento. Cada
 * registro de hoy es una conversación incómoda dentro de tres meses. Una lista
 * captura el mismo interés, lo deja calificado y permite estrenar al cliente
 * con un precio real cuando Wompi esté arriba.
 *
 * Reutiliza `/api/lista-espera-go` y su tabla con `audiencia: "constructora"`:
 * es el mismo hecho de negocio (alguien levantó la mano antes de que hubiera
 * producto que venderle) y no merecía una tabla aparte.
 *
 * Mismo patrón que el modal de Go: CustomEvent, para que las secciones sigan
 * siendo Server Components y solo el botón sea cliente. Accesible: role=dialog,
 * foco al abrir, cierra con Escape y con clic fuera, devuelve el foco al botón
 * y bloquea el scroll del body. Honeypot `sitio_web`.
 */
export default function ModalCupoB2B() {
  const [abierto, setAbierto] = useState(false);
  const [origen, setOrigen] = useState("");
  const [correo, setCorreo] = useState("");
  const [obras, setObras] = useState(OBRAS_OPCIONES[0]);
  const [sitioWeb, setSitioWeb] = useState(""); // honeypot
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const abridorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onAbrir = (e: Event) => {
      const { detail } = e as CustomEvent<AperturaCupoB2B>;
      abridorRef.current = detail.abridor ?? (document.activeElement as HTMLElement | null);
      setOrigen(detail.origen);
      setExito(false);
      setError(false);
      setAbierto(true);
    };
    window.addEventListener(EVENTO_ABRIR, onAbrir);
    return () => window.removeEventListener(EVENTO_ABRIR, onAbrir);
  }, []);

  const cerrar = useCallback(() => {
    setAbierto(false);
    abridorRef.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!abierto) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", onKey);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, cerrar]);

  const enviar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(false);
    try {
      const res = await fetch("/api/lista-espera-go", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo,
          audiencia: "constructora",
          respuesta: obras,
          origen,
          sitio_web: sitioWeb,
        }),
      });
      if (!res.ok) throw new Error("respuesta no ok");
      setExito(true);
    } catch {
      setError(true);
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) return null;

  return (
    <div
      className="cupo2-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <div
        className="cupo2-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lv2-cupo-titulo"
        tabIndex={-1}
      >
        <button type="button" className="cupo2-x" onClick={cerrar} aria-label="Cerrar">
          <X style={{ width: 18, height: 18 }} aria-hidden="true" />
        </button>

        {exito ? (
          <div className="cupo2-exito">
            <span className="cupo2-check">
              <Check style={{ width: 26, height: 26 }} aria-hidden="true" />
            </span>
            <h3 id="lv2-cupo-titulo">Quedaste en la lista.</h3>
            <p>
              Te escribimos a <b>{correo}</b> para agendar una demo y armarte el plan según tus obras.
              No mandamos publicidad.
            </p>
            <button type="button" className="btn btn-borde" onClick={cerrar}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate>
            <h3 id="lv2-cupo-titulo">Reserva tu cupo</h3>
            <p className="cupo2-sub">
              Estamos entrando por grupos para acompañar bien a cada constructora. Déjanos tu correo y
              te contactamos para agendar una demo.
            </p>

            <div className="cupo2-campo">
              <label htmlFor="lv2-cupo-correo">Tu correo</label>
              <input
                id="lv2-cupo-correo"
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoComplete="email"
                placeholder="tucorreo@empresa.com"
              />
            </div>

            <div className="cupo2-campo">
              <label htmlFor="lv2-cupo-obras">¿Cuántas obras llevas al tiempo?</label>
              <select id="lv2-cupo-obras" value={obras} onChange={(e) => setObras(e.target.value)}>
                {OBRAS_OPCIONES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            {/* Honeypot: señuelo oculto a humanos, visible a bots simples. */}
            <div className="cupo2-hp" aria-hidden="true">
              <label htmlFor="lv2-cupo-web">Sitio web</label>
              <input
                id="lv2-cupo-web"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={sitioWeb}
                onChange={(e) => setSitioWeb(e.target.value)}
              />
            </div>

            {error && (
              <p className="cupo2-error">
                No pudimos guardar tu correo. Intenta de nuevo en un momento.
              </p>
            )}

            <button type="submit" className="btn btn-azul" disabled={enviando}>
              {enviando ? "Guardando..." : "Reservar mi cupo"}
            </button>
            <p className="cupo2-micro">Sin compromiso. Te escribimos solo por esto.</p>
          </form>
        )}
      </div>
    </div>
  );
}
