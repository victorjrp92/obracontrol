import Image from "next/image";

/**
 * FIG.03 — Equipo y auditoría. Captura real de proyectos/contratistas.
 * Layout invertido (media a la izquierda) para dar ritmo tras la sección previa.
 */
export default function FiguraEquipo() {
  return (
    <section className="sec">
      <div className="wrap sec-grid inv">
        <div className="shot reveal-shot">
          <div className="shot-frame">
            <div className="shot-top">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
            <div className="shot-cap mono">
              <span>APP.SEIRICON.COM — PROYECTOS Y EQUIPO</span>
              <span>CAPTURA SIN RETOQUE</span>
            </div>
            <Image
              src="/landing/capturas/shot-proyectos.png"
              alt="Gestión real de proyectos y contratistas en Seiricon"
              width={1600}
              height={1000}
              sizes="(max-width: 860px) 100vw, 55vw"
              style={{ width: "100%", height: "auto" }}
            />
          </div>
          <div className="insignia" style={{ left: -12, top: -16, animationDelay: ".6s" }}>
            <span className="ic" style={{ background: "var(--navy)" }}>
              🔒
            </span>{" "}
            Reasignación auditada
          </div>
        </div>

        <div className="sec-copy reveal">
          <span className="mono" style={{ color: "var(--gris)", display: "block", marginBottom: 8 }}>
            FIG. 03 — EQUIPO Y AUDITORÍA
          </span>
          <span className="eyebrow">Tu equipo</span>
          <h2>Contratistas con historial, no con promesas</h2>
          <p className="txt">
            Cada contratista con sus tareas, sus tiempos y su historial de entregas. Reasignar exige
            motivo y contraseña — y queda auditado para siempre.
          </p>
          <div className="puntos">
            <span>Asignación por torre, piso, apartamento o tarea</span>
            <span>Reasignaciones con auditoría permanente</span>
            <span>El historial de lo aprobado nunca se pierde</span>
          </div>
        </div>
      </div>
    </section>
  );
}
