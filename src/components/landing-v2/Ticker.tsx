/** Ticker navy estilo terminal con eventos de obra (ADN técnico). */
const EVENTOS = [
  <>
    10:42 — <b>EVIDENCIA APROBADA</b> · ENCHAPE BAÑO PPAL · T1-504
  </>,
  <>
    10:38 — <b>FOTO + GPS</b> · ESTUCO ALCOBA 2 · T1-302
  </>,
  <>
    10:15 — <b>ANTICIPO SUSTENTADO</b> · $4.2M · FERRETERÍA EL PUNTO
  </>,
  <>
    09:58 — <b>SEMÁFORO ÁMBAR</b> · PINTURA FACHADA · T2
  </>,
];

export default function Ticker() {
  return (
    <div className="ticker" aria-hidden="true">
      {/* Duplicamos la lista para que el loop del ticker sea continuo */}
      <div className="ticker-in">
        {[...EVENTOS, ...EVENTOS].map((ev, i) => (
          <span key={i}>{ev}</span>
        ))}
      </div>
    </div>
  );
}
