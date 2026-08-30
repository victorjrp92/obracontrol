import Link from "next/link";
import { AVISO_DOCUMENTO } from "@/lib/juntos/contenido-legal";

/**
 * Pie de la línea Juntos: aviso canónico + legales del sitio.
 *
 * Sin estilos en línea: la maquetación vive en `.jt-footer` (landing-juntos.css).
 * Antes estaba repartida entre los dos sitios y los inline pisaban la hoja, así
 * que centrar el pie exigía tocar el componente en vez de una regla.
 */
export default function FooterJuntos() {
  return (
    <footer className="jt-footer">
      <div className="wrap">
        <p className="jt-footer-aviso">{AVISO_DOCUMENTO}</p>
        <div className="jt-footer-legales">
          <span>© {new Date().getFullYear()} Seiricon</span>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/terminos">Términos</Link>
          <Link href="/go">Seiricon Go</Link>
        </div>
      </div>
    </footer>
  );
}
