import LaPlataDemo from "./LaPlataDemo";

/**
 * "FIG. 02 — EL DINERO": libro contable sobre papel. La demo del gasto
 * registrado desde el celular en loop se conserva intacta (pantalla móvil +
 * lista de gastos con la fila roja y la alarma, en <LaPlataDemo/>); solo se
 * re-viste como un libro de cuentas (filas con estado Factura/Sin sustentar y
 * la fila total en banda noche). Sección clara: texto tinta sobre papel.
 */
export default function LaPlata() {
  return (
    <section className="libro">
      <div className="wrap sec-grid">
        <div className="sec-copy reveal">
          <span className="fig">FIG. 02 — EL DINERO</span>
          <h2>No pagas sin factura.</h2>
          <p className="txt">
            Cada gasto entra con la foto de su factura. Y si entregaste dinero que nadie ha
            sustentado, se pone en rojo — antes de que se vuelva un problema.
          </p>
        </div>
        <LaPlataDemo />
      </div>
    </section>
  );
}
