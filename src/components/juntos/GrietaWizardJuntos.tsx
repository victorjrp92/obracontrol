"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { blobToDataUrl } from "@/lib/media/overlay";
import { MAX_BODY_BYTES, estimarBytesBase64 } from "@/lib/alerta/acta";
import type { InformeJuntosPayload } from "@/lib/juntos/informe-juntos";
import type { DerechoPeticionPayload } from "@/lib/juntos/derecho-peticion";
import {
  evaluarTriageGrieta,
  type EntradaTriage,
  type FuenteObservacion,
  type GrietaEvaluada,
  type RespuestaPasante,
} from "@/lib/alerta/triage";
import { COPY_SIN_IA, LABEL_ELEMENTO } from "@/lib/alerta/copys";
import type { Banderas, Elemento, ObservacionGrieta, Patron } from "@/lib/alerta/tipos";
import UbicarGrietaJuntos from "./UbicarGrietaJuntos";
import GrietaCameraCaptureJuntos, { type CapturedPhotoGrieta } from "./GrietaCameraCaptureJuntos";
import DescribirGrietaManualJuntos from "./DescribirGrietaManualJuntos";
import ResultadoGrietaJuntos from "./ResultadoGrietaJuntos";
import ResumenInmuebleJuntos from "./ResumenInmuebleJuntos";
import GateDatos, { type DatosGate } from "./GateDatos";
import PostDescarga from "./PostDescarga";

type Paso = "ubicar" | "fotos" | "manual" | "resultado" | "resumen" | "gate" | "post";

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
 * Flujo completo del wizard de grietas de «Juntos» (/go/juntos/revisar) —
 * adaptado de GrietaWizard de Karen. Su máquina de estados y el single-flight
 * de la llamada a observar-grieta se conservan (están bien hechos). Cambios
 * Juntos (spec-go-juntos.md): re-skin Aizome, corrección del bug de
 * revokeObjectURL (las fotos YA GUARDADAS en `grietas` no se revocan al
 * limpiar la grieta en construcción), y pantalla post-descarga con las
 * tarjetas-gancho como paso final. Todo vive en memoria del navegador: nada
 * se persiste, el PDF se genera bajo demanda.
 *
 * El resultado del triage (prioridad + qué hacer / qué no hacer) es GRATIS y
 * visible sin pedir nada: pasos `resultado` y `resumen`. El gate de datos SOLO
 * se interpone antes de GENERAR EL PDF (paso `gate`), igual que en el acta —
 * todo PDF que se descargue exige el gate. La cédula y la dirección viajan
 * solo en el request del PDF: no se persisten ni se loguean.
 */
