import { Info } from "lucide-react";
import { NOTA_NORMA_SISMICA } from "@/lib/inmueble/copys";
import { normaSismicaPorAnio } from "@/lib/inmueble/norma-sismica";
import { validarAnioConstruccion } from "@/lib/inmueble/validacion";

interface PistaNormaSismicaProps {
  /** El año tal como está en el formulario, sin parsear. */
  anio: string;
}

/**
 * Aparece en cuanto el año de construcción está completo y es válido: es el
 * momento en que ese campo se explica solo. Mientras el año no sirva, no se
 * pinta nada — no hay tramo por defecto.
 *
 * Tono deliberadamente neutro (gris, no semáforo): dice qué norma regía, que
 * es un hecho, y nunca opina sobre el estado del inmueble. La nota de abajo es
 * obligatoria y va siempre pegada al dato.
 */
export default function PistaNormaSismica({ anio }: PistaNormaSismicaProps) {
  const parsed = validarAnioConstruccion(anio);
  const norma = parsed.ok ? normaSismicaPorAnio(parsed.valor) : null;

  // La región viva se monta SIEMPRE, aunque esté vacía: un `aria-live` que
  // aparece junto con su contenido no se anuncia en varios lectores de
  // pantalla, y este aviso es justo el que hay que oír al escribir el año.
  return (
    <div aria-live="polite">
      {norma && (
        <div className="mt-2 flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden="true" />
          <div className="min-w-0 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">
              {norma.etiqueta}
              <span className="ml-1.5 font-normal text-slate-500">{norma.vigencia}</span>
            </p>
            <p className="mt-0.5 leading-relaxed">{norma.frase}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{NOTA_NORMA_SISMICA}</p>
          </div>
        </div>
      )}
    </div>
  );
}
