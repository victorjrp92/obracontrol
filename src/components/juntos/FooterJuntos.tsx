import Link from "next/link";
import { AVISO_DOCUMENTO } from "@/lib/juntos/contenido-legal";

/** Pie de la línea Juntos: aviso canónico + legales del sitio. */
export default function FooterJuntos() {
  return (
    <footer className="jt-footer">
      <div className="wrap" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
        <p style={{ maxWidth: "72ch" }}>{AVISO_DOCUMENTO}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
          <span>© {new Date().getFullYear()} Seiricon</span>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/terminos">Términos</Link>
          <Link href="/go">Seiricon Go</Link>
        </div>
      </div>
    </footer>
  );
}
