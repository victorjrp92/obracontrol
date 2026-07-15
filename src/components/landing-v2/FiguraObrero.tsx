import Image from "next/image";
import { Link as LinkIcon } from "lucide-react";
import VideoLoop from "./VideoLoop";

/**
 * FIG.02 — En la obra. Par de pantallas reales: la vista del obrero con su
 * evidencia (captura) y la aprobación del avance (video v3). f2 (manos en obra)
 * entra como foto de ambiente flotante; la insignia recuerda que el obrero
 * entra por un enlace, sin app ni cuenta.
 */
export default function FiguraObrero() {
  return (
    <section className="sec">
      <div className="wrap sec-grid inv">
        <div className="shot reveal-shot">
          <div className="shot-par">
            <div className="shot-frame">
              <div className="shot-top">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
              <Image
                src="/landing/capturas/shot-tarea-evidencia.png"
                alt="Vista real del obrero: su tarea con la evidencia fotográfica y el GPS"
                width={1600}
                height={1000}
                sizes="(max-width: 860px) 100vw, 45vw"
                style={{ width: "100%", height: "auto" }}
              />
            </div>
            <div className="shot-frame">
              <div className="shot-top">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
              <VideoLoop
                src="/landing/videos/v3-aprobar.mp4"
                poster="/landing/videos/v3-aprobar-poster.jpg"
                label="Aprobación real de una evidencia en Seiricon, con foto y GPS"
              />
            </div>
          </div>

          {/* foto de ambiente f2 — manos en la obra */}
          <div
            className="foto-amb"
            aria-hidden="true"
            style={{ position: "absolute", left: -14, top: -22, width: 128, lineHeight: 0 }}
          >
            <Image
              src="/landing/fotos/f2-manos-panete.jpg"
              alt=""
              width={128}
              height={192}
              sizes="128px"
              style={{ width: "100%", height: "auto" }}
            />
          </div>

          {/* regla de familia: insignias abajo a la izquierda */}
          <div className="insignia" style={{ left: -12, bottom: -18 }}>
            <span className="ic" style={{ background: "var(--azul)" }}>
              <LinkIcon size={12} aria-hidden="true" />
            </span>{" "}
            Entró por un enlace — sin app, sin cuenta
          </div>
        </div>

        <div className="sec-copy reveal">
          <span className="mono" style={{ color: "var(--gris)", display: "block", marginBottom: 8 }}>
            FIG. 02 — VISTA DEL OBRERO
          </span>
          <span className="eyebrow">En la obra</span>
          <h2>Tu gente reporta desde el celular, sin instalar nada</h2>
          <p className="txt">
            El obrero abre un enlace, ve sus tareas y sube la foto del avance. La foto llega con
            ubicación GPS y hora — imposible reportar desde la casa.
          </p>
          <div className="puntos">
            <span>Cero apps, cero cuentas, cero contraseñas</span>
            <span>Evidencia marcada con GPS, fecha y hora</span>
            <span>Pensado para la mano de obra real de Colombia</span>
          </div>
        </div>
      </div>
    </section>
  );
}
