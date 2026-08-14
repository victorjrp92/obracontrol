import { permanentRedirect } from "next/navigation";

// Alias dictable de la campaña: /go → /repara (308). La ruta canónica es
// /repara (español, una palabra, sin tildes ni guiones: se dicta bien por
// WhatsApp o radio, igual que /alerta). Vive FUERA del grupo (public) a
// propósito, para no montar Navbar/Footer antes de redirigir; y se resuelve
// aquí en vez de en `redirects()` de next.config.ts, que está envuelto por el
// wrapper de Serwist y toca headers globales.
export default function GoAliasPage() {
  permanentRedirect("/repara");
}
