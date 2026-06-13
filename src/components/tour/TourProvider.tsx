"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import type { TourDef, TourStep } from "./tours";

interface TourContextValue {
  start: (tour: TourDef) => void;
  isDone: (id: string) => boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour debe usarse dentro de <TourProvider>");
  return ctx;
}

const doneKey = (id: string) => `tour:done:${id}`;

/** Busca el primer elemento VISIBLE con ese data-tour (ignora copias ocultas). */
function findTarget(target: string): HTMLElement | null {
  const els = Array.from(
    document.querySelectorAll(`[data-tour="${target}"]`),
  ) as HTMLElement[];
  return els.find((e) => e.getBoundingClientRect().width > 0) ?? null;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [tour, setTour] = useState<TourDef | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step: TourStep | null = tour?.steps[index] ?? null;

  const recompute = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = findTarget(step.target);
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null); // sin objetivo visible → tarjeta centrada
    }
  }, [step]);

  useEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    if (!tour) return;
    const handler = () => recompute();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [tour, recompute]);

  const start = useCallback((t: TourDef) => {
    setIndex(0);
    setTour(t);
  }, []);

  const isDone = useCallback((id: string) => {
    try {
      return localStorage.getItem(doneKey(id)) === "1";
    } catch {
      return false;
    }
  }, []);

  const finish = useCallback(() => {
    if (tour) {
      try {
        localStorage.setItem(doneKey(tour.id), "1");
      } catch {
        /* localStorage no disponible */
      }
    }
    setTour(null);
    setIndex(0);
  }, [tour]);

  const next = useCallback(() => {
    if (!tour) return;
    if (index < tour.steps.length - 1) setIndex((i) => i + 1);
    else finish();
  }, [tour, index, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Cerrar con Escape
  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, finish, next, back]);

  return (
    <TourContext.Provider value={{ start, isDone }}>
      {children}
      {tour && step && (
        <TourOverlay
          step={step}
          rect={rect}
          index={index}
          total={tour.steps.length}
          onNext={next}
          onBack={back}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}

// ─── Overlay (spotlight + tooltip) ───────────────────────────────────────────

const PAD = 8;
const TT_W = 304;

function TourOverlay({
  step,
  rect,
  index,
  total,
  onNext,
  onBack,
  onSkip,
}: {
  step: TourStep;
  rect: DOMRect | null;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const esUltimo = index === total - 1;
  const centered = !rect || step.placement === "center";

  // Posición del tooltip respecto al objetivo, con clamping al viewport.
  let ttStyle: React.CSSProperties = {};
  if (!centered && rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const place = step.placement ?? "bottom";
    let top = rect.bottom + 12;
    let left = rect.left;
    if (place === "right") {
      left = rect.right + 12;
      top = rect.top;
    } else if (place === "left") {
      left = rect.left - TT_W - 12;
      top = rect.top;
    } else if (place === "top") {
      top = rect.top - 12 - 160;
      left = rect.left;
    }
    // Si no cabe a la derecha, manda abajo del objetivo.
    if (left + TT_W > vw - 8) left = Math.max(8, rect.left);
    if (left + TT_W > vw - 8) left = vw - TT_W - 8;
    left = Math.max(8, left);
    top = Math.max(8, Math.min(top, vh - 200));
    ttStyle = { position: "fixed", top, left, width: TT_W };
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* Capa que oscurece y bloquea interacción con la app */}
      <div className="absolute inset-0 bg-black/50" onClick={onSkip} />

      {/* Spotlight: recorta el hueco sobre el objetivo */}
      {rect && !centered && (
        <div
          className="absolute rounded-xl ring-2 ring-white/80 transition-all duration-200 pointer-events-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
          }}
        />
      )}

      {/* Tooltip / tarjeta */}
      <div
        className={
          centered
            ? "absolute inset-0 flex items-center justify-center p-4"
            : ""
        }
        style={centered ? undefined : ttStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 w-full max-w-sm">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3 className="font-bold text-slate-900 text-base">{step.title}</h3>
            <button
              onClick={onSkip}
              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
              aria-label="Cerrar guía"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>

          <div className="flex items-center justify-between mt-4">
            {/* Puntos de progreso */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-4 bg-blue-600" : "w-1.5 bg-slate-200"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                </button>
              )}
              <button
                onClick={onNext}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                {esUltimo ? "Entendido" : "Siguiente"}
                {!esUltimo && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {!esUltimo && (
            <button
              onClick={onSkip}
              className="block w-full text-center text-[11px] text-slate-400 hover:text-slate-600 mt-2 cursor-pointer"
            >
              Saltar guía
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
