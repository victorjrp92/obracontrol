/** Preguntas frecuentes. */
export default function Faq() {
  return (
    <section className="testi-d" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="faq-d">
          <details className="reveal">
            <summary>¿Mis obreros necesitan instalar algo?</summary>
            <p>
              No. Entran por un enlace que les compartes, ven sus tareas y suben las fotos. Sin app,
              sin cuenta, sin contraseña.
            </p>
          </details>
          <details className="reveal">
            <summary>¿Qué tan difícil es montar mi primer proyecto?</summary>
            <p>
              Minutos. La estructura de torres, pisos y apartamentos la armas con un asistente, y el
              presupuesto entra por Excel: queda convertido en tareas, fases y cronograma.
            </p>
          </details>
          <details className="reveal">
            <summary>¿La evidencia sirve en una disputa con un contratista?</summary>
            <p>
              Cada foto queda con GPS, fecha y hora; cada aprobación o rechazo con su motivo y autor.
              El historial es permanente.
            </p>
          </details>
          <details className="reveal">
            <summary>¿Puedo controlar qué ve cada persona de mi equipo?</summary>
            <p>
              Sí. Tú lo ves todo; tus administradores de proyecto solo lo suyo, con permisos que tú
              ajustas; contratistas y obreros, únicamente sus tareas.
            </p>
          </details>
          <details className="reveal">
            <summary>¿Mis datos están seguros?</summary>
            <p>
              Cada constructora ve solo sus datos, las acciones críticas exigen doble verificación y
              cumplimos la Ley 1581 de protección de datos.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
