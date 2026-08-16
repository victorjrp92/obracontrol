import Link from "next/link";
import "./aviso-emergencia.css";

/**
 * Franja de emergencia post-sismo. Va arriba de todo, en las DOS landings.
 *
 * Existe por una razón concreta: durante una emergencia la gente no comparte
 * URLs, comparte nombres. Alguien va a oír «Seiricon» de boca de un vecino y
 * va a entrar a la home a buscar la ayuda — no va a teclear /go/juntos. Si no
 * la encuentra en el primer pantallazo, se va y no vuelve.
 *
 * Tinta y ámbar, no rojo: tiene que ser seria y encontrable, no alarmante.
 * Quien llega aquí ya vivió el terremoto; no hay que recordárselo a gritos.
 *
 * TEMPORAL — se quita cuando pase la emergencia. Montada en dos sitios:
 * `src/app/page.tsx` (B2B) y `src/app/go/page.tsx` (Go).
 */
export default function AvisoEmergencia() {
  return (
    <Link href="/go/juntos" className="avem">
      <span className="avem-in">
        <span className="avem-eti">Terremoto</span>
        <span className="avem-txt">
          ¿Tu casa quedó con grietas? Te ayudamos a revisarlas y a documentar los daños.{" "}
          <b>Gratis, sin crear cuenta.</b>
        </span>
        <span className="avem-btn">
          Entrar a Juntos
          <i aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
