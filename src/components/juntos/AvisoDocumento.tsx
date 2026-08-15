"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { AVISO_DOCUMENTO, AVISO_DOCUMENTO_CORTO } from "@/lib/juntos/contenido-legal";

/**
 * Aviso compartido de «Juntos».
 *
 * En pantalla manda la versión CORTA: el aviso largo ocupaba cinco líneas en
 * el celular y a esa altura nadie lo lee — y un aviso que nadie lee no
 * protege a nadie. El texto completo queda a un toque («Por qué»), así que la
 * información sigue disponible y verificable, solo que no bloquea la lectura.
 * En el PDF va siempre el largo, donde el documento se lee con calma.
 */
export default function AvisoDocumento() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="aviso" role="note">
      <span style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
        <Info className="ic" style={{ marginTop: 2 }} aria-hidden="true" />
        <span>
          {AVISO_DOCUMENTO_CORTO}{" "}
          <button type="button" className="aviso-mas" onClick={() => setAbierto((v) => !v)}>
            {abierto ? "Ocultar" : "Por qué"}
          </button>
          {abierto && <span className="aviso-largo">{AVISO_DOCUMENTO}</span>}
        </span>
      </span>
    </div>
  );
}
