"use client";

import { useCallback, useEffect, useRef, useState, type SubmitEvent } from "react";
import { Check, House, Link as LinkIcon, X } from "lucide-react";

/** Audiencias válidas del modal (mismas de la API /api/lista-espera-go). */
export type AudienciaCupo = "propietario" | "contratista";

/** Detalle con el que un CTA pide abrir el modal. */
export interface AperturaCupo {
  origen: string;
  audiencia: AudienciaCupo;
  /** Botón que abrió el modal, para devolverle el foco al cerrar (en Safari
   *  los botones no reciben foco al click y document.activeElement es body). */
  abridor?: HTMLElement;
}

const EVENTO_ABRIR = "lgo-abrir-cupo";

/**
 * Abre el modal de lista de espera desde cualquier CTA de la landing.
 * Se comunica por CustomEvent para que las secciones (Server Components)
 * solo necesiten el botón cliente <CtaCupo/> y no un context provider.
 */
export function abrirModalCupo(detalle: AperturaCupo) {
  window.dispatchEvent(new CustomEvent<AperturaCupo>(EVENTO_ABRIR, { detail: detalle }));
}

const OBRAS_OPCIONES = ["1", "2 o 3", "4 o más"];

/**
 * Modal de la lista de espera de Seiricon Go ("Reserva tu cupo").
 * Accesible: role=dialog, foco al abrir, cierra con X y con Escape, devuelve
 * el foco al botón que lo abrió y bloquea el scroll del body mientras está
 * abierto. Honeypot `sitio_web` oculto (si un bot lo llena, la API responde
 * éxito falso). POST a /api/lista-espera-go con estado de éxito y de error
 * reintentable dentro del propio modal.
 */
export default function ModalCupo() {
  const [abierto, setAbierto] = useState(false);
  const [origen, setOrigen] = useState("");
  const [audiencia, setAudiencia] = useState<AudienciaCupo>("propietario");
  const [correo, setCorreo] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [obras, setObras] = useState(OBRAS_OPCIONES[0]);
  const [sitioWeb, setSitioWeb] = useState(""); // honeypot
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const abridorRef = useRef<HTMLElement | null>(null);

  // Apertura por CustomEvent desde los CTAs (guarda el botón para devolverle el foco)
  useEffect(() => {
    const onAbrir = (e: Event) => {
      const { detail } = e as CustomEvent<AperturaCupo>;
      abridorRef.current = detail.abridor ?? (document.activeElement as HTMLElement | null);
      setOrigen(detail.origen);
      setAudiencia(detail.audiencia);
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

  // Escape para cerrar + foco al panel + scroll del body bloqueado
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
          audiencia,
          respuesta: audiencia === "propietario" ? ciudad : obras,
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
      className="cupo-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <div
        className="cupo-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lgo-cupo-titulo"
        tabIndex={-1}
      >
        <button type="button" className="cupo-x" onClick={cerrar} aria-label="Cerrar">
          <X size={16} aria-hidden="true" />
        </button>

        {exito ? (
          <div className="cupo-exito" role="status">
            <span className="cupo-check">
              <Check size={22} strokeWidth={3} aria-hidden="true" />
            </span>
            <b>Cupo reservado.</b>
            <p>Te escribimos pronto al correo.</p>
          </div>
        ) : (
          <>
            <h3 id="lgo-cupo-titulo">Reserva tu cupo</h3>
            <p className="micro">Primera obra gratis · Sin tarjeta</p>

            <form onSubmit={enviar}>
              <div
                className="cupo-tarjetas"
                role="radiogroup"
                aria-label="¿Cuál es tu caso?"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={audiencia === "propietario"}
                  className={`cupo-tarjeta${audiencia === "propietario" ? " sel" : ""}`}
                  onClick={() => setAudiencia("propietario")}
                >
                  <House size={16} strokeWidth={2.2} aria-hidden="true" />
                  Construyo o remodelo mi inmueble
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={audiencia === "contratista"}
                  className={`cupo-tarjeta${audiencia === "contratista" ? " sel" : ""}`}
                  onClick={() => setAudiencia("contratista")}
                >
                  <LinkIcon size={16} strokeWidth={2.2} aria-hidden="true" />
                  Manejo obras de clientes
                </button>
              </div>

              <div className="cupo-campo">
                <label htmlFor="lgo-cupo-correo">Tu correo</label>
                <input
                  id="lgo-cupo-correo"
                  type="email"
                  required
                  maxLength={160}
                  // Mismo criterio que CORREO_RE del API (type=email solo no
                  // exige punto/TLD y el servidor devolvería 400)
                  pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              </div>

              {audiencia === "propietario" ? (
                <div className="cupo-campo">
                  <label htmlFor="lgo-cupo-ciudad">¿En qué ciudad o país vives?</label>
                  <input
                    id="lgo-cupo-ciudad"
                    type="text"
                    required
                    maxLength={200}
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                  />
                </div>
              ) : (
                <div className="cupo-campo">
                  <label htmlFor="lgo-cupo-obras">¿Cuántas obras manejas a la vez?</label>
                  <select
                    id="lgo-cupo-obras"
                    value={obras}
                    onChange={(e) => setObras(e.target.value)}
                  >
                    {OBRAS_OPCIONES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Honeypot: invisible para personas; si un bot lo llena, la API finge éxito */}
              <div className="cupo-hp" aria-hidden="true">
                <label htmlFor="lgo-cupo-web">Sitio web</label>
                <input
                  id="lgo-cupo-web"
                  type="text"
                  name="sitio_web"
                  tabIndex={-1}
                  autoComplete="off"
                  value={sitioWeb}
                  onChange={(e) => setSitioWeb(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-azul cupo-enviar" disabled={enviando}>
                {enviando ? "Reservando…" : "Reservar mi cupo"}
              </button>

              {/* Ley 1581: aviso de tratamiento de datos (mismo patrón que /contacto) */}
              <p className="cupo-legal">
                Al reservar tu cupo autorizas el tratamiento de tus datos según nuestra{" "}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer">
                  Política de privacidad
                </a>
                . Solo usaremos tu correo para avisarte del lanzamiento.
              </p>

              {error && (
                <p className="cupo-error" role="alert">
                  No pudimos reservar tu cupo. Revisa tu conexión e inténtalo de nuevo.
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
