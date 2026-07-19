import { Check } from "lucide-react";

/**
 * Franja de confianza (banda blanca) justo debajo del hero: las tres
 * promesas duras con checks verdes. En móvil los items apilan/centran
 * (flex-wrap en el CSS). Estática (Server Component).
 */
export default function ConfianzaGo() {
  return (
    <div className="confia">
      <div className="wrap">
        <span>
          <Check className="ic" strokeWidth={2.6} aria-hidden="true" />
          Cada avance con foto, GPS y hora
        </span>
        <span>
          <Check className="ic" strokeWidth={2.6} aria-hidden="true" />
          No pagas sin factura
        </span>
        <span>
          <Check className="ic" strokeWidth={2.6} aria-hidden="true" />
          Tu maestro reporta con un link, sin app
        </span>
      </div>
    </div>
  );
}
