"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Elemento } from "@/lib/alerta/tipos";
import IlustracionElemento, { NOTA_ELEMENTO, type ElementoTarjeta } from "./IlustracionElemento";

const OPCIONES: { elemento: ElementoTarjeta; label: string }[] = [
  { elemento: "columna", label: "Columna" },
  { elemento: "viga", label: "Viga" },
  { elemento: "muro_carga", label: "Muro que sostiene la casa" },
  { elemento: "muro_divisorio", label: "Muro divisorio" },
  { elemento: "losa_techo", label: "Techo o losa" },
  { elemento: "piso", label: "Piso" },
  { elemento: "no_determinado", label: "No estoy seguro" },
];

interface UbicarGrietaJuntosProps {
  onSeleccionar: (elemento: Elemento) => void;
}

/**
 * Paso 1 del wizard de grietas: ¿dónde está la grieta? Siete tarjetas con
 * foto anotada del elemento (más el sello con su esquema) y nota de una línea. Nada preseleccionado; «No estoy seguro» siempre visible y
 * empujado (spec-go-juntos.md).
 */
export default function UbicarGrietaJuntos({ onSeleccionar }: UbicarGrietaJuntosProps) {
  const [seleccionado, setSeleccionado] = useState<ElementoTarjeta | null>(null);

  return (
    <div className="panel">
      <div>
        <h2>¿Dónde está la grieta?</h2>
        <p className="desc">Elige la foto que más se parezca a lo que ves en tu casa.</p>
      </div>

      <div className="opciones">
        {OPCIONES.map((op) => (
          <button
            key={op.elemento}
            type="button"
            onClick={() => setSeleccionado(op.elemento)}
            aria-pressed={seleccionado === op.elemento}
            className={`opcion ${seleccionado === op.elemento ? "sel" : ""}`}
          >
            <IlustracionElemento elemento={op.elemento} />
            {op.label}
            <small>{NOTA_ELEMENTO[op.elemento]}</small>
          </button>
        ))}
      </div>

      <p className="aviso">
        ¿No sabes si es &ldquo;muro que sostiene la casa&rdquo; o &ldquo;muro divisorio&rdquo;? El primero suele
        ser más grueso y hace parte de la estructura; el divisorio solo separa espacios. Si dudas, elige
        &ldquo;No estoy seguro&rdquo; — así no se subestima el resultado.
      </p>

      <div className="cta-abajo">
        <button
          type="button"
          onClick={() => seleccionado && onSeleccionar(seleccionado)}
          disabled={!seleccionado}
          className="btn btn-azul"
        >
          Siguiente <ArrowRight className="ic" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
