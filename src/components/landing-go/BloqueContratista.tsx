import Image from "next/image";
import { Check } from "lucide-react";
import CtaCupo from "./CtaCupo";

/**
 * Bloque contratista en banda CLARA crema2 («Cerca»): el link de
 * transparencia como argumento de venta, con el mock del link público que ve
 * su cliente. Se retiraron las partículas (eran atmósfera de noche y no
 * encajan con la banda clara). Su CTA abre el ModalCupo con la audiencia
 * contratista preseleccionada.
 */
export default function BloqueContratista() {
  return (
    <section className="contra" id="contratista">
      <div className="wrap contra-grid">
        <div className="reveal">
          <span className="eyebrow">¿Manejas obras de clientes?</span>
          <h2>El mismo link que tranquiliza a un dueño es tu mejor carta de presentación.</h2>
          <p className="txt">
            Envíale a cada cliente un link de transparencia: ve el avance en vivo — qué va, qué
            falta, fotos con ubicación y hora — sin crear cuenta. Menos llamadas de &ldquo;¿cómo
            va lo mío?&rdquo;, más clientes que te recomiendan.
          </p>
          <ul className="bullets">
            <li>
              <Check className="ic" size={16} strokeWidth={2.6} aria-hidden="true" />
              Un link por cliente: cada uno ve solo su obra.
            </li>
            <li>
              <Check className="ic" size={16} strokeWidth={2.6} aria-hidden="true" />
              Todo queda con nombre, foto y hora: si hay una disputa, el registro también habla
              por ti.
            </li>
            <li>
              <Check className="ic" size={16} strokeWidth={2.6} aria-hidden="true" />
              Varias obras de varios clientes, en una sola pantalla.
            </li>
          </ul>
          <CtaCupo origen="contratista" audiencia="contratista">
            Reserva tu cupo de contratista
          </CtaCupo>
          <div className="micro" style={{ color: "rgba(255,255,255,.5)" }}>
            Primera obra gratis · Sin tarjeta
          </div>
        </div>
        <div className="reveal">
          <div className="link-pub">
            <div className="lp-top">
              <b>Remodelación apto de Marcela R. — Cali</b>
              <span className="lp-url">link del cliente · sin cuenta</span>
            </div>
            <div className="lp-avance">Avance general: 68%</div>
            <div className="lp-bar">
              <i></i>
            </div>
            <div className="lp-item">
              <span className="mini">
                <Image
                  src="/landing/fotos/f2-manos-panete.jpg"
                  alt=""
                  width={80}
                  height={64}
                />
              </span>
              <div>
                <b>Enchape baño social</b>
                <br />
                <span style={{ color: "var(--gris)", fontSize: "10.5px" }}>
                  foto — hoy, 3:15 p. m.
                </span>
              </div>
              <span className="lp-tag t-ok">TERMINADO</span>
            </div>
            <div className="lp-item">
              <div>
                <b>Pintura habitación principal</b>
                <br />
                <span style={{ color: "var(--gris)", fontSize: "10.5px" }}>segunda mano</span>
              </div>
              <span className="lp-tag t-curso">EN CURSO</span>
            </div>
            <div className="lp-item">
              <div>
                <b>Instalación eléctrica de cocina</b>
              </div>
              <span className="lp-tag t-falta">FALTA</span>
            </div>
            <div className="lp-pie">Obra llevada en Seiricon Go por Norbey Quintero</div>
          </div>
          <div className="contra-foto">
            <Image
              src="/landing/fotos/go-contratista-planos.jpg"
              alt="Contratista revisando planos en obra"
              fill
              sizes="(max-width: 900px) 100vw, 40vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
