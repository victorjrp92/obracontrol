"use client";

import { usePathname } from "next/navigation";

/**
 * Envuelve las páginas del grupo (public). Renderiza el Navbar/Footer compartidos
 * del sitio EXCEPTO en `/nueva`, la landing v2 oculta que trae su propio chrome
 * (nav con semáforo + footer navy). El resto de páginas públicas quedan idénticas.
 */
export default function PublicChrome({
  navbar,
  footer,
  children,
}: {
  navbar: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare = pathname === "/nueva";

  if (bare) return <>{children}</>;

  return (
    <>
      {navbar}
      <main className="flex-1">{children}</main>
      {footer}
    </>
  );
}
