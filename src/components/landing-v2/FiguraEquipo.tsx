import Image from "next/image";
import { Lock } from "lucide-react";

/**
 * FIG.03 — Roles y permisos (v2.1: reemplaza la sección de historial de
 * contratistas — esa información es privada del producto). Captura real de
 * proyectos/equipo. Layout invertido (media a la izquierda) para dar ritmo.
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
              <span>APP.SEIRICON.COM — EQUIPO Y PERMISOS</span>
              <span>CAPTURA SIN RETOQUE</span>
            </div>
            <Image
              src="/landing/capturas/shot-proyectos.png"
              alt="Gestión real de roles y permisos del equipo en Seiricon"
              width={1600}
              height={1000}
              sizes="(max-width: 860px) 100vw, 55vw"
              style={{ width: "100%", height: "auto" }}
            />
          </div>
          {/* regla de familia: insignias abajo a la izquierda */}
          <div className="insignia" style={{ left: -12, bottom: -18, animationDelay: ".6s" }}>
            <span className="ic" style={{ background: "var(--navy)" }}>
              <Lock size={12} aria-hidden="true" />
            </span>{" "}
            Accesos por rol — cada acción, auditada
          </div>
        </div>

        <div className="sec-copy reveal">
          <span className="mono" style={{ color: "var(--gris)", display: "block", marginBottom: 8 }}>
            FIG. 03 — ROLES Y PERMISOS
          </span>
          <span className="eyebrow">Tu equipo</span>
          <h2>Cada quien ve exactamente lo que le corresponde</h2>
          <p className="txt">
            Tú decides quién entra a qué. Nadie ve de más, nadie queda fuera de lo suyo — y
            cada acción queda registrada con nombre y hora.
          </p>
          <div className="puntos">
            <span>Tú lo ves todo: cada proyecto, cada peso, cada aprobación</span>
            <span>Tu admin de proyecto, solo sus obras — con permisos que tú le ajustas</span>
            <span>El contratista reporta lo suyo; el obrero entra por un enlace, sin cuenta</span>
          </div>
        </div>
      </div>
    </section>
  );
}
