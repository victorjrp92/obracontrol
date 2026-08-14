"use client";

import { useState } from "react";
import FiltroSeguridadJuntos from "./FiltroSeguridadJuntos";
import ActaWizardJuntos from "./ActaWizardJuntos";

interface FlujoDocumentarProps {
  /**
   * true cuando se llega con ?desde=afuera (desde la pantalla roja de
   * /revisar): el filtro ya se respondió y dio rojo, así que se entra
   * directo al wizard en modo "desde afuera" — con el recordatorio visible
   * de no volver a entrar por una foto.
   */
  modoAfueraInicial?: boolean;
}

/**
 * Flujo de /go/juntos/documentar: filtro de seguridad SIEMPRE primero. Si el
 * filtro corta en rojo, la pantalla roja ofrece «documentar desde afuera»,
 * que continúa este mismo flujo en modo afuera (fachada/exterior) sin pedirle
 * a la persona volver a entrar.
 */
export default function FlujoDocumentar({ modoAfueraInicial = false }: FlujoDocumentarProps) {
  const [fase, setFase] = useState<"filtro" | "wizard">(modoAfueraInicial ? "wizard" : "filtro");
  const [modoAfuera, setModoAfuera] = useState(modoAfueraInicial);

  if (fase === "filtro") {
    return (
      <FiltroSeguridadJuntos
        onPasar={() => setFase("wizard")}
        etiquetaContinuar="Documentar los daños"
        onDocumentarAfuera={() => {
          setModoAfuera(true);
          setFase("wizard");
        }}
      />
    );
  }
  return <ActaWizardJuntos modoAfuera={modoAfuera} />;
}
