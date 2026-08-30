"use client";

import { FileText, History } from "lucide-react";
import FirmarDocumento from "@/components/documentos/FirmarDocumento";
import { COPY_VERSION } from "@/lib/documentos/lenguaje";
import { rutaPdfActa } from "./logica/api-acta-inicial";
import {
  etapaDe,
  ETIQUETA_ETAPA,
  type ActaEnPantalla,
} from "./logica/vista-acta-inicial";

/**
 * Un acta emitida: su sello, en qué etapa está, y lo único que se puede hacer
 * con ella.
 *
 * Aquí se monta `FirmarDocumento`, que leaf-4.2 dejó escrito y sin pantalla que
 * lo montara. Se monta SOLO mientras el acta está sin firmar: firmar es una
 * transición de una sola dirección y el propio componente lo advierte antes de
 * pulsar. Un acta ya firmada no vuelve a ofrecer el botón porque no hay nada que
 * ofrecer — corregirla es emitir otra.
 *
 * El folio y la huella se muestran juntos y en texto seleccionable: son lo que
 * alguien copia del pie del PDF para comprobarlo en la página de verificación, y
 * tenerlos aquí evita abrir el documento solo para leerlos.
 */
export default function ActaEmitidaCard({ acta }: { acta: ActaEnPantalla }) {
  const etapa = etapaDe(acta);

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:p-5 ${
        acta.reemplazada ? "border-slate-200 bg-slate-50/70" : "border-slate-200 bg-white"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">
            Versión {acta.version} · {acta.folio}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Emitida el {acta.emitidaEl} · Huella {acta.huellaCorta}
          </p>
        </div>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {ETIQUETA_ETAPA[etapa]}
        </span>
      </header>

      {acta.reemplazada && (
        <p className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600">
          <History className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {COPY_VERSION.reemplazado}
        </p>
      )}

      <div className="flex flex-col gap-1 text-xs text-slate-500">
        {acta.firmadoMomento && (
          <p>
            Firmada el {acta.firmadoMomento}
            {acta.matricula ? ` · matrícula ${acta.matricula}` : ""}
          </p>
        )}
        {acta.recibidoMomento && <p>Constancia de entrega del cliente: {acta.recibidoMomento}</p>}
      </div>

      <a
        href={rutaPdfActa(acta.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <FileText className="h-4 w-4" />
        Abrir el acta en PDF
      </a>

      {!acta.firmadoMomento && (
        <FirmarDocumento
          documentoId={acta.id}
          firmaInicial={{ matricula: acta.matricula, firmadoMomento: acta.firmadoMomento }}
        />
      )}
    </article>
  );
}
