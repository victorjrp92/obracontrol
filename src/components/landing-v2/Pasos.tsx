/** 3 pasos: arma el proyecto → tu gente reporta con pruebas → tú decides con datos. */
export default function Pasos() {
  return (
    <section className="pasos" id="como-funciona">
      <div className="wrap">
        <div className="pasos-grid">
          <div className="paso-c reveal">
            <span className="n">PASO 1</span>
            <h4>Arma tu proyecto en minutos</h4>
            <p>
              Torres, pisos y tareas por fase con un asistente guiado. Y el presupuesto entra por
              Excel: se convierte en tareas y cronograma sin digitar partida por partida.
            </p>
          </div>
          <div className="paso-c reveal" style={{ transitionDelay: ".08s" }}>
            <span className="n">PASO 2</span>
            <h4>Tu gente reporta con pruebas</h4>
            <p>
              Cada avance llega con foto, GPS y hora. Tú apruebas o rechazas con motivo, desde donde
              estés.
            </p>
          </div>
          <div className="paso-c reveal" style={{ transitionDelay: ".16s" }}>
            <span className="n">PASO 3</span>
            <h4>Tú decides con datos</h4>
            <p>
              Semáforo de plazos en cinco niveles, dinero sustentado y todas tus obras en un mapa. La
              visita a obra vuelve a ser una decisión.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
