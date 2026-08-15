"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building, Building2, Home, Plus, Store, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import { blobToDataUrl } from "@/lib/media/overlay";
import { MAX_BODY_BYTES, MAX_ESPACIOS, MAX_FOTOS, estimarBytesBase64, type TipoInmueble } from "@/lib/alerta/acta";
import type { ActaJuntosPayload } from "@/lib/juntos/acta-juntos";
import type { DerechoPeticionPayload } from "@/lib/juntos/derecho-peticion";
import ActaCameraCaptureJuntos, { type CapturedPhotoActa } from "./ActaCameraCaptureJuntos";
import PreviewActa, { type EspacioPreview } from "./PreviewActa";
import GateDatos, { type DatosGate } from "./GateDatos";
import PostDescarga, { type DerechoPeticionControles } from "./PostDescarga";

type Paso = "tipo" | "espacios" | "preview" | "gate" | "post";

const TIPOS: { key: TipoInmueble; label: string; Icon: LucideIcon }[] = [
  { key: "CASA", label: "Casa", Icon: Home },
  { key: "APARTAMENTO", label: "Apartamento", Icon: Building2 },
  { key: "EDIFICIO", label: "Edificio", Icon: Building },
  { key: "LOCAL", label: "Local", Icon: Store },
];

/**
 * Wizard del acta de documentación de daños (/go/juntos/documentar) —
 * adaptado de ActaWizard de Karen al flujo del spec-go-juntos.md:
 * tipo de inmueble → espacios (fotos con GPS/fecha quemados + descripción de
 * pérdidas por espacio) → vista previa del PDF → gate de datos (2 casillas
 * Ley 1581, cédula NO se guarda — y se dice) → descarga → pantalla
 * post-descarga con tarjetas-gancho y derecho de petición.
 *
 * La dirección NO se pide aquí (vive en el gate, se imprime y se descarta).
 * Todo el estado vive en memoria del navegador; nada se persiste hasta el
 * gate, y del gate SOLO nombre/whatsapp/ciudad/audiencia/acepta_contacto.
 */
