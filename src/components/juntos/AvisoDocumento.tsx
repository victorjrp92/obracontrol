import { Info } from "lucide-react";
import { AVISO_DOCUMENTO } from "@/lib/juntos/contenido-legal";

/**
 * Aviso compartido de «Juntos»: el texto canónico AVISO_DOCUMENTO de
 * src/lib/juntos/contenido-legal.ts, tal cual, sin parafrasear. Va en
 * ResumenInmuebleJuntos y en TODA pantalla de resultado o de documento
 * (spec-go-juntos.md, corrección obligatoria 5).
 */
export default function AvisoDocumento() {
  return (
    <div className="aviso" role="note">
      <span style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
        <Info className="ic" style={{ marginTop: 2 }} aria-hidden="true" />
        <span>{AVISO_DOCUMENTO}</span>
      </span>
    </div>
  );
}
