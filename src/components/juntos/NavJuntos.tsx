import Image from "next/image";
import Link from "next/link";

/** Nav mínimo de la línea Juntos: marca + vuelta discreta a Seiricon Go. */
export default function NavJuntos() {
  return (
    <div className="jt-nav">
      <div className="wrap jt-nav-in">
        <Link href="/go/juntos" className="jt-logo">
          <Image src="/seiricon-logo.png" alt="Seiricon" width={29} height={29} />
          Seiricon
          <span className="jt-pill">Juntos</span>
        </Link>
        <Link href="/go" className="jt-nav-volver">
          Conocer Seiricon Go →
        </Link>
      </div>
    </div>
  );
}
