import { Phone } from "lucide-react";
import { CIUDADES_JUNTOS, LINEAS_NACIONALES } from "@/lib/juntos/telefonos";

/**
 * Líneas de emergencia de la pantalla roja. SOLO números verificados de
 * src/lib/juntos/telefonos.ts (cada uno con fuente y fecha) — los no
 * confirmados no existen en ese archivo y por eso no se muestran. El 123 va
 * aparte, primero y en grande (lo pinta PantallaRoja.tsx); aquí van las demás
 * líneas nacionales y las de cada ciudad.
 */
export default function LineasJuntos() {
  const [, ...nacionalesSecundarias] = LINEAS_NACIONALES; // el 123 ya va grande arriba
  const ciudadesConLineas = CIUDADES_JUNTOS.filter((c) => c.lineas.length > 0);

  return (
    <div className="tel-lista">
      {nacionalesSecundarias.map((l) => (
        <div key={l.numero} className="tel-fila">
          <span>
            {l.nombre}
            {l.detalle && <small>{l.detalle}</small>}
          </span>
          <a href={`tel:${l.numero.replace(/\s/g, "")}`} aria-label={`Llamar a ${l.nombre}: ${l.numero}`}>
            <Phone className="ic" style={{ width: 13, height: 13, marginRight: 5 }} aria-hidden="true" />
            {l.numero}
          </a>
        </div>
      ))}

      {ciudadesConLineas.map((ciudad) => (
        <div key={ciudad.slug}>
          <p className="tel-ciudad">{ciudad.nombre}</p>
          {ciudad.lineas.map((l) => (
            <div key={l.numero} className="tel-fila">
              <span>
                {l.nombre}
                {l.detalle && <small>{l.detalle}</small>}
              </span>
              <a href={`tel:${l.numero.replace(/\s/g, "")}`} aria-label={`Llamar a ${l.nombre}: ${l.numero}`}>
                {l.numero}
              </a>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
