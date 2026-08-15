"use client";

import Link from "next/link";
import { CheckCircle2, Download, FileText, Loader2, Mail } from "lucide-react";
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

export interface DerechoPeticionControles {
  generando: boolean;
  error: string | null;
  onDescargar: () => void;
}

interface PostDescargaProps {
  variante: "acta" | "informe";
  /** Ciudad del gate (solo acta) — enfoca el punto de atención del RUD. */
  ciudad?: string | null;
  /**
   * Controles del derecho de petición prellenado (solo el flujo del acta,
   * que es el que tiene los datos). null = flujo sin datos (informe): la
   * tarjeta del RUD enlaza a documentar en su lugar.
   */
  derechoPeticion?: DerechoPeticionControles | null;
}

/**
 * Pantalla post-descarga (paso final de ambos wizards, spec-go-juntos.md):
 * el PDF sale limpio, y ESTA pantalla trae las tarjetas-gancho clicables con
 * el contenido EXACTO de contenido-legal.ts, el derecho de petición
 * prellenado y el cierre sin venta dura.
 */
export default function PostDescarga({ variante, ciudad = null, derechoPeticion = null }: PostDescargaProps) {
  const botonDerecho = derechoPeticion && (
    <>
      {derechoPeticion.error && <p className="error-inline">{derechoPeticion.error}</p>}
      <button
        type="button"
        onClick={derechoPeticion.onDescargar}
        disabled={derechoPeticion.generando}
        className="btn btn-azul"
      >
        {derechoPeticion.generando ? (
          <Loader2 className="ic" style={{ animation: "ljt-girar 1s linear infinite" }} />
        ) : (
          <FileText className="ic" aria-hidden="true" />
        )}
        {derechoPeticion.generando ? "Generando documento..." : "Descargar mi derecho de petición"}
      </button>
    </>
  );

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
          <br />
          Ahora, esto es lo que casi nadie te cuenta — y tienes que saberlo:
        </p>
      </div>

      {botonDerecho && (
        <div className="doc-segundo">
          <span className="doc-etiqueta">Segundo documento · gratis</span>
          <h2>¿Vas a pedir ayuda del Estado? Te falta este papel.</h2>
          <p>
            El <b>derecho de petición</b> es lo que obliga a la alcaldía a responderte, y tienen{" "}
            <b>15 días hábiles</b> para hacerlo. Es el paso que abre la puerta al censo de damnificados
            y a los subsidios.
          </p>
          <p className="doc-listo">
            Ya lo tenemos listo con los datos que acabas de darnos y con los daños que declaraste.
            Descárgalo, fírmalo y radícalo junto con tu acta.
          </p>
          {botonDerecho}
        </div>
      )}

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
              {botonDerecho ? (
                <p className="desc" style={{ margin: 0 }}>
                  Tu derecho de petición ya está listo — lo descargas en el bloque naranja de arriba.
                </p>
              ) : (
                <Link href="/go/juntos/documentar" className="btn btn-chico">
                  <Download className="ic" aria-hidden="true" /> Documenta los daños para generar tu derecho de petición
                </Link>
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
      <a
        href={`mailto:${CONTACTO_EMAIL}`}
        className="btn btn-chico"
        style={{ alignSelf: "center" }}
      >
        <Mail className="ic" aria-hidden="true" /> {CONTACTO_EMAIL}
      </a>
    </div>
  );
}
