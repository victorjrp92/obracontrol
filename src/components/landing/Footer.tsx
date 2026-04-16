import Link from "next/link";
import { Mail, Phone } from "lucide-react";

const links = {
  Producto: [
    { label: "Funcionalidades", href: "#features" },
    { label: "Cómo funciona", href: "#como-funciona" },
    { label: "Precios", href: "#precios" },
    { label: "Seguridad", href: "/seguridad" },
  ],
  Empresa: [
    { label: "Sobre nosotros", href: "/nosotros" },
    { label: "Casos de éxito", href: "/casos" },
    { label: "Blog", href: "/blog" },
    { label: "Contacto", href: "/contacto" },
  ],
  Legal: [
    { label: "Términos de uso", href: "/terminos" },
    { label: "Privacidad", href: "/privacidad" },
    { label: "Cookies", href: "/cookies" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <img src="/seiricon-icon.png" alt="Seiricon" className="w-10 h-10" />
              <div className="leading-tight">
                <div className="font-extrabold text-white text-lg tracking-wide">SEIRICON</div>
                <div className="text-[10px] text-blue-300">construyendo en orden</div>
              </div>
            </Link>
            <p className="text-sm leading-relaxed mb-5">
              Control integral de proyectos de construccion.
              Visibilidad total, evidencia verificable, decisiones en tiempo real.
              Visibilidad total, evidencia verificable, decisiones en tiempo real.
            </p>
            <div className="flex flex-col gap-2 text-sm">
              <a href="mailto:info@seiricon.com" className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
                info@seiricon.com
              </a>
              <a href="tel:+573151760351" className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="w-4 h-4" />
                +57 315 176 0351
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <div className="text-white text-sm font-semibold mb-4">{group}</div>
              <ul className="flex flex-col gap-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm hover:text-white transition-colors duration-150"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span>© {new Date().getFullYear()} Seiricon. Todos los derechos reservados.</span>
          <span className="text-slate-600">Hecho en Latinoamerica para la industria de la construccion</span>
        </div>
      </div>
    </footer>
  );
}
