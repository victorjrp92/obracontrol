"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { blobToDataUrl } from "@/lib/media/overlay";
import { MAX_BODY_BYTES, estimarBytesBase64 } from "@/lib/alerta/acta";
import {
  evaluarTriageGrieta,
  type EntradaTriage,
  type FuenteObservacion,
  type GrietaEvaluada,
  type RespuestaPasante,
} from "@/lib/alerta/triage";
import { COPY_SIN_IA } from "@/lib/alerta/copys";
import type { Banderas, Elemento, ObservacionGrieta, Patron } from "@/lib/alerta/tipos";
import UbicarGrieta from "./UbicarGrieta";
import GrietaCameraCapture, { type CapturedPhotoGrieta } from "./GrietaCameraCapture";
import DescribirGrietaManual from "./DescribirGrietaManual";
import ConfirmarPatron from "./ConfirmarPatron";
import ResultadoGrieta from "./ResultadoGrieta";
import ResumenInmueble from "./ResumenInmueble";
import PuenteIngenieros from "./PuenteIngenieros";

type Paso = "ubicar" | "fotos" | "manual" | "confirmar" | "resultado" | "resumen";

/** Una grieta ya evaluada + las dos fotos de evidencia que la respaldan. */
export interface GrietaGuardada {
  id: string;
  evaluada: GrietaEvaluada;
  notaVisual: string | null;
  fotoCerca: CapturedPhotoGrieta;
  fotoLejos: CapturedPhotoGrieta;
}

/** Confianza alta fija para observaciones armadas a mano (spec D4). */
const CONFIANZA_MANUAL = { elemento: 0.9, patron: 0.9, ancho: 0.9 };

/**
 * Estado y flujo completo del triage de grietas (/alerta/grietas), en un
 * solo client component — mismo patrón que ActaWizard.tsx (Fase 1): todo el
 * estado vive acá, `grietas/page.tsx` es server component. Todo en memoria
 * del navegador — nada se persiste hasta que el usuario pide el PDF.
 */
