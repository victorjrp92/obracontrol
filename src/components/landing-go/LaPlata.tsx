import { Check, TriangleAlert } from "lucide-react";

/**
 * Sección "Tu plata": gastos con factura adjunta y la fila roja de plata
 * sin sustentar + la alarma. Las filas entran escalonadas
 * (data-escalonar/data-esc, las maneja <RevealsGo/>).
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
        <div className="gastos reveal" data-escalonar="340" style={{ marginLeft: "auto" }}>
          <div className="g-row" data-esc>
            <div>
              <b>Bulto de cemento gris x10</b>
            </div>
            <div className="g-fac">
              <span className="g-monto">$342.000</span>
              <br />
              <span className="g-ok">
                <Check
                  className="ic"
                  strokeWidth={3}
                  aria-hidden="true"
                  style={{ width: 11, height: 11 }}
                />
                Factura adjunta
              </span>
            </div>
          </div>
          <div className="g-row" data-esc>
            <div>
              <b>Viaje de arena de río</b>
            </div>
            <div className="g-fac">
              <span className="g-monto">$220.000</span>
              <br />
              <span className="g-ok">
                <Check
                  className="ic"
                  strokeWidth={3}
                  aria-hidden="true"
                  style={{ width: 11, height: 11 }}
                />
                Factura adjunta
              </span>
            </div>
          </div>
          <div className="g-row g-rojo" data-esc>
            <div>
              <b>Plata entregada al maestro</b>
            </div>
            <div className="g-fac">
              <span className="g-monto">$800.000</span>
              <br />
              <span className="g-sin">Sin sustentar hace 4 días</span>
            </div>
          </div>
          <div className="alarma">
            <TriangleAlert className="ic" size={16} strokeWidth={2.4} aria-hidden="true" />
            Tienes $800.000 entregados sin factura.
          </div>
        </div>
      </div>
    </section>
  );
}
