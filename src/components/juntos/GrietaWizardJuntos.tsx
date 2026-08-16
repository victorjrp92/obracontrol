"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { blobToDataUrl } from "@/lib/media/overlay";
import type { VeredictoCalidad } from "@/lib/media/calidad-foto";
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
import { DIAGNOSTICO_FOTO, type Banderas, type Elemento, type ObservacionGrieta, type Patron, type ProblemaCalidadFoto } from "@/lib/alerta/tipos";
import UbicarGrietaJuntos from "./UbicarGrietaJuntos";
import GrietaCameraCaptureJuntos, { type CapturedPhotoGrieta } from "./GrietaCameraCaptureJuntos";
import DescribirGrietaManualJuntos from "./DescribirGrietaManualJuntos";
import ResultadoGrietaJuntos from "./ResultadoGrietaJuntos";
import ResumenInmuebleJuntos from "./ResumenInmuebleJuntos";
import GateDatos, { type DatosGate } from "./GateDatos";
import PostDescarga from "./PostDescarga";

type Paso = "ubicar" | "fotos" | "foto_mala" | "manual" | "resultado" | "resumen" | "gate" | "post";

/**
 * Cuántas veces se le ofrece repetir la foto por grieta antes de pasar
 * derecho a modo manual. Con una alcanza: si la segunda tanda vuelve a salir
 * mal, insistir es dejar a alguien atrapado en un bucle de cámara.
 */
const MAX_REPETICIONES_FOTO = 1;

/** Valida contra el enum antes de mostrarle nada a la persona (el texto lo pone el cliente, no el servidor). */
function esProblemaCalidad(valor: unknown): valor is ProblemaCalidadFoto {
  return typeof valor === "string" && valor in DIAGNOSTICO_FOTO;
}

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
 * Equivalencia entre los dos controles de calidad de foto que existen.
 *
 * `src/lib/media/calidad-foto.ts` mide nitidez y exposición EN EL CELULAR antes
 * de subir; el modelo de visión vuelve a juzgarlas del otro lado. Sus
 * vocabularios se solapan justo en «oscura» y «movida».
 *
 * `muy_clara` no está aquí porque el servidor no tiene ese veredicto: si el
 * modelo se queja por otra razón, es un reclamo nuevo y sí vale preguntarlo.
 */
const EQUIVALENCIA_CALIDAD: Partial<Record<VeredictoCalidad, ProblemaCalidadFoto>> = {
  oscura: "oscura",
  movida: "movida",
};

/**
 * ¿El chequeo del dispositivo ya avisó de ESTE mismo problema, y la persona
 * decidió continuar de todos modos?
 *
 * Sin esto el recorrido sería: el celular avisa «salió movida» → la persona
 * elige «continuar así» → sube la foto → y el servidor le pide repetirla por lo
 * mismo. Preguntar dos veces por el mismo problema, después de que ya decidió,
 * no es cuidado: es no escuchar. Y alguien asustado, de noche y con mala señal,
 * abandona ahí.
 *
 * Cuando el reclamo se repite se salta el paso de repetir y se va a modo
 * manual, que es la salida digna: describe la grieta con sus palabras y el
 * triage la trata como fuente «manual» (T4 — nunca resuelve en verde).
 */
function yaSeAvisoEnElDispositivo(
  problemaDelServidor: ProblemaCalidadFoto,
  ...fotos: CapturedPhotoGrieta[]
): boolean {
  return fotos.some((f) => {
    const veredicto = f.calidad?.veredicto;
    if (!veredicto || veredicto === "ok") return false;
    return EQUIVALENCIA_CALIDAD[veredicto] === problemaDelServidor;
  });
}

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
  // Foto que el modelo sí leyó pero marcó como inservible (motivo "foto_mala"):
  // se le ofrece repetirla en vez de arrastrar una lectura dudosa.
  const [problemaFoto, setProblemaFoto] = useState<ProblemaCalidadFoto | null>(null);
  const repeticionesFoto = useRef(0);
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
    setProblemaFoto(null);
    repeticionesFoto.current = 0;
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
      } else if (
        data?.motivo === "foto_mala" &&
        esProblemaCalidad(data.calidad_foto) &&
        repeticionesFoto.current < MAX_REPETICIONES_FOTO &&
        !yaSeAvisoEnElDispositivo(data.calidad_foto, cerca, lejos)
      ) {
        // El modelo leyó la foto y dijo que no daba: la persona puede repetirla.
        setProblemaFoto(data.calidad_foto);
        setPaso("foto_mala");
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

  /** "foto_mala" → volver a la cámara. Las fotos descartadas no van al PDF: se liberan sus previews. */
  function handleRepetirFotos() {
    repeticionesFoto.current += 1;
    if (fotoCerca) URL.revokeObjectURL(fotoCerca.preview);
    if (fotoLejos) URL.revokeObjectURL(fotoLejos.preview);
    setFotoCerca(null);
    setFotoLejos(null);
    setPasante("no_se");
    setProblemaFoto(null);
    setPaso("fotos");
  }

  /** "foto_mala" → seguir a mano. Las fotos SE CONSERVAN: son la evidencia que va al PDF. */
  function handleSeguirSinRepetir() {
    setProblemaFoto(null);
    setAvisoSinIA(true);
    setPaso("manual");
  }

  function handleManualCompleto(datos: { patron: Patron; banderas: Banderas; ancho_mm: number | null }) {
    if (!declarado) return;
    const observacion: ObservacionGrieta = {
      elemento: declarado,
      patron: datos.patron,
      // El ancho lo estima la persona comparando con el canto de la moneda de
      // $500. Antes iba fijo en `null`, y eso apagaba la regla 4 de reglas.ts
      // (muro de carga con ancho > 3 mm → ROJO): una grieta ancha en un muro de
      // carga salía AMARILLA. Era el único punto donde el sistema subestimaba.
      ancho_mm: datos.ancho_mm,
      banderas: datos.banderas,
      // `confianza.ancho` solo alimenta la regla 7 de reglas.ts, que es lo único
      // que impide llegar a verde por una lectura dudosa. En modo manual eso ya
      // lo cubre T4 de triage.ts (una descripción propia nunca resuelve en
      // verde), así que bajarla aquí no cambiaría el nivel y sí cambiaría la
      // razón que ve la persona por una menos clara. Se deja como estaba.
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

      {paso === "foto_mala" && problemaFoto && (
        <div className="panel">
          <div>
            <h2 style={{ fontSize: 17 }}>{DIAGNOSTICO_FOTO[problemaFoto].queFallo}</h2>
            <p className="desc">
              {DIAGNOSTICO_FOTO[problemaFoto].consejo} Con una foto mejor, la lectura automática puede medir la grieta.
            </p>
          </div>
          <div className="cta-abajo">
            <button type="button" onClick={handleRepetirFotos} className="btn btn-azul">
              <Camera className="ic" aria-hidden="true" /> Repetir las fotos
            </button>
            <button type="button" onClick={handleSeguirSinRepetir} className="btn btn-fantasma">
              Prefiero describirla yo
            </button>
          </div>
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
