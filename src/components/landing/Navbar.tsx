"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Funcionalidades", href: "#features" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Precios", href: "#precios" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.fromTo(
      navRef.current,
      { y: -80, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: "power3.out", delay: 0.2 }
    );

    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      // Switch to light theme once scrolled past ~90% of viewport (hero height)
      setPastHero(window.scrollY > window.innerHeight * 0.85);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Colors depend on whether we're in the dark hero or light content below
  const inDark = !pastHero;

  return (
    <nav
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? inDark
            ? "glass-card-dark shadow-lg shadow-black/10"
            : "glass-card shadow-sm shadow-blue-100/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/seiricon-icon.png" alt="Seiricon" className="w-9 h-9" />
            <div className="leading-tight">
              <div className={`font-extrabold text-base tracking-wide transition-colors duration-300 ${inDark ? "text-white" : "text-slate-900"}`}>
                SEIRICON
              </div>
              <div className={`text-[9px] transition-colors duration-300 ${inDark ? "text-blue-400" : "text-slate-500"}`}>
                construyendo en orden
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-300 cursor-pointer ${
                  inDark
                    ? "text-white/60 hover:text-white"
                    : "text-slate-600 hover:text-blue-600"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className={`text-sm font-medium transition-colors duration-300 px-3 py-2 ${
                inDark
                  ? "text-white/70 hover:text-white"
                  : "text-slate-700 hover:text-blue-600"
              }`}
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-150 shadow-sm"
            >
              Empezar gratis
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors cursor-pointer ${
              inDark
                ? "text-white/70 hover:bg-white/10"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            aria-label="Menú"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={`md:hidden border-t px-4 py-4 flex flex-col gap-3 ${
          inDark
            ? "glass-card-dark border-white/10"
            : "glass-card border-slate-200/60"
        }`}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`text-sm font-medium py-2 transition-colors cursor-pointer ${
                inDark
                  ? "text-white/70 hover:text-white"
                  : "text-slate-700 hover:text-blue-600"
              }`}
            >
              {link.label}
            </a>
          ))}
          <div className={`pt-2 flex flex-col gap-2 border-t ${inDark ? "border-white/10" : "border-slate-200"}`}>
            <Link href="/login" className={`text-sm font-medium text-center py-2 ${inDark ? "text-white/70" : "text-slate-700"}`}>
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="text-sm font-semibold text-center bg-blue-600 text-white px-4 py-2.5 rounded-lg"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
