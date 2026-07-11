/**
 * Sección "El panorama": el semáforo por tarea — qué va bien, qué está en
 * riesgo y qué está crítico. Estático (los leds son CSS).
 */
export default function Panorama() {
  return (
    <section>
      <div className="wrap sec-grid">
        <div className="sem-lista reveal" style={{ order: 0 }}>
          <div className="mono" style={{ color: "var(--gris)", marginBottom: 10 }}>
            SEMÁFORO DE TU OBRA
          </div>
          <div className="s-row s-verde">
            <span className="s-led"></span> Vaciado de placa segundo piso{" "}
            <span className="s-est">A tiempo</span>
          </div>
          <div className="s-row s-ambar">
            <span className="s-led"></span> Instalación eléctrica de cocina{" "}
            <span className="s-est">En riesgo</span>
          </div>
          <div className="s-row s-rojo">
            <span className="s-led"></span> Ventanería en aluminio{" "}
            <span className="s-est">Crítico</span>
          </div>
        </div>
        <div className="sec-copy reveal">
          <span className="eyebrow">El panorama</span>
          <h2>Sabes qué va bien, qué está en riesgo y cuándo termina.</h2>
          <p className="txt">
            Un semáforo por tarea te avisa a tiempo. El cronograma trae duraciones sugeridas para
            que no arranques a ciegas, y cada tarea tiene su presupuesto. ¿Más de una obra? Todas
            en una sola pantalla.
          </p>
        </div>
      </div>
    </section>
  );
}
