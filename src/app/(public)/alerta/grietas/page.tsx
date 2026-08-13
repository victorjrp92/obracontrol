import type { Metadata } from "next";
import AlertaDisclaimer from "@/components/alerta/AlertaDisclaimer";
import GrietaWizard from "@/components/alerta/GrietaWizard";

// Server component: solo metadata + composición (mismo patrón que
// documentar/page.tsx, Fase 1). Todo el estado del wizard vive en
// GrietaWizard.tsx ("use client").
export const metadata: Metadata = {
  title: "Revisar una grieta — Seiricon Alerta",
  description:
    "Ubica la grieta, toma dos fotos guiadas y recibe un resultado (rojo/amarillo/verde) con qué hacer y qué no hacer. Funciona incluso sin conexión a un modelo de IA.",
};

export default function GrietasPage() {
  return (
    <section className="bg-slate-50 py-10 sm:py-14">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Revisar una grieta</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ubica la grieta, toma dos fotos guiadas y te decimos qué hacer. Puedes revisar hasta 5
            grietas y descargar un informe en PDF al final.
          </p>
        </div>

        <AlertaDisclaimer />

        <GrietaWizard />
      </div>
    </section>
  );
}
