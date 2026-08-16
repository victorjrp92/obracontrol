"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldAlert, ShieldQuestion } from "lucide-react";

/**
 * Comprobación de un documento de «Juntos».
 *
 * REGLA DE COPY, la más importante de esta pantalla: se certifica EMISIÓN e
 * INTEGRIDAD, jamás el contenido. «Este documento salió de aquí y nadie lo
 * modificó» es cierto y verificable. «Documento válido», «verificado por
 * Seiricon» o «certificado» nos pondrían del lado del perito, que es justo lo
 * que el producto entero se cuida de no ser. Por eso cada respuesta afirmativa
 * lleva pegada la aclaración de qué NO confirma.
 */

type Estado =
  | { fase: "inicial" }
  | { fase: "consultando" }
  | { fase: "error"; mensaje: string }
  | {
      fase: "listo";
      existe?: boolean;
      /** El registro todavía no está disponible (migración sin aplicar). */
      indisponible?: boolean;
      tipo?: string;
      emitido?: string;
      huellaCoincide?: boolean | null;
    };

const NOMBRE_TIPO: Record<string, string> = {
  ACTA: "acta de documentación de daños",
  INFORME: "informe de revisión de grietas",
  PETICION: "derecho de petición",
};

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function VerificarDocumento() {
  const [folio, setFolio] = useState("");
  const [huella, setHuella] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "inicial" });

  async function consultar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (estado.fase === "consultando") return;

    const folioLimpio = folio.trim().toUpperCase();
    if (!folioLimpio) {
      setEstado({ fase: "error", mensaje: "Escribe el folio que aparece en el pie del documento." });
      return;
    }

    setEstado({ fase: "consultando" });
    try {
      const params = new URLSearchParams({ folio: folioLimpio });
      const h = huella.trim().toLowerCase();
      if (h) params.set("huella", h);

      const res = await fetch(`/api/juntos/verificar?${params.toString()}`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setEstado({
          fase: "error",
          mensaje: data?.error ?? "No pudimos hacer la consulta. Intenta de nuevo en un momento.",
        });
        return;
      }
      setEstado({ fase: "listo", ...data });
    } catch {
      setEstado({
        fase: "error",
        mensaje: "No pudimos hacer la consulta. Revisa tu conexión e intenta de nuevo.",
      });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <form className="panel" onSubmit={consultar} noValidate>
        <div className="campo">
          <label htmlFor="vf-folio">Folio</label>
          <p className="pista">Está en el pie del documento. Tiene esta forma: JT-20260815-a3f9c1</p>
          <input
            id="vf-folio"
            type="text"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="JT-20260815-a3f9c1"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="campo">
          <label htmlFor="vf-huella">Huella (opcional)</label>
          <p className="pista">
            El código que va justo después del folio. Sirve para comprobar además que el contenido no
            cambió.
          </p>
          <input
            id="vf-huella"
            type="text"
            value={huella}
            onChange={(e) => setHuella(e.target.value)}
            placeholder="a1b2c3d4e5f6"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="cta-abajo">
          <button type="submit" disabled={estado.fase === "consultando"} className="btn btn-azul">
            {estado.fase === "consultando" ? (
              <Loader2 className="ic" style={{ animation: "ljt-girar 1s linear infinite" }} aria-hidden="true" />
            ) : (
              <ArrowRight className="ic" aria-hidden="true" />
            )}
            {estado.fase === "consultando" ? "Consultando..." : "Comprobar"}
          </button>
        </div>
      </form>

      {estado.fase === "error" && <p className="error-inline">{estado.mensaje}</p>}

      {/* El registro aún no está listo. NO se puede decir «no encontramos este
          folio»: el documento puede ser auténtico y estaríamos sembrando una
          duda falsa justo sobre lo que alguien va a presentarle a su
          aseguradora. Se dice la verdad y se ofrece otra vía. */}
      {estado.fase === "listo" && estado.indisponible && (
        <div className="panel" role="status">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <ShieldQuestion className="ic" style={{ width: 22, height: 22, flexShrink: 0 }} aria-hidden="true" />
            <div>
              <b>La comprobación en línea todavía no está disponible.</b>
              <p className="desc" style={{ marginTop: 6 }}>
                Estamos terminando de habilitarla. Esto no dice nada sobre tu documento — puede ser
                perfectamente auténtico. Si necesitas confirmarlo ahora, escríbenos a{" "}
                <a href="mailto:info@seiricon.com">info@seiricon.com</a> con el folio y te respondemos.
              </p>
            </div>
          </div>
        </div>
      )}

      {estado.fase === "listo" && !estado.indisponible && !estado.existe && (
        <div className="panel" role="status">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <ShieldQuestion className="ic" style={{ width: 22, height: 22, flexShrink: 0 }} aria-hidden="true" />
            <div>
              <b>No encontramos este folio.</b>
              <p className="desc" style={{ marginTop: 6 }}>
                Revísalo: se copia del pie del documento y tiene esta forma — JT-20260815-a3f9c1. Si está
                bien copiado, este documento no salió de Seiricon Juntos.
              </p>
            </div>
          </div>
        </div>
      )}

      {estado.fase === "listo" && !estado.indisponible && estado.existe && estado.huellaCoincide === false && (
        <div className="panel" role="status">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <ShieldAlert className="ic" style={{ width: 22, height: 22, flexShrink: 0 }} aria-hidden="true" />
            <div>
              <b>Este folio existe, pero el contenido no coincide.</b>
              <p className="desc" style={{ marginTop: 6 }}>
                El documento se emitió el {estado.emitido && fechaLarga(estado.emitido)}, pero lo que estás
                cotejando no es igual al original. Pídele el archivo original a quien te lo entregó.
              </p>
            </div>
          </div>
        </div>
      )}

      {estado.fase === "listo" && !estado.indisponible && estado.existe && estado.huellaCoincide !== false && (
        <div className="panel" role="status">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <CheckCircle2 className="ic" style={{ width: 22, height: 22, flexShrink: 0 }} aria-hidden="true" />
            <div>
              <b>Documento auténtico.</b>
              <p className="desc" style={{ marginTop: 6 }}>
                Se generó en Seiricon Juntos el {estado.emitido && fechaLarga(estado.emitido)}
                {estado.tipo && ` como ${NOMBRE_TIPO[estado.tipo] ?? "documento"}`}
                {estado.huellaCoincide === true && " y su contenido no ha sido modificado"}.
              </p>
              {/* Sin esta aclaración, «auténtico» se lee como «la casa está
                  evaluada». Certificamos que el papel salió de aquí, nunca el
                  estado del inmueble. */}
              <p className="micro" style={{ marginTop: 8 }}>
                Esto confirma que el documento salió de aquí y que nadie lo alteró.{" "}
                <b>No confirma el estado del inmueble:</b> el documento recoge fotos, fecha, ubicación y la
                declaración de quien lo hizo. La evaluación técnica la hace un ingeniero o un organismo
                oficial.
              </p>
              {estado.huellaCoincide === null && (
                <p className="micro" style={{ marginTop: 6 }}>
                  Para comprobar además que el contenido no cambió, vuelve a consultar añadiendo la huella
                  que va después del folio.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
