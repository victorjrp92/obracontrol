import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Cierre de la landing: una sola invitación, sin urgencia fabricada. */
export default function CierreJuntos() {
  return (
    <section className="jt-cierre">
      <div className="wrap">
        <h2>
          Hoy toca revisar la casa. <span className="jt-frase">No lo hagas solo.</span>
        </h2>
        <div className="jt-hero-cta" style={{ justifyContent: "center", marginTop: 26 }}>
          <Link href="/go/juntos/revisar" className="btn btn-azul">
            Empezar la revisión <ArrowRight className="ic" aria-hidden="true" />
          </Link>
          <Link href="/go/juntos/documentar" className="btn">
            Documentar los daños
          </Link>
        </div>
        <p className="micro" style={{ textAlign: "center" }}>Gratis · Sin crear cuenta · Toma 5 minutos</p>
      </div>
    </section>
  );
}
