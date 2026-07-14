import LaPlataDemo from "./LaPlataDemo";

/**
 * Sección "Tu plata": la demo del gasto registrado desde el celular en loop
 * (pantalla móvil + lista de gastos con la fila roja y la alarma, en
 * <LaPlataDemo/>).
 */
export default function LaPlata() {
  return (
    <section className="gris-suave">
      <div className="wrap sec-grid">
        <div className="sec-copy reveal">
          <span className="eyebrow">Tu plata</span>
          <h2>No pagas sin factura.</h2>
          <p className="txt">
            Cada gasto entra con la foto de su factura. Y si entregaste plata que nadie ha
            sustentado, se pone en rojo — antes de que se vuelva un problema.
          </p>
        </div>
        <LaPlataDemo />
      </div>
    </section>
  );
}
