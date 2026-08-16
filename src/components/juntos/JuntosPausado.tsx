import { Phone } from "lucide-react";
import { LINEAS_NACIONALES } from "@/lib/juntos/telefonos";
import { MENSAJE_PAUSA } from "@/lib/juntos/pausa";
import NavJuntos from "./NavJuntos";
import FooterJuntos from "./FooterJuntos";
import LineasJuntos from "./LineasJuntos";

/**
 * Pantalla de la línea pausada (`JUNTOS_PAUSADO=true`).
 *
 * Regla de esta pantalla: quien llega aquí llegó buscando ayuda y no puede
 * irse con las manos vacías. Por eso el 123 va ARRIBA y en grande, antes de
 * cualquier disculpa — si su casa está en riesgo ahora mismo, lo que necesita
 * es el teléfono, no una explicación de por qué nuestro servidor está ocupado.
 * El aviso de la pausa va después, y en tono de "vuelve", no de "lo sentimos".
 */
export default function JuntosPausado() {
  const [nacional] = LINEAS_NACIONALES; // el 123

  return (
    <>
      <NavJuntos />
      <main className="jt-shell">
        <div className="jt-shell-cab">
          <h1>Si tu casa está en riesgo ahora mismo, llama</h1>
          <p className="sub">Es gratis y atienden a toda hora.</p>
        </div>

        <div className="panel">
          <a
            href={`tel:${nacional.numero}`}
            className="btn btn-rojo"
            aria-label={`Llamar a ${nacional.nombre}: ${nacional.numero}`}
          >
            <Phone className="ic" aria-hidden="true" /> Llamar al {nacional.numero}
          </a>
          <p className="micro" style={{ textAlign: "center", marginTop: 0 }}>
            {nacional.nombre}
          </p>
          <LineasJuntos />
        </div>

        <div className="panel">
          <div>
            <h2>La revisión está pausada un momento</h2>
            <p className="desc">{MENSAJE_PAUSA}</p>
          </div>
        </div>
      </main>
      <FooterJuntos />
    </>
  );
}
