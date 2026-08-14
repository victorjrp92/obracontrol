"use client";

import Link from "next/link";
import { Camera, MessageCircle, Phone, TriangleAlert } from "lucide-react";
import LineasJuntos from "./LineasJuntos";

interface PantallaRojaProps {
  /** En /documentar: continúa el flujo en modo "desde afuera" sin salir de la página. */
  onDocumentarAfuera?: () => void;
}

/**
 * Pantalla de corte del filtro de seguridad (spec-go-juntos.md): «Sal ahora»
 * + 123 grande + líneas verificadas por ciudad (telefonos.ts) y, más abajo,
 * el puente a documentar DESDE AFUERA cuando ya esté a salvo — con el enlace
 * por WhatsApp del propio usuario (wa.me: no enviamos ni guardamos nada).
 */
export default function PantallaRoja({ onDocumentarAfuera }: PantallaRojaProps) {
  function enviarEnlaceWhatsApp() {
    const enlace = `${window.location.origin}/go/juntos/documentar`;
    const texto =
      "Guía para documentar los daños de mi casa cuando esté afuera y a salvo (acta gratuita con fotos, ubicación y fecha): " +
      enlace;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rojo-panel" role="alert">
      <div>
        <h2>
          <TriangleAlert style={{ width: 30, height: 30, flex: "none" }} aria-hidden="true" />
          Sal ahora
        </h2>
        <p className="porque" style={{ marginTop: 8 }}>
          Al menos una de tus respuestas es una señal de riesgo inmediato. No te quedes a revisar ni a
          documentar nada más.
        </p>
      </div>

      <ul className="rojo-lista">
        <li>Sal del inmueble con calma, sin correr ni empujar.</li>
        <li>Aléjate de fachadas, muros y postes que puedan caer.</li>
        <li>No vuelvas a entrar hasta que un ingeniero o la autoridad local lo autorice.</li>
      </ul>

      <a href="tel:123" className="tel-123" aria-label="Llamar al 123, línea nacional de emergencias">
        <Phone style={{ width: 26, height: 26, flex: "none" }} aria-hidden="true" />
        <span className="num">123</span>
        <small>Línea nacional de emergencias — funciona en todo el país</small>
      </a>

      <LineasJuntos />

      <div className="rojo-despues">
        <p>
          Cuando ya estés afuera y a salvo, documenta lo que pasó — lo vas a necesitar para el seguro y
          para pedir ayuda.
        </p>
        <button type="button" onClick={enviarEnlaceWhatsApp} className="btn btn-chico">
          <MessageCircle className="ic" aria-hidden="true" /> Enviarme el enlace por WhatsApp
        </button>
        {onDocumentarAfuera ? (
          <button type="button" onClick={onDocumentarAfuera} className="btn btn-chico">
            <Camera className="ic" aria-hidden="true" /> Documentar desde afuera (fachada y exterior)
          </button>
        ) : (
          <Link href="/go/juntos/documentar?desde=afuera" className="btn btn-chico">
            <Camera className="ic" aria-hidden="true" /> Documentar desde afuera (fachada y exterior)
          </Link>
        )}
        <p className="micro" style={{ marginTop: 2 }}>
          No guardamos nada: el enlace te lo envías tú mismo desde tu WhatsApp.
        </p>
      </div>

      <p className="rojo-nunca">No vuelvas a entrar por una foto. Ningún documento vale eso.</p>
    </div>
  );
}
