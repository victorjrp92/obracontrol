import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // Navbar/Footer compartidos de las páginas públicas secundarias (contacto,
  // legales, etc.). La home vive en src/app/page.tsx con su propio chrome.
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
