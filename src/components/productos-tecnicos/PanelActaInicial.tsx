"use client";

import { useState } from "react";
import { FilePlus2, Loader2, ShieldCheck } from "lucide-react";
import { emitirActaInicial } from "./logica/api-acta-inicial";
import {
  ALCANCE,
  NATURALEZA_DOCUMENTO,
  NO_INCLUYE,
  RUTA_VERIFICACION,
  TITULO_ALCANCE,
  TITULO_METODOLOGIA,
  TITULO_NO_INCLUYE,
} from "./logica/copys-acta-inicial";
import ActaEmitidaCard from "./ActaEmitidaCard";
import {
  actaVigente,
  ordenarActas,
  type ActaEnPantalla,
} from "./logica/vista-acta-inicial";

/**
 * Emitir el acta de estado inicial y ver las que ya se emitieron.
 *
 * La metodología —y en particular lo que el documento NO incluye— se muestra
 * ANTES del botón, entera y sin plegar. Es lo que el profesional va a firmar y
 * lo que delimita su responsabilidad; esconderla detrás de un «ver detalles»
 * sería esconder justo la parte que hay que leer.
 *
 * Corregir un acta emite una versión nueva con folio nuevo y deja la anterior
 * intacta. Por eso el botón cambia de texto en cuanto existe una versión
 * vigente: no hay ninguna acción en esta pantalla que reescriba un acta ya
 * emitida, y el texto del botón no debería sugerir que la hay.
 */
export default function PanelActaInicial({
  proyectoId,
  actas,
  onActasCambiadas,
  totalFotos,
  hayFotosSinMarca,
}: {
  proyectoId: string;
  actas: readonly ActaEnPantalla[];
  onActasCambiadas: (actas: ActaEnPantalla[]) => void;
  totalFotos: number;
  /**
   * ¿Queda alguna imagen sin fecha, hora y ubicación en el registro? La emisión
   * se niega mientras la haya, así que se dice aquí en vez de dejar que el
   * profesional lo descubra pulsando el botón.
   */
  hayFotosSinMarca: boolean;
}) {
  const [emitiendo, setEmitiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordenadas = ordenarActas(actas);
  const vigente = actaVigente(ordenadas);
  const esCorreccion = vigente !== null;
  const puedeEmitir = totalFotos > 0 && !hayFotosSinMarca;

  async function emitir() {
    setError(null);
    setEmitiendo(true);
    const resultado = await emitirActaInicial(proyectoId, vigente?.id ?? null);
    setEmitiendo(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    const nueva: ActaEnPantalla = {
      id: resultado.datos.id,
      folio: resultado.datos.folio,
      huellaCorta: resultado.datos.huellaCorta,
      version: resultado.datos.version,
      emitidaEl: resultado.datos.emitidaEl,
      firmadoMomento: null,
      matricula: null,
      recibidoMomento: null,
      reemplazada: false,
    };

    onActasCambiadas(
      ordenarActas([
        ...ordenadas.map((a) => (vigente && a.id === vigente.id ? { ...a, reemplazada: true } : a)),
        nueva,
      ]),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900">{TITULO_METODOLOGIA}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{NATURALEZA_DOCUMENTO}</p>

        <h3 className="mt-5 text-sm font-semibold text-slate-800">{TITULO_ALCANCE}</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {ALCANCE.map((linea) => (
            <li key={linea} className="flex gap-2 text-sm leading-relaxed text-slate-600">
              <span className="text-slate-300">—</span>
              <span>{linea}</span>
            </li>
          ))}
        </ul>

        <h3 className="mt-5 text-sm font-semibold text-slate-800">{TITULO_NO_INCLUYE}</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {NO_INCLUYE.map((linea) => (
            <li key={linea} className="flex gap-2 text-sm leading-relaxed text-slate-600">
              <span className="text-slate-300">—</span>
              <span>{linea}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900">
          {esCorreccion ? "Corregir el acta" : "Emitir el acta"}
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          {totalFotos === 0
            ? "El acta recoge las fotos del registro. Toma al menos una antes de emitirla."
            : `Se emitirá con las ${totalFotos} ${totalFotos === 1 ? "foto" : "fotos"} del registro y con los datos del inmueble, incluida su matrícula inmobiliaria.`}
        </p>
        {hayFotosSinMarca && (
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            En la pestaña del registro hay imágenes sin fecha, hora y ubicación impresas. El acta no
            se emite mientras estén ahí: descártalas primero.
          </p>
        )}
        {esCorreccion && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            La versión {vigente.version} queda como reemplazada, con su folio y su huella intactos:
            sigue siendo auténtica y sigue verificando.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

        <button
          type="button"
          onClick={emitir}
          disabled={emitiendo || !puedeEmitir}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
        >
          {emitiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
          {emitiendo
            ? "Emitiendo…"
            : esCorreccion
              ? "Emitir una versión corregida"
              : "Emitir el acta de estado inicial"}
        </button>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          Cada acta lleva folio y huella impresos en el pie. Cualquiera puede comprobarlos, sin
          cuenta, en{" "}
          <a href={RUTA_VERIFICACION} target="_blank" rel="noopener noreferrer" className="underline">
            seiricon.com{RUTA_VERIFICACION}
          </a>
          .
        </p>
      </section>

      {ordenadas.length > 0 && (
        <div className="flex flex-col gap-3">
          {ordenadas.map((acta) => (
            <ActaEmitidaCard key={acta.id} acta={acta} />
          ))}
        </div>
      )}
    </div>
  );
}
