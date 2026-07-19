/**
 * Footer mínimo de la landing Go, con los créditos de las fotos de bancos
 * libres (Unsplash/Pexels) que pide la licencia de cortesía.
 */
export default function FooterGo() {
  return (
    <footer>
      <div className="wrap">
        <span className="mono">SEIRICON GO — CONTROL DE OBRA PERSONAL · COLOMBIA 2026</span>
        <span style={{ fontSize: 10 }}>
          Fotos: Unsplash (Julian Gojani, rylan krupp, Emmanuel Ikwuegbu, GN Group) · Pexels
          (Ksenia Chernaya)
        </span>
      </div>
    </footer>
  );
}
