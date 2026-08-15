"use client";

import { CheckCircle2, FileText, Loader2 } from "lucide-react";

export interface DerechoPeticionControles {
  generando: boolean;
  error: string | null;
  onDescargar: () => void;
  /** Ya se descargó al menos una vez en esta sesión. */
  descargado: boolean;
}

interface CarpetaDocumentosProps {
  variante: "acta" | "informe";
  derechoPeticion: DerechoPeticionControles;
}

/**
 * Carpeta de documentos — lo primero que ve la persona tras descargar
 * (opción elegida por Victor entre tres).
 *
 * La idea: en vez de caer en un muro de texto, ve que tiene **1 de 2**. Un
 * documento a medias pide cerrarse, y eso convierte el derecho de petición de
 * dato escondido —antes vivía dentro de una tarjeta cerrada, nadie llegaba—
 * en la pieza que le falta. Cuando descarga el segundo, la carpeta se completa
 * y el foco pasa a la información legal.
 */
export default function CarpetaDocumentos({ variante, derechoPeticion }: CarpetaDocumentosProps) {
  const listos = derechoPeticion.descargado ? 2 : 1;
  const primerNombre = variante === "acta" ? "Acta de daños" : "Informe de grietas";

  return (
    <div className={`jt-carpeta ${derechoPeticion.descargado ? "completa" : ""}`}>
      <div className="carpeta-cab">
        <b>Tus documentos</b>
        <span>{listos} de 2</span>
      </div>
      <div className="carpeta-barra" aria-hidden="true">
        <i style={{ width: listos === 2 ? "100%" : "50%" }} />
      </div>

      <div className="doc-fila hecho">
        <span className="doc-ico" aria-hidden="true" />
        <span className="doc-txt">
          <b>{primerNombre}</b>
          <small>Para tu aseguradora</small>
        </span>
        <span className="doc-sello sello-ok">
          <CheckCircle2 style={{ width: 12, height: 12 }} aria-hidden="true" /> LISTA
        </span>
      </div>

      <div className={`doc-fila ${derechoPeticion.descargado ? "hecho" : "falta"}`}>
        <span className="doc-ico" aria-hidden="true" />
        <span className="doc-txt">
          <b>Derecho de petición</b>
          <small>Para las ayudas del Estado</small>
        </span>
        <span className={`doc-sello ${derechoPeticion.descargado ? "sello-ok" : "sello-falta"}`}>
          {derechoPeticion.descargado ? (
            <>
              <CheckCircle2 style={{ width: 12, height: 12 }} aria-hidden="true" /> LISTO
            </>
          ) : (
            "TE FALTA"
          )}
        </span>
      </div>

      {derechoPeticion.error && <p className="error-inline">{derechoPeticion.error}</p>}

      {!derechoPeticion.descargado && (
        <>
          <button
            type="button"
            onClick={derechoPeticion.onDescargar}
            disabled={derechoPeticion.generando}
            className="btn btn-ambar"
          >
            {derechoPeticion.generando ? (
              <Loader2 className="ic" style={{ animation: "ljt-girar 1s linear infinite" }} />
            ) : (
              <FileText className="ic" aria-hidden="true" />
            )}
            {derechoPeticion.generando ? "Generando documento..." : "Descargar el que me falta"}
          </button>
          <p className="carpeta-pie">
            Ya está listo con tus datos · La alcaldía tiene 15 días hábiles para responderte
          </p>
        </>
      )}

      {derechoPeticion.descargado && (
        <p className="carpeta-pie carpeta-pie-ok">
          Ya tienes los dos. Fírmalos y radícalos juntos en el punto de atención de tu ciudad.
        </p>
      )}
    </div>
  );
}
