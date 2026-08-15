"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { guardarConsentimiento, leerConsentimiento } from "@/lib/consentimiento-cookies";



export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (leerConsentimiento() === "sin-responder") {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Guardar dispara el evento que enciende (o deja apagada) la analítica de
  // comportamiento. Antes ambos botones hacían lo mismo; ahora "Rechazar"
  // significa algo: Clarity no se carga nunca.
  function accept() {
    guardarConsentimiento("aceptado");
    setVisible(false);
  }

  function decline() {
    guardarConsentimiento("rechazado");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p>
              Usamos cookies esenciales para que la plataforma funcione. Si aceptas, además
              medimos de forma anónima cómo se usa la página para poder mejorarla. Consulta nuestra{" "}
              <Link href="/cookies" className="text-blue-600 hover:text-blue-700 font-medium">
                politica de cookies
              </Link>{" "}
              para mas informacion.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={decline}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Rechazar
          </button>
          <button
            onClick={accept}
            className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            Aceptar
          </button>
        </div>
        <button onClick={decline} className="absolute top-2 right-2 sm:hidden text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
