"use client";

import Link from "next/link";
import { ArrowRight, Download, Loader2, Plus } from "lucide-react";
import { evaluarInmueble } from "@/lib/alerta/reglas";
import { MAX_GRIETAS } from "@/lib/alerta/grietas";
import { ADVERTENCIA_VERDE, LABEL_ELEMENTO } from "@/lib/alerta/copys";
import SemaforoJuntos, { PRIORIDAD_NIVEL } from "./SemaforoJuntos";
import AvisoDocumento from "./AvisoDocumento";
import type { GrietaGuardada } from "./GrietaWizardJuntos";

interface ResumenInmuebleJuntosProps {
  grietas: GrietaGuardada[];
  terminado: boolean;
  presupuestoAgotado: boolean;
  generandoPdf: boolean;
  errorPdf: string | null;
  onAgregarOtra: () => void;
  onTerminar: () => void;
  onDescargarPdf: () => void;
}

/**
 * Resumen del inmueble: `evaluarInmueble(veredictos)` (el peor nivel, nunca
 * promedio), lista de grietas evaluadas, agregar otra (tope MAX_GRIETAS),
 * descarga del informe y AVISO_DOCUMENTO compartido (corrección 5 del spec).
 * Solo se monta con `grietas.length > 0` (lo garantiza GrietaWizardJuntos).
 */
export default function ResumenInmuebleJuntos({
  grietas,
  terminado,
  presupuestoAgotado,
  generandoPdf,
  errorPdf,
  onAgregarOtra,
  onTerminar,
  onDescargarPdf,
}: ResumenInmuebleJuntosProps) {
  const veredictoInmueble = evaluarInmueble(grietas.map((g) => g.evaluada.veredicto));
  const puedeAgregarOtra = !terminado && !presupuestoAgotado && grietas.length < MAX_GRIETAS;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2>Tu inmueble</h2>
          <SemaforoJuntos nivel={veredictoInmueble.nivel} />
        </div>
        <p className="prioridad">{PRIORIDAD_NIVEL[veredictoInmueble.nivel]}</p>
        <p className="desc" style={{ marginTop: 0 }}>{veredictoInmueble.que_hacer}</p>
        {veredictoInmueble.nivel === "verde" && <div className="aviso-verde aviso">{ADVERTENCIA_VERDE}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {grietas.map((g, i) => (
            <div
              key={g.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                border: "1.5px solid var(--linea)",
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Grieta {i + 1} — {LABEL_ELEMENTO[g.evaluada.reconciliacion.elemento]}
                </p>
                <p className="micro" style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.evaluada.veredicto.razon}
                </p>
              </div>
              <SemaforoJuntos nivel={g.evaluada.veredicto.nivel} />
            </div>
          ))}
        </div>

        {puedeAgregarOtra && (
          <button type="button" onClick={onAgregarOtra} className="btn btn-chico" style={{ alignSelf: "flex-start" }}>
            <Plus className="ic" aria-hidden="true" /> Agregar otra grieta ({grietas.length}/{MAX_GRIETAS})
          </button>
        )}
        {!terminado && !presupuestoAgotado && grietas.length >= MAX_GRIETAS && (
          <p className="micro">Llegaste al máximo de {MAX_GRIETAS} grietas por informe.</p>
        )}
        {!terminado && presupuestoAgotado && grietas.length < MAX_GRIETAS && (
          <p className="micro">Llegaste al peso máximo del informe. Descárgalo antes de agregar otra grieta.</p>
        )}

        <AvisoDocumento />

        {errorPdf && <p className="error-inline">{errorPdf}</p>}

        <div className="cta-abajo">
          <button type="button" onClick={onDescargarPdf} disabled={generandoPdf} className="btn btn-azul">
            {generandoPdf ? (
              <Loader2 className="ic" style={{ animation: "ljt-girar 1s linear infinite" }} />
            ) : (
              <Download className="ic" aria-hidden="true" />
            )}
            {generandoPdf ? "Generando informe..." : "Descargar informe en PDF"}
          </button>
          <p className="micro" style={{ textAlign: "center", marginTop: 0 }}>Gratis. Sin crear cuenta.</p>
        </div>

        {!terminado && (
          <button type="button" onClick={onTerminar} className="btn-fantasma btn" style={{ alignSelf: "flex-start" }}>
            Terminar <ArrowRight className="ic" aria-hidden="true" />
          </button>
        )}
      </div>

      <Link
        href="/go/juntos/documentar"
        className="micro"
        style={{ textAlign: "center", color: "var(--azul)", fontWeight: 700 }}
      >
        ¿También necesitas el acta de documentación de daños para tu aseguradora? Documenta los daños →
      </Link>
    </div>
  );
}
