"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Cómo funciona", href: "#como" },
  { label: "Para arquitectos", href: "#arquitectos" },
  { label: "Precio", href: "#precio" },
];

export default function B2CNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass-card border-b border-white/60 shadow-sm shadow-orange-100/40"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/para-ti" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/seiricon-icon.png" alt="Seiricon" className="h-9 w-9" />
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-wide text-slate-900">
                SEIRICON
              </div>
              <div className="text-[9px] text-orange-500">para tu casa</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="cursor-pointer text-sm font-medium text-slate-600 transition-colors hover:text-orange-600"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-orange-600"
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-orange-500/30 transition-colors hover:bg-orange-600"
            >
              Empezar gratis
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="cursor-pointer rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label="Menú"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="glass-card flex flex-col gap-3 border-t border-white/60 px-4 py-4 md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="cursor-pointer py-2 text-sm font-medium text-slate-700 transition-colors hover:text-orange-600"
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
            <Link
              href="/login"
              className="py-2 text-center text-sm font-medium text-slate-700"
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-center text-sm font-bold text-white"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
