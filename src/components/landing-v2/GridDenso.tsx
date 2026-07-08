/** Grid denso de capacidades (ADN técnico): denso donde importa, simple donde se usa. */
export default function GridDenso() {
  return (
    <section className="denso">
      <div className="wrap">
        <div className="denso-head reveal">
          <span className="eyebrow">Todo lo demás también está</span>
          <h2>
            Denso donde importa,
            <br />
            simple donde se usa
          </h2>
        </div>
        <div className="grid-c">
          <div className="cel reveal">
            <div className="vis">
              <span className="sem-i" style={{ background: "var(--verde)" }}></span>
              <span className="sem-i" style={{ background: "var(--ambar)" }}></span>
              <span className="sem-i" style={{ background: "var(--rojo)" }}></span>
            </div>
            <h4>Semáforo de plazos</h4>
            <p>Cinco niveles, de adelantado a crítico. El riesgo se ve antes de que sea pérdida.</p>
          </div>
          <div className="cel reveal" style={{ transitionDelay: ".06s" }}>
            <div className="vis">
              <span className="mapa-dot" style={{ background: "var(--verde)", color: "var(--verde)" }}></span>
              <span className="mapa-dot" style={{ background: "var(--azul)", color: "var(--azul)", marginLeft: 22 }}></span>
              <span className="mapa-dot" style={{ background: "var(--ambar)", color: "var(--ambar)", marginLeft: 10 }}></span>
            </div>
            <h4>Mapa multi-obra</h4>
            <p>Todas tus obras en un mapa con su avance. La ronda de llamadas, jubilada.</p>
          </div>
          <div className="cel reveal" style={{ transitionDelay: ".12s" }}>
            <div className="vis">
              <span className="excel-tag">XLSX → OBRA</span>
            </div>
            <h4>Importa tu Excel</h4>
            <p>Tu presupuesto de siempre se convierte en tareas, fases y cronograma en minutos.</p>
          </div>
          <div className="cel reveal">
            <div className="vis">
              <span className="mini-not">🔔 Tarea reportada — T1-302</span>
            </div>
            <h4>Notificaciones al momento</h4>
            <p>En la plataforma y por correo, cuando algo necesita tu decisión.</p>
          </div>
          <div className="cel reveal" style={{ transitionDelay: ".06s" }}>
            <div className="vis">
              <span className="gps-chip">📍 4.6097, -74.0817 · 10:42</span>
            </div>
            <h4>Evidencia con GPS y hora</h4>
            <p>Cada foto prueba dónde y cuándo. El historial queda para siempre.</p>
          </div>
          <div className="cel reveal" style={{ transitionDelay: ".12s" }}>
            <div className="vis" style={{ gap: 5 }}>
              <span style={{ fontWeight: 800, fontSize: 17, color: "var(--verde)", fontVariantNumeric: "tabular-nums" }}>
                $268M
              </span>
              <span style={{ fontSize: 11, color: "var(--gris)" }}>/ $310M sustentado</span>
            </div>
            <h4>Plata sustentada</h4>
            <p>Anticipos, facturas y presupuesto cruzados. Lo no justificado, en rojo.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
