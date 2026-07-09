import CelSemaforo from "./grid/CelSemaforo";
import CelMapaMini from "./grid/CelMapaMini";
import CelExcel from "./grid/CelExcel";
import CelNotificaciones from "./grid/CelNotificaciones";
import CelGps from "./grid/CelGps";
import CelPlata from "./grid/CelPlata";

/**
 * Grid denso de capacidades (ADN técnico): denso donde importa, simple donde
 * se usa. v2.1: cada tarjeta trae su micro-demo animada en loop (componentes
 * en ./grid, pausados fuera de viewport y estáticos con reduced-motion).
 */
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
          <CelSemaforo />
          <CelMapaMini />
          <CelExcel />
          <CelNotificaciones />
          <CelGps />
          <CelPlata />
        </div>
      </div>
    </section>
  );
}
