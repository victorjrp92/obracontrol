import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import PublicChrome from "./PublicChrome";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // El Navbar/Footer compartidos se renderizan en todas las páginas públicas
  // salvo en /nueva (landing v2 oculta con su propio chrome). Ver PublicChrome.
  return (
    <PublicChrome navbar={<Navbar />} footer={<Footer />}>
      {children}
    </PublicChrome>
  );
}