export default function GrietaWizardJuntos() {
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
  const [resultadoActual, setResultadoActual] = useState<{ evaluada: GrietaEvaluada; notaVisual: string | null } | null>(
    null
  );

  // Single-flight de la llamada a observar-grieta + guarda contra respuestas
  // tardías si el usuario elige "prefiero describirla yo" con la petición en vuelo.
  const solicitudEnVuelo = useRef(false);
  const idSolicitud = useRef(0);

  // Gate de datos → informe en PDF.
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const [ciudadGate, setCiudadGate] = useState<string | null>(null);
  // Datos del gate: quedan en memoria para poder generar el derecho de
  // petición sin volver a pedirlos. NO se persisten (cédula y dirección
  // solo viajan en el request del PDF y mueren con él).
  const [datosGate, setDatosGate] = useState<DatosGate | null>(null);
  const [folioInforme, setFolioInforme] = useState<string | null>(null);
  const [generandoDp, setGenerandoDp] = useState(false);
  const [errorDp, setErrorDp] = useState<string | null>(null);
  const [dpDescargado, setDpDescargado] = useState(false);
  // El contacto se envía UNA sola vez por sesión del wizard: si el PDF falla
  // (429/500/red) y la persona reintenta el gate, no se duplica la fila en
  // contacto_juntos (el contacto y el PDF son independientes a propósito).
  const contactoEnviado = useRef(false);

  const totalBytesEvidencia = grietas.reduce(
    (n, g) => n + g.fotoCerca.blobEvidencia.size + g.fotoLejos.blobEvidencia.size,
    0
  );
  const presupuestoAgotado = estimarBytesBase64(totalBytesEvidencia) >= MAX_BODY_BYTES;

  /**
   * Limpia la grieta en construcción DESPUÉS de guardarla en `grietas`.
   * CORRECCIÓN del spec: aquí NO se revocan los object URLs — las fotos ya
   * pertenecen a la grieta guardada (el bug de Karen las revocaba y dejaba
   * previews muertos). Los URLs viven hasta que se cierre la página.
   */
  function limpiarTrasGuardar() {
    setDeclarado(null);
    setFotoCerca(null);
    setFotoLejos(null);
    setPasante("no_se");
    setAvisoSinIA(false);
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
        resolverGrieta(data.observacion as ObservacionGrieta, "ia", (data.notaVisual as string | null) ?? null);
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
    // Invalida cualquier respuesta en vuelo de la IA: si llega tarde, se ignora.
    idSolicitud.current++;
    setAnalizando(false);
    setAvisoSinIA(false);
    setPaso("manual");
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

  function resolverGrieta(observacion: ObservacionGrieta, fuente: FuenteObservacion, notaVisual: string | null) {
    if (!declarado) return;
    const entrada: EntradaTriage = { declarado, observacion, fuente, pasante };
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
    limpiarTrasGuardar();
    setPaso("resumen");
  }

  function handleAgregarOtra() {
    setPaso("ubicar");
  }

  function handleTerminar() {
    setTerminado(true);
  }

  async function construirPayload(datos: DatosGate): Promise<InformeJuntosPayload> {
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
    return {
      identidad: {
        nombre: datos.nombre,
        cedula: datos.cedula,
        whatsapp: datos.whatsapp,
        direccion: datos.direccion,
        ciudad: datos.ciudad,
      },
      grietas: grietasPayload,
    };
  }

  /** Gate de datos → PDF. Es el ÚNICO camino a la descarga del informe. */
  async function handleGate(datos: DatosGate) {
    if (generandoPdf || grietas.length === 0) return; // single-flight
    setErrorPdf(null);
    setGenerandoPdf(true);
    try {
      // 1) Contacto: SOLO nombre/whatsapp/ciudad/audiencia/acepta_contacto
      // (jamás cédula ni dirección — regla dura del spec). Best-effort: si
      // falla, el informe se descarga igual — y solo se envía una vez aunque
      // el PDF falle y la persona reintente.
      if (!contactoEnviado.current) {
        contactoEnviado.current = true;
        fetch("/api/juntos/contacto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: datos.nombre,
            whatsapp: datos.whatsapp,
            ciudad: datos.ciudad,
            audiencia: datos.audiencia,
            acepta_contacto: datos.aceptaContacto,
            origen: "revisar-gate",
            sitio_web: datos.sitioWeb,
          }),
        }).catch(() => {});
      }

      // 2) El informe: cédula y dirección viajan SOLO aquí, se imprimen y se descartan.
      const payload = await construirPayload(datos);
      const res = await fetch("/api/juntos/informe-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No pudimos generar el informe en PDF.");
      }
      // Mismo folio que imprime el PDF en su pie (contrato con la ruta).
      const folio = res.headers.get("X-Juntos-Folio");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe-de-grietas-${folio ?? new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setCiudadGate(datos.ciudad);
      setDatosGate(datos);
      setFolioInforme(folio);
      setPaso("post"); // paso final: tarjetas-gancho (spec)
    } catch (err) {
      setErrorPdf(err instanceof Error ? err.message : "No pudimos generar el informe en PDF.");
    } finally {
      setGenerandoPdf(false);
    }
  }

  /** El derecho de petición también aquí: quien revisa una grieta puede
   *  necesitar pedir ayudas igual que quien levanta el acta. Los daños
   *  declarados son las grietas evaluadas. */
  async function handleDerechoPeticion() {
    if (generandoDp || !datosGate) return; // single-flight
    setErrorDp(null);
    setGenerandoDp(true);
    try {
      const payload: DerechoPeticionPayload = {
        identidad: {
          nombre: datosGate.nombre,
          cedula: datosGate.cedula,
          whatsapp: datosGate.whatsapp,
          direccion: datosGate.direccion,
          ciudad: datosGate.ciudad,
        },
        danos: grietas.map((g, i) => ({
          espacio: `Grieta ${i + 1} — ${LABEL_ELEMENTO[g.evaluada.reconciliacion.elemento]}`,
          descripcion: g.evaluada.veredicto.que_hacer,
        })),
        folioActa: folioInforme,
      };
      const res = await fetch("/api/juntos/derecho-peticion-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No pudimos generar el documento.");
      }
      const folioDp = res.headers.get("X-Juntos-Folio");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `derecho-de-peticion-${folioDp ?? new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDpDescargado(true);
    } catch (err) {
      setErrorDp(err instanceof Error ? err.message : "No pudimos generar el documento.");
    } finally {
      setGenerandoDp(false);
    }
  }

  // Al llegar a la pantalla final, subir al tope: lo primero que debe ver es
  // la carpeta con el documento que le falta, no el punto donde quedó el scroll.
  useEffect(() => {
    if (paso !== "post") return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: quieto ? "auto" : "smooth" });
  }, [paso]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {paso === "ubicar" && <UbicarGrietaJuntos onSeleccionar={handleSeleccionElemento} />}

      {paso === "fotos" && declarado && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {analizando ? (
            <div className="panel" style={{ alignItems: "center", textAlign: "center" }}>
              <Loader2
                className="ic"
                style={{ width: 26, height: 26, color: "var(--azul)", animation: "ljt-girar 1s linear infinite" }}
              />
              <p style={{ fontSize: 14, fontWeight: 700 }}>Leyendo la foto...</p>
              <button type="button" onClick={handleDescribirManualmente} className="btn btn-fantasma">
                Prefiero describirla yo
              </button>
            </div>
          ) : (
            <GrietaCameraCaptureJuntos elementoDeclarado={declarado} onCompletar={handleFotosCompletas} />
          )}
        </div>
      )}

      {paso === "manual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {avisoSinIA && <p className="aviso">{COPY_SIN_IA}</p>}
          <DescribirGrietaManualJuntos onCompletar={handleManualCompleto} />
        </div>
      )}

      {paso === "resultado" && resultadoActual && (
        <ResultadoGrietaJuntos
          grieta={resultadoActual.evaluada}
          numero={grietas.length + 1}
          notaVisual={resultadoActual.notaVisual}
          onContinuar={handleContinuarDesdeResultado}
        />
      )}

      {paso === "resumen" && grietas.length > 0 && (
        <ResumenInmuebleJuntos
          grietas={grietas}
          terminado={terminado}
          presupuestoAgotado={presupuestoAgotado}
          onAgregarOtra={handleAgregarOtra}
          onTerminar={handleTerminar}
          onDescargarPdf={() => setPaso("gate")}
        />
      )}

      {paso === "gate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <GateDatos variante="informe" enviando={generandoPdf} error={errorPdf} onEnviar={handleGate} />
          <button type="button" onClick={() => setPaso("resumen")} className="btn btn-fantasma" style={{ alignSelf: "flex-start" }}>
            <ArrowLeft className="ic" aria-hidden="true" /> Volver al resumen
          </button>
        </div>
      )}

      {paso === "post" && (
        <PostDescarga
          variante="informe"
          ciudad={ciudadGate}
          derechoPeticion={
            datosGate
              ? {
                  generando: generandoDp,
                  error: errorDp,
                  onDescargar: handleDerechoPeticion,
                  descargado: dpDescargado,
                }
              : null
          }
        />
      )}
    </div>
  );
}
