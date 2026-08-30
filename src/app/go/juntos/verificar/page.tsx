import type { Metadata } from "next";
import NavJuntos from "@/components/juntos/NavJuntos";
import FooterJuntos from "@/components/juntos/FooterJuntos";
import VerificarDocumento from "@/components/juntos/VerificarDocumento";

export const metadata: Metadata = {
  title: { absolute: "Verificar un documento — Juntos, de Seiricon" },
  description:
    "Comprueba que un acta de documentación de daños o un informe de grietas se generó en Seiricon Juntos y que su contenido no fue modificado.",
};

/**
 * /go/juntos/verificar — comprobación pública de un documento.
 *
 * Existe porque el pie de cada PDF imprime «Verificación: <folio> · <hash>» y
 * sin esta pantalla ese sello no se puede cotejar: la API sola no sirve, quien
 * verifica suele ser un ajustador de seguros o alguien de una alcaldía con el
 * papel en la mano, no alguien que va a llamar a un JSON.
 *
 * Sin login y sin cuenta a propósito: quien necesita comprobar el documento no
 * es nuestro usuario, es la contraparte de nuestro usuario.
 */
export default function VerificarPage() {
  return (
    <>
      <NavJuntos />
      <main className="jt-shell">
        <div className="jt-shell-cab">
          <h1>Verificar un documento</h1>
          <p className="sub">
            Comprueba que un acta o un informe se generó aquí y que nadie lo modificó. Los datos están en
            el pie del documento.
          </p>
        </div>
        <VerificarDocumento />
      </main>
      <FooterJuntos />
    </>
  );
}
