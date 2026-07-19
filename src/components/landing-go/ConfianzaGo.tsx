/**
 * Placa editorial de 3 celdas justo debajo del hero (patrón ARQ): las tres
 * promesas duras, cada una con su título Jost en mayúsculas y su descripción
 * Lora, separadas por divisiones verticales. En móvil apilan (CSS). Estática
 * (Server Component).
 */
export default function ConfianzaGo() {
  return (
    <div className="placa">
      <div className="wrap">
        <div className="celda">
          <b className="disp">Cada avance, con pruebas</b>
          Foto, GPS y hora estampados en obra. Tú apruebas o rechazas.
        </div>
        <div className="celda">
          <b className="disp">No pagas sin factura</b>
          La plata entregada sin sustentar se pone en rojo, a tiempo.
        </div>
        <div className="celda">
          <b className="disp">Tu maestro, sin app</b>
          Abre un link y toma la foto. Si sabe chatear, sabe reportar.
        </div>
      </div>
    </div>
  );
}
