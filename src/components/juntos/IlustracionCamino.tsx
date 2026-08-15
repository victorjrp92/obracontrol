/**
 * Ilustraciones de los dos caminos de la landing. SVG propio en el lenguaje
 * Aizome (trazo tinta, relleno índigo/ámbar, esquinas rectas) para que la
 * tarjeta cuente de un vistazo qué va a hacer la persona: en el camino 1
 * enfoca una grieta con el celular y la moneda de referencia; en el camino 2
 * el acta sale con sus fotos, su sello y su folio.
 */

export default function IlustracionCamino({ camino }: { camino: 1 | 2 }) {
  const acento = camino === 1 ? "var(--azul)" : "var(--ambar)";
  const suave = camino === 1 ? "var(--azul-50)" : "var(--ambar-50)";

  if (camino === 1) {
    return (
      <svg viewBox="0 0 120 80" className="jt-ilu-camino" aria-hidden="true" focusable="false">
        {/* pared con la grieta */}
        <rect x="4" y="6" width="112" height="68" rx="3" fill="#fff" stroke="var(--tinta)" strokeWidth="2" />
        <path
          d="M44 10 L39 24 L47 36 L41 50 L48 62 L44 72"
          fill="none"
          stroke="var(--tinta)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* moneda de referencia junto a la grieta */}
        <circle cx="58" cy="42" r="7" fill={suave} stroke={acento} strokeWidth="2" />
        {/* marco de encuadre del celular */}
        <g stroke={acento} strokeWidth="2.6" fill="none" strokeLinecap="round">
          <path d="M74 20 L88 20 L88 30" />
          <path d="M74 66 L88 66 L88 56" />
          <path d="M30 20 L18 20 L18 30" />
          <path d="M30 66 L18 66 L18 56" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 80" className="jt-ilu-camino" aria-hidden="true" focusable="false">
      {/* hoja del acta */}
      <rect x="14" y="4" width="80" height="72" rx="3" fill="#fff" stroke="var(--tinta)" strokeWidth="2" />
      {/* miniaturas de las fotos */}
      <rect x="22" y="12" width="24" height="18" fill={suave} stroke={acento} strokeWidth="1.8" />
      <rect x="50" y="12" width="24" height="18" fill={suave} stroke={acento} strokeWidth="1.8" />
      {/* renglones del inventario */}
      <g stroke="var(--linea)" strokeWidth="3" strokeLinecap="round">
        <path d="M22 40 H80" />
        <path d="M22 48 H72" />
        <path d="M22 56 H84" />
        <path d="M22 64 H62" />
      </g>
      {/* sello / folio en la esquina */}
      <circle cx="92" cy="62" r="13" fill="#fff" stroke={acento} strokeWidth="2.4" />
      <path
        d="M86 62 L90 66 L98 57"
        fill="none"
        stroke={acento}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
