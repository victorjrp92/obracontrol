/**
 * FAQ de la landing Go: las 5 preguntas del copy aprobado, con
 * details/summary nativos (el +/– lo pinta el CSS).
 */
export default function FaqGo() {
  return (
    <section>
      <div className="wrap faq">
        <h2>Las preguntas de siempre</h2>
        <details className="reveal">
          <summary>¿Mi maestro tiene que instalar una app?</summary>
          <p>No. Abre un link, toma la foto y envía. Sin descargar nada, sin crear cuenta.</p>
        </details>
        <details className="reveal">
          <summary>¿Y si yo no sé de construcción?</summary>
          <p>
            Para eso está el modo simple: un arranque guiado te lleva paso a paso, el cronograma
            trae duraciones sugeridas y el semáforo te dice qué mirar. No necesitas saber de obra
            para saber cómo va tu obra.
          </p>
        </details>
        <details className="reveal">
          <summary>¿Cuánto cuesta?</summary>
          <p>
            Tu primera obra es gratis, de principio a fin. No pedimos tarjeta. Pagas solo si
            después quieres llevar más obras.
          </p>
        </details>
        <details className="reveal">
          <summary>¿Esto no daña la confianza con mi maestro?</summary>
          <p>
            Al revés. Hoy la confianza se desgasta a fuerza de &ldquo;¿cómo va?&rdquo; y
            &ldquo;mándame una foto&rdquo;. Con Seiricon Go él demuestra su trabajo sin que se lo
            pidan, y tú apruebas y pagas tranquilo. La evidencia protege a los dos.
          </p>
        </details>
        <details className="reveal">
          <summary>Estoy fuera del país. ¿De verdad me sirve?</summary>
          <p>
            Es para quien está lejos que más sirve. Los avances te llegan con foto, ubicación y
            hora; tú apruebas a la hora que sea, desde donde estés. La diferencia horaria deja de
            importar: la obra queda al día cuando tú te conectas.
          </p>
        </details>
      </div>
    </section>
  );
}
