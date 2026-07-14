/**
 * Cursor fantasma de las micro-demos de la landing Go (decorativo). Mismo
 * enfoque visual que el mini-cursor del grid B2B; se mueve con la transición
 * CSS de `.mcur` (left/top) y GSAP solo controla su opacidad.
 */
export default function CursorGo() {
  return (
    <span className="mcur" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 18 18">
        <path
          d="M2 1 L2 14 L6 11 L8.5 16.5 L11 15.3 L8.6 10 L13.5 9.6 Z"
          fill="#0F172A"
          stroke="#fff"
          strokeWidth="1.3"
        />
      </svg>
    </span>
  );
}
