"use client";

import Link from "next/link";
import { CheckCircle2, Download, Mail } from "lucide-react";
import {
  TARJETA_ANTIESTAFA,
  TARJETA_AYUDAS,
  TARJETA_CONJUNTOS,
  TARJETAS_SEGURO,
} from "@/lib/juntos/contenido-legal";
import { CONTACTO_EMAIL } from "@/components/alerta/config";
import TarjetaGancho from "./TarjetaGancho";
import PuntosAtencion from "./PuntosAtencion";
import AvisoDocumento from "./AvisoDocumento";
import CarpetaDocumentos, { type DerechoPeticionControles } from "./CarpetaDocumentos";

export type { DerechoPeticionControles };

interface PostDescargaProps {
  variante: "acta" | "informe";
  /** Ciudad del gate — enfoca el punto de atención del RUD. */
  ciudad?: string | null;
  /** Controles del derecho de petición prellenado. Ambos flujos lo tienen: el
   *  que revisa una grieta también puede necesitar pedir ayudas. */
  derechoPeticion?: DerechoPeticionControles | null;
}

/**
 * Pantalla post-descarga (paso final de ambos wizards, spec-go-juntos.md).
 *
 * Estructura elegida por Victor: primero la CARPETA («1 de 2» — el documento
 * que falta como hueco visible, no como dato escondido), y solo después la
 * información legal, anunciada con un titular grande para que se note que hay
 * valor más allá de la descarga. Las tarjetas llevan su «toca para ver»
 * asomado, para que se lean como tocables.
 */
export default function PostDescarga({
  variante,
  ciudad = null,
  derechoPeticion = null,
}: PostDescargaProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="exito-cab">
        <span className="exito-check">
          <CheckCircle2 style={{ width: 28, height: 28 }} aria-hidden="true" />
        </span>
        <b>{variante === "acta" ? "Tu acta quedó descargada." : "Tu informe quedó descargado."}</b>
        <p>
          {variante === "acta"
            ? "Guárdala donde no se pierda y compártela solo con quien la necesite."
            : "Guárdalo donde no se pierda y compártelo solo con quien lo necesite."}
        </p>
      </div>

      {derechoPeticion ? (
        <CarpetaDocumentos variante={variante} derechoPeticion={derechoPeticion} />
      ) : (
        <div className="jt-carpeta">
          <div className="carpeta-cab">
            <b>Te falta un documento</b>
          </div>
          <p className="carpeta-pie" style={{ textAlign: "left", marginTop: 0 }}>
            El <b>derecho de petición</b> es lo que obliga a la alcaldía a responderte en 15 días
            hábiles, y abre la puerta al censo y a los subsidios. Para generarlo necesitamos que
            documentes los daños.
          </p>
          <Link href="/go/juntos/documentar" className="btn btn-ambar">
            <Download className="ic" aria-hidden="true" /> Documentar los daños
          </Link>
        </div>
      )}

      {/* Anuncio grande del valor que sigue: el pedido de Victor era que no se
          sienta que después de descargar ya no hay nada. */}
      <div className="jt-mas-valor">
        <span className="mas-valor-etiqueta">Información que te puede servir</span>
        <h2>Cómo reclamarle a tu seguro sin que te den vueltas</h2>
        <p>
          Tres artículos de ley que juegan a tu favor y casi nadie conoce. Toca cada uno para ver
          qué hacer.
        </p>
      </div>

      <div className="ganchos">
        {TARJETAS_SEGURO.map((t) => (
          <TarjetaGancho key={t.id} tarjeta={t} />
        ))}

        <TarjetaGancho tarjeta={TARJETA_CONJUNTOS} />

        <TarjetaGancho
          tarjeta={TARJETA_AYUDAS}
          extra={
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <PuntosAtencion ciudad={ciudad} />
              {derechoPeticion && (
                <p className="desc" style={{ margin: 0 }}>
                  Tu derecho de petición lo descargas en la carpeta de arriba.
                </p>
              )}
            </div>
          }
        />

        <TarjetaGancho tarjeta={TARJETA_ANTIESTAFA} />
      </div>

      <AvisoDocumento />

      <p className="desc" style={{ textAlign: "center" }}>
        Si en algún momento vas a reparar, escríbenos. Te damos una mano con eso también.
      </p>
      <a href={`mailto:${CONTACTO_EMAIL}`} className="btn btn-chico" style={{ alignSelf: "center" }}>
        <Mail className="ic" aria-hidden="true" /> {CONTACTO_EMAIL}
      </a>
    </div>
  );
}
