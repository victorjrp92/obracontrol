"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Square } from "lucide-react";
import type { TarjetaLegal } from "@/lib/juntos/contenido-legal";

interface TarjetaGanchoProps {
  tarjeta: TarjetaLegal;
  /** Contenido extra al final del cuerpo (p. ej. puntos de atención + botón del derecho de petición). */
  extra?: ReactNode;
}

/**
 * Tarjeta-gancho cerrada estilo feed que INVITA AL CLICK (pedido explícito
 * del founder en spec-go-juntos.md): cifra ancla grande + gancho + «Toca para
 * ver cómo» + botón «+» con borde y sombra dura + microanimación de apertura
 * (grid-template-rows + fade). El contenido es EXACTO de contenido-legal.ts.
 */
export default function TarjetaGancho({ tarjeta, extra }: TarjetaGanchoProps) {
  const [abierta, setAbierta] = useState(false);
  const idCuerpo = useId();

  return (
    <article className={`gancho ${abierta ? "abierto" : ""}`}>
      <button
        type="button"
        className="gancho-cab"
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        onClick={() => setAbierta((v) => !v)}
      >
        <span className="gancho-ancla">{tarjeta.ancla}</span>
        <span className="gancho-txt">
          <b>{tarjeta.gancho}</b>
          <small>{tarjeta.subgancho}</small>
          <span className="gancho-toca">
            {abierta ? "Toca para cerrar" : "Toca para ver cómo"}
            <ChevronDown style={{ width: 13, height: 13, transform: abierta ? "rotate(180deg)" : undefined }} aria-hidden="true" />
          </span>
        </span>
        <span className="gancho-mas" aria-hidden="true">
          <ChevronDown style={{ width: 18, height: 18 }} />
        </span>
      </button>

      <div className="gancho-cuerpo" id={idCuerpo}>
        <div className="gancho-cuerpo-in">
          <div>
            <div className="gancho-contenido">
              {tarjeta.puntos.map((punto) => (
                <p key={punto} className="gancho-punto">
                  <Square className="ic" aria-hidden="true" />
                  <span>{punto}</span>
                </p>
              ))}
              {extra}
              <p className="gancho-cita">{tarjeta.cita}</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
