/**
 * Índice de planos bajo la placa (bifurcación temprana): dos tarjetas-ancla
 * pastel ("PLANO 01" en azul, "PLANO 02" en ámbar) que mandan al propietario a
 * la escena (#escena) y al contratista a su bloque (#contratista). Son anclas
 * de navegación, no CTAs de lista de espera.
 */
export default function Bifurcacion() {
  return (
    <div className="indice">
      <div className="wrap indice-grid">
        <a href="#escena" className="reveal">
          <span className="num">PLANO 01</span>
          <b className="disp">Construyo o remodelo lo mío</b>
          <p>La casa que estás pagando tú, vista con tus propios ojos, estés donde estés.</p>
          <span className="flecha">Así funciona →</span>
        </a>
        <a href="#contratista" className="reveal">
          <span className="num">PLANO 02</span>
          <b className="disp">Manejo obras de clientes</b>
          <p>Eres maestro o remodelador y quieres clientes tranquilos que paguen sin pelear.</p>
          <span className="flecha">Tu parte está aquí →</span>
        </a>
      </div>
    </div>
  );
}