export default function ActaWizardJuntos({ modoAfuera = false }: { modoAfuera?: boolean }) {
  const [paso, setPaso] = useState<Paso>("tipo");

  // Paso 1 — tipo de inmueble (nada preseleccionado).
  const [tipoInmueble, setTipoInmueble] = useState<TipoInmueble | null>(null);

  // Paso 2 — espacios guardados + espacio en edición.
  const [espacios, setEspacios] = useState<EspacioPreview[]>([]);
  const [espacioKey, setEspacioKey] = useState(0);
  const [nombreActual, setNombreActual] = useState(modoAfuera ? "Fachada y exterior" : "");
  const [perdidasActual, setPerdidasActual] = useState("");
  const [fotosActual, setFotosActual] = useState<CapturedPhotoActa[]>([]);
  const [errorEspacio, setErrorEspacio] = useState<string | null>(null);

  // Gate → PDF.
  const [enviandoActa, setEnviandoActa] = useState(false);
  const [errorActa, setErrorActa] = useState<string | null>(null);
  const [datosGate, setDatosGate] = useState<DatosGate | null>(null);
  const [folioActa, setFolioActa] = useState<string | null>(null);
  // El contacto se envía UNA sola vez por sesión del wizard: si el PDF falla
  // (429/500/red) y la persona reintenta el gate, no se duplica la fila en
  // contacto_juntos (el contacto y el PDF son independientes a propósito).
  const contactoEnviado = useRef(false);

  // Derecho de petición (post-descarga).
  const [generandoDp, setGenerandoDp] = useState(false);
  // La carpeta necesita saber si ya bajó el segundo documento para pasar a «2 de 2».
  const [dpDescargado, setDpDescargado] = useState(false);
  const [errorDp, setErrorDp] = useState<string | null>(null);

  // Topes globales en vivo (fotos guardadas + en edición).
  const totalFotos = espacios.reduce((n, e) => n + e.fotos.length, 0) + fotosActual.length;
  const totalBytes =
    espacios.reduce((n, e) => n + e.fotos.reduce((m, f) => m + f.blob.size, 0), 0) +
    fotosActual.reduce((m, f) => m + f.blob.size, 0);
  const topeFotosAlcanzado = totalFotos >= MAX_FOTOS || estimarBytesBase64(totalBytes) >= MAX_BODY_BYTES;
  const puedeAgregarMasEspacios = espacios.length < MAX_ESPACIOS;

  function quitarEspacio(id: string) {
    setEspacios((prev) => {
      const objetivo = prev.find((e) => e.id === id);
      objetivo?.fotos.forEach((f) => URL.revokeObjectURL(f.preview));
      return prev.filter((e) => e.id !== id);
    });
  }

  /** Valida y guarda el espacio en edición. Devuelve false si hay error. */
  function guardarEspacioActual(): boolean {
    const nombre = nombreActual.trim();
    if (!nombre) {
      setErrorEspacio("Ponle un nombre al espacio (ej: Cocina, Fachada, Habitación principal).");
      return false;
    }
    if (fotosActual.length === 0) {
      setErrorEspacio("Agrega al menos una foto de este espacio.");
      return false;
    }
    setEspacios((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nombre, perdidas: perdidasActual.trim(), fotos: fotosActual },
    ]);
    setNombreActual("");
    setPerdidasActual("");
    setFotosActual([]);
    setEspacioKey((k) => k + 1);
    setErrorEspacio(null);
    return true;
  }

  function handleTerminarEspacios() {
    const hayContenidoSinGuardar = nombreActual.trim() !== "" || fotosActual.length > 0;
    if (hayContenidoSinGuardar) {
      if (!guardarEspacioActual()) return;
      setPaso("preview");
      return;
    }
    if (espacios.length === 0) {
      setErrorEspacio("Agrega al menos un espacio con fotos antes de continuar.");
      return;
    }
    setPaso("preview");
  }

  async function construirPayload(datos: DatosGate): Promise<ActaJuntosPayload> {
    const espaciosPayload = await Promise.all(
      espacios.map(async (e) => ({
        nombre: e.nombre,
        nota: e.perdidas.trim() || null,
        fotos: await Promise.all(e.fotos.map(async (f) => ({ dataUrl: await blobToDataUrl(f.blob) }))),
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
      inmueble: { tipo: tipoInmueble ?? "CASA" },
      espacios: espaciosPayload,
    };
  }

  async function handleGate(datos: DatosGate) {
    if (enviandoActa) return; // single-flight
    setErrorActa(null);
    setEnviandoActa(true);
    try {
      // 1) Contacto: SOLO nombre/whatsapp/ciudad/audiencia/acepta_contacto
      // (jamás cédula ni dirección — regla dura del spec). Best-effort: si
      // falla, el acta se descarga igual — y solo se envía una vez aunque el
      // PDF falle y la persona reintente.
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
            origen: modoAfuera ? "documentar-afuera" : "documentar-gate",
            sitio_web: datos.sitioWeb,
          }),
        }).catch(() => {});
      }

      // 2) El acta: cédula y dirección viajan SOLO aquí, se imprimen y se descartan.
      const payload = await construirPayload(datos);
      const res = await fetch("/api/juntos/acta-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No pudimos generar el acta en PDF.");
      }
      const folio = res.headers.get("X-Juntos-Folio");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acta-documentacion-danos-${folio ?? new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDatosGate(datos);
      setFolioActa(folio);
      setPaso("post");
    } catch (err) {
      setErrorActa(err instanceof Error ? err.message : "No pudimos generar el acta en PDF.");
    } finally {
      setEnviandoActa(false);
    }
  }

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
        danos: espacios.map((e) => ({ espacio: e.nombre, descripcion: e.perdidas.trim() || null })),
        folioActa,
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
      // Mismo folio DP- que imprime el PDF en su pie (contrato con la ruta).
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
      setDpDescargado(true); // la carpeta pasa a «2 de 2»
    } catch (err) {
      setErrorDp(err instanceof Error ? err.message : "No pudimos generar el documento.");
    } finally {
      setGenerandoDp(false);
    }
  }

  const controlesDp: DerechoPeticionControles = {
    generando: generandoDp,
    error: errorDp,
    onDescargar: handleDerechoPeticion,
    descargado: dpDescargado,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {paso !== "post" && <IndicadorPaso paso={paso} />}

      {modoAfuera && paso !== "post" && (
        <p className="error-inline" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <TriangleAlert className="ic" style={{ marginTop: 2 }} aria-hidden="true" />
          Estás documentando desde afuera. Fotografía solo la fachada y el exterior — no vuelvas a entrar
          por una foto.
        </p>
      )}

      {paso === "tipo" && (
        <div className="panel">
          <div>
            <h2>¿Qué tipo de inmueble es?</h2>
            <p className="desc">El acta lo identifica así en el documento.</p>
          </div>
          <div className="opciones">
            {TIPOS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTipoInmueble(t.key)}
                aria-pressed={tipoInmueble === t.key}
                className={`opcion ${tipoInmueble === t.key ? "sel" : ""}`}
              >
                <t.Icon style={{ width: 26, height: 26, color: tipoInmueble === t.key ? "var(--azul)" : "var(--gris)" }} aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
          <div className="cta-abajo">
            <button
              type="button"
              onClick={() => tipoInmueble && setPaso("espacios")}
              disabled={!tipoInmueble}
              className="btn btn-azul"
            >
              Siguiente <ArrowRight className="ic" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {paso === "espacios" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="micro" style={{ marginTop: 0 }}>
            {totalFotos}/{MAX_FOTOS} fotos · {espacios.length}/{MAX_ESPACIOS} espacios
          </p>

          {espacios.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {espacios.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    background: "#fff",
                    border: "2px solid var(--gris-bde)",
                    borderRadius: 14,
                    padding: "10px 8px 10px 14px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800 }}>{e.nombre}</p>
                    <p className="micro" style={{ marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.fotos.length} foto{e.fotos.length !== 1 ? "s" : ""}
                      {e.perdidas ? ` · ${e.perdidas}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarEspacio(e.id)}
                    aria-label={`Quitar ${e.nombre}`}
                    style={{
                      flex: "none",
                      width: 44,
                      height: 44,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 12,
                      border: "none",
                      background: "transparent",
                      color: "var(--gris)",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 style={{ width: 19, height: 19 }} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {puedeAgregarMasEspacios ? (
            <div className="panel">
              <h2 style={{ fontSize: 17 }}>
                {espacios.length === 0 ? "Agrega el primer espacio dañado" : "Agrega otro espacio dañado"}
              </h2>

              <div className="campo">
                <label htmlFor="jt-espacio-nombre">Nombre del espacio</label>
                <input
                  id="jt-espacio-nombre"
                  type="text"
                  value={nombreActual}
                  onChange={(e) => setNombreActual(e.target.value)}
                  placeholder="Ej: Cocina, Fachada, Habitación principal"
                />
              </div>

              <div className="campo">
                <label>Fotos del espacio</label>
                <p className="pista">Cada foto queda con la fecha, la hora y el GPS quemados en la imagen.</p>
                <ActaCameraCaptureJuntos
                  key={espacioKey}
                  espacioNombre={nombreActual || "Espacio sin nombre"}
                  maxPhotos={MAX_FOTOS}
                  disabled={topeFotosAlcanzado}
                  onChange={setFotosActual}
                />
              </div>

              <div className="campo">
                <label htmlFor="jt-espacio-perdidas">
                  ¿Qué se dañó o se perdió aquí? <span style={{ fontWeight: 500, color: "var(--gris)" }}>(opcional)</span>
                </label>
                <p className="pista">Esto alimenta el resumen de daños del acta — el que pide el registro de damnificados.</p>
                <textarea
                  id="jt-espacio-perdidas"
                  value={perdidasActual}
                  onChange={(e) => setPerdidasActual(e.target.value)}
                  placeholder="Ej: Grieta desde la ventana hasta el piso; se cayó parte del enchape"
                  rows={2}
                />
              </div>

              {errorEspacio && <p className="error-inline">{errorEspacio}</p>}

              <button type="button" onClick={guardarEspacioActual} className="btn btn-chico" style={{ alignSelf: "flex-start" }}>
                <Plus className="ic" aria-hidden="true" /> Guardar espacio y seguir con otro
              </button>
            </div>
          ) : (
            <p className="aviso">Llegaste al máximo de {MAX_ESPACIOS} espacios por acta.</p>
          )}

          <div className="cta-abajo">
            <button type="button" onClick={handleTerminarEspacios} className="btn btn-azul">
              Ver mi acta <ArrowRight className="ic" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setPaso("tipo")} className="btn btn-fantasma">
              <ArrowLeft className="ic" aria-hidden="true" /> Atrás
            </button>
          </div>
        </div>
      )}

      {paso === "preview" && (
        <PreviewActa
          tipoLabel={TIPOS.find((t) => t.key === tipoInmueble)?.label ?? "Inmueble"}
          espacios={espacios}
          onContinuar={() => setPaso("gate")}
          onEditar={() => setPaso("espacios")}
        />
      )}

      {paso === "gate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <GateDatos enviando={enviandoActa} error={errorActa} onEnviar={handleGate} />
          <button type="button" onClick={() => setPaso("preview")} className="btn btn-fantasma" style={{ alignSelf: "flex-start" }}>
            <ArrowLeft className="ic" aria-hidden="true" /> Volver a la vista previa
          </button>
        </div>
      )}

      {paso === "post" && (
        <PostDescarga variante="acta" ciudad={datosGate?.ciudad ?? null} derechoPeticion={controlesDp} />
      )}
    </div>
  );
}

function IndicadorPaso({ paso }: { paso: Paso }) {
  const pasos: { key: Paso; label: string }[] = [
    { key: "tipo", label: "Inmueble" },
    { key: "espacios", label: "Espacios y fotos" },
    { key: "preview", label: "Tu acta" },
    { key: "gate", label: "Descarga" },
  ];
  const indiceActual = pasos.findIndex((p) => p.key === paso);

  return (
    <div className="jt-migas" aria-hidden="true">
      {pasos.map((p, i) => (
        <span key={p.key} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span className={i <= indiceActual ? "act" : ""}>{p.label}</span>
          {i < pasos.length - 1 && <span className="sep">→</span>}
        </span>
      ))}
    </div>
  );
}