export default function GrietaWizard() {
  const [paso, setPaso] = useState<Paso>("ubicar");
  const [grietas, setGrietas] = useState<GrietaGuardada[]>([]);
  const [terminado, setTerminado] = useState(false);

  // Grieta en construcción (aún no evaluada).
  const [declarado, setDeclarado] = useState<Elemento | null>(null);
  const [fotoCerca, setFotoCerca] = useState<CapturedPhotoGrieta | null>(null);
  const [fotoLejos, setFotoLejos] = useState<CapturedPhotoGrieta | null>(null);
  const [pasante, setPasante] = useState<RespuestaPasante>("no_se");
  const [analizando, setAnalizando] = useState(false);
  const [avisoSinIA, setAvisoSinIA] = useState(false);
  /** Lectura de la IA a la espera de que la persona confirme o corrija el patrón (R3). */
  const [lecturaIA, setLecturaIA] = useState<{ observacion: ObservacionGrieta; notaVisual: string | null } | null>(null);
  const [resultadoActual, setResultadoActual] = useState<{ evaluada: GrietaEvaluada; notaVisual: string | null } | null>(
    null
  );

  // Single-flight de la llamada a observar-grieta + guarda contra respuestas
  // tardías si el usuario elige "prefiero describirla yo" mientras la
  // petición sigue en vuelo (spec: "single-flight en cada llamada a red").
  const solicitudEnVuelo = useRef(false);
  const idSolicitud = useRef(0);

  // Informe en PDF.
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  const totalBytesEvidencia = grietas.reduce(
    (n, g) => n + g.fotoCerca.blobEvidencia.size + g.fotoLejos.blobEvidencia.size,
    0
  );
  const presupuestoAgotado = estimarBytesBase64(totalBytesEvidencia) >= MAX_BODY_BYTES;

  function reiniciarGrietaEnConstruccion() {
    if (fotoCerca) URL.revokeObjectURL(fotoCerca.preview);
    if (fotoLejos) URL.revokeObjectURL(fotoLejos.preview);
    setDeclarado(null);
    setFotoCerca(null);
    setFotoLejos(null);
    setPasante("no_se");
    setAvisoSinIA(false);
    setLecturaIA(null);
    setResultadoActual(null);
  }

  function handleSeleccionElemento(elemento: Elemento) {
    setDeclarado(elemento);
    setPaso("fotos");
  }

  async function handleFotosCompletas(resultado: {
    fotoCerca: CapturedPhotoGrieta;
    fotoLejos: CapturedPhotoGrieta;
    pasante: RespuestaPasante;
  }) {
    setFotoCerca(resultado.fotoCerca);
    setFotoLejos(resultado.fotoLejos);
    setPasante(resultado.pasante);
    await intentarObservacionIA(resultado.fotoCerca, resultado.fotoLejos);
  }

  async function intentarObservacionIA(cerca: CapturedPhotoGrieta, lejos: CapturedPhotoGrieta) {
    if (solicitudEnVuelo.current) return;
    solicitudEnVuelo.current = true;
    const miId = ++idSolicitud.current;
    setAnalizando(true);
    try {
      const [fotoCercaDataUrl, fotoLejosDataUrl] = await Promise.all([
        blobToDataUrl(cerca.blobAnalisis),
        blobToDataUrl(lejos.blobAnalisis),
      ]);
      const res = await fetch("/api/alerta/observar-grieta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoCercaDataUrl, fotoLejosDataUrl }),
      });
      const data = await res.json().catch(() => null);
      if (miId !== idSolicitud.current) return; // el usuario ya optó por describirla manualmente
      if (data?.ok) {
        // R3 — la lectura NO va directo al veredicto: primero la persona
        // confirma o corrige el patrón (paso "confirmar").
        setLecturaIA({
          observacion: data.observacion as ObservacionGrieta,
          notaVisual: (data.notaVisual as string | null) ?? null,
        });
        setPaso("confirmar");
      } else {
        setAvisoSinIA(true);
        setPaso("manual");
      }
    } catch {
      if (miId !== idSolicitud.current) return;
      setAvisoSinIA(true);
      setPaso("manual");
    } finally {
      solicitudEnVuelo.current = false;
      if (miId === idSolicitud.current) setAnalizando(false);
    }
  }

  function handleDescribirManualmente() {
    // Invalida cualquier respuesta en vuelo de la IA (spec D1/D4): si llega
    // tarde, se ignora — el usuario ya decidió describirla él mismo.
    idSolicitud.current++;
    setAnalizando(false);
    setAvisoSinIA(false);
    setLecturaIA(null);
    setPaso("manual");
  }

  /** R3 — la persona confirmó (o corrigió) el patrón leído por la IA. */
  function handlePatronConfirmado(patron: Patron) {
    if (!lecturaIA) return;
    resolverGrieta(lecturaIA.observacion, "ia", lecturaIA.notaVisual, patron);
  }

  function handleManualCompleto(datos: { patron: Patron; banderas: Banderas }) {
    if (!declarado) return;
    const observacion: ObservacionGrieta = {
      elemento: declarado,
      patron: datos.patron,
      ancho_mm: null,
      banderas: datos.banderas,
      confianza: CONFIANZA_MANUAL,
      calidad_foto: "ok",
    };
    resolverGrieta(observacion, "manual", null);
  }

  /**
   * `patronDeclarado` (R3) solo viaja en el camino de la IA: en modo manual
   * el patrón ya lo puso la persona, así que no hay nada que contrastar.
   */
  function resolverGrieta(
    observacion: ObservacionGrieta,
    fuente: FuenteObservacion,
    notaVisual: string | null,
    patronDeclarado?: Patron
  ) {
    if (!declarado) return;
    const entrada: EntradaTriage = { declarado, observacion, fuente, pasante, patron_declarado: patronDeclarado };
    const evaluada = evaluarTriageGrieta(entrada);
    setResultadoActual({ evaluada, notaVisual });
    setPaso("resultado");
  }

  function handleContinuarDesdeResultado() {
    if (!resultadoActual || !fotoCerca || !fotoLejos) return;
    setGrietas((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        evaluada: resultadoActual.evaluada,
        notaVisual: resultadoActual.notaVisual,
        fotoCerca,
        fotoLejos,
      },
    ]);
    reiniciarGrietaEnConstruccion();
    setPaso("resumen");
  }

  function handleAgregarOtra() {
    setPaso("ubicar");
  }

  function handleTerminar() {
    setTerminado(true);
  }

  async function handleDescargarPdf() {
    if (generandoPdf || grietas.length === 0) return; // single-flight
    setErrorPdf(null);
    setGenerandoPdf(true);
    try {
      const grietasPayload = await Promise.all(
        grietas.map(async (g) => ({
          elementoDeclarado: g.evaluada.entrada.declarado,
          elementoFinal: g.evaluada.reconciliacion.elemento,
          hubo_discrepancia: g.evaluada.reconciliacion.hubo_discrepancia,
          veredicto: g.evaluada.veredicto,
          notaVisual: g.notaVisual,
          fotos: [
            { dataUrl: await blobToDataUrl(g.fotoCerca.blobEvidencia) },
            { dataUrl: await blobToDataUrl(g.fotoLejos.blobEvidencia) },
          ],
        }))
      );
      const res = await fetch("/api/alerta/informe-grietas-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grietas: grietasPayload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No pudimos generar el informe en PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe-de-grietas-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorPdf(err instanceof Error ? err.message : "No pudimos generar el informe en PDF.");
    } finally {
      setGenerandoPdf(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {paso === "ubicar" && <UbicarGrieta onSeleccionar={handleSeleccionElemento} />}

      {paso === "fotos" && declarado && (
        <div className="flex flex-col gap-4">
          {analizando ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-slate-700">Analizando la foto...</p>
              <button type="button" onClick={handleDescribirManualmente} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                Prefiero describirla yo
              </button>
            </div>
          ) : (
            <GrietaCameraCapture elementoDeclarado={declarado} onCompletar={handleFotosCompletas} />
          )}
        </div>
      )}

      {paso === "manual" && (
        <div className="flex flex-col gap-4">
          {avisoSinIA && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{COPY_SIN_IA}</p>}
          <DescribirGrietaManual onCompletar={handleManualCompleto} />
        </div>
      )}

      {paso === "confirmar" && lecturaIA && (
        <ConfirmarPatron
          elementoLeido={lecturaIA.observacion.elemento}
          patronLeido={lecturaIA.observacion.patron}
          notaVisual={lecturaIA.notaVisual}
          onConfirmar={handlePatronConfirmado}
        />
      )}

      {paso === "resultado" && resultadoActual && (
        <ResultadoGrieta
          grieta={resultadoActual.evaluada}
          numero={grietas.length + 1}
          notaVisual={resultadoActual.notaVisual}
          onContinuar={handleContinuarDesdeResultado}
        />
      )}

      {paso === "resumen" && grietas.length > 0 && (
        <>
          <ResumenInmueble
            grietas={grietas}
            terminado={terminado}
            presupuestoAgotado={presupuestoAgotado}
            generandoPdf={generandoPdf}
            errorPdf={errorPdf}
            onAgregarOtra={handleAgregarOtra}
            onTerminar={handleTerminar}
            onDescargarPdf={handleDescargarPdf}
          />
          <PuenteIngenieros />
        </>
      )}
    </div>
  );
}
