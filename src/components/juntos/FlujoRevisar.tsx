"use client";

import { useState } from "react";
import FiltroSeguridadJuntos from "./FiltroSeguridadJuntos";
import GrietaWizardJuntos from "./GrietaWizardJuntos";

/**
 * Flujo de /go/juntos/revisar: filtro de seguridad SIEMPRE primero (sin
 * datos), y solo si las 4 respuestas son "no" se monta el wizard de grietas.
 * El corte rojo lo pinta el propio filtro (PantallaRoja).
 */
export default function FlujoRevisar() {
  const [fase, setFase] = useState<"filtro" | "wizard">("filtro");

  if (fase === "filtro") {
    return <FiltroSeguridadJuntos onPasar={() => setFase("wizard")} etiquetaContinuar="Revisar la grieta" />;
  }
  return <GrietaWizardJuntos />;
}
