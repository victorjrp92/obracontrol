"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ArrowRight } from "lucide-react";
import { aceptarPolitica } from "./actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm cursor-pointer"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
      {pending ? "Guardando…" : "Acepto y continúo"}
    </button>
  );
}

export default function AceptarPoliticaForm() {
  const [acepta, setAcepta] = useState(false);

  return (
    <form action={aceptarPolitica}>
      <label className="flex items-start gap-2.5 mt-5 cursor-pointer">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
        />
        <span className="text-sm text-slate-600">
          Autorizo el tratamiento de mis datos personales y acepto la Política de Tratamiento de
          Datos y los Términos y Condiciones.
        </span>
      </label>
      <SubmitButton disabled={!acepta} />
    </form>
  );
}
