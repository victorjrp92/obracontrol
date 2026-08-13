import type { Metadata } from "next";
import AlertaDisclaimer from "@/components/alerta/AlertaDisclaimer";
import ActaWizard from "@/components/alerta/ActaWizard";

// Server component: solo metadata + composición (spec addendum F.0). Todo el
// estado del wizard vive en ActaWizard.tsx ("use client"). Usa el Navbar de
// marketing normal del layout (public) — no se construye un header propio.
export const metadata: Metadata = {
  title: "Acta de daños — Seiricon Alerta",
  description:
    "Documenta los espacios dañados de tu casa, apartamento o local con fotos con fecha, hora y ubicación, y descarga un acta en PDF.",
};

export default function DocumentarPage() {
  return (
    <section className="bg-slate-50 py-10 sm:py-14">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Acta de daños</h1>
          <p className="mt-2 text-sm text-slate-600">
            Documenta los espacios dañados con fotos. Cada foto queda sellada con fecha, hora y
            ubicación, y al final puedes descargar un PDF.
          </p>
        </div>

        <AlertaDisclaimer />

        <ActaWizard />
      </div>
    </section>
  );
}
