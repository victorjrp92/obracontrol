import { CIUDADES_JUNTOS } from "@/lib/juntos/telefonos";

interface PuntosAtencionProps {
  /** Ciudad declarada en el gate — si coincide con una ciudad foco, se muestra solo esa. */
  ciudad?: string | null;
}

/**
 * Puntos de atención presenciales para el registro de damnificados (RUD),
 * SOLO los verificados de src/lib/juntos/telefonos.ts. Si conocemos la ciudad
 * de la persona (gate del acta) mostramos la suya; si no, las cuatro.
 */
export default function PuntosAtencion({ ciudad }: PuntosAtencionProps) {
  const normalizada = (ciudad ?? "").trim().toLowerCase();
  const propia = CIUDADES_JUNTOS.find(
    (c) => c.puntoAtencion && (normalizada.includes(c.slug) || normalizada.includes(c.nombre.toLowerCase()))
  );
  const aMostrar = propia ? [propia] : CIUDADES_JUNTOS.filter((c) => c.puntoAtencion);

  if (aMostrar.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gris)" }}>
        {propia ? "Punto de atención en tu ciudad" : "Puntos de atención por ciudad"}
      </p>
      {aMostrar.map((c) => (
        <div key={c.slug} className="punto-rud">
          <span className="ciudad">{c.nombre}</span>
          <p style={{ marginTop: 2 }}>{c.puntoAtencion!.lugar}</p>
          {c.puntoAtencion!.detalle && <small>{c.puntoAtencion!.detalle}</small>}
        </div>
      ))}
    </div>
  );
}
