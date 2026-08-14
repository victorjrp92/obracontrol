"use client";

import Image from "next/image";
import { ArrowRight, FileCheck2, HandCoins, Landmark } from "lucide-react";
import type { CapturedPhotoActa } from "./ActaCameraCaptureJuntos";
import AvisoDocumento from "./AvisoDocumento";

export interface EspacioPreview {
  id: string;
  nombre: string;
  perdidas: string;
  fotos: CapturedPhotoActa[];
}

interface PreviewActaProps {
  tipoLabel: string;
  espacios: EspacioPreview[];
  onContinuar: () => void;
  onEditar: () => void;
}

/**
 * Vista previa del acta ANTES del gate de datos (spec-go-juntos.md): «Tu acta
 * está lista. Solo falta ponerle tu nombre.» — el documento real con sus
 * fotos y pérdidas, con los campos de identidad como huecos por llenar, y
 * las 3 líneas de uso (aseguradora / subsidios / cotizar la reparación).
 */
export default function PreviewActa({ tipoLabel, espacios, onContinuar, onEditar }: PreviewActaProps) {
  const totalFotos = espacios.reduce((n, e) => n + e.fotos.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 22 }}>Tu acta está lista. Solo falta ponerle tu nombre.</h2>
        <p className="desc">Así se ve el documento que vas a descargar:</p>
      </div>

      <div className="prev-doc" aria-label="Vista previa del acta de documentación de daños">
        <div className="prev-doc-cab">
          <span className="marca">
            <Image src="/seiricon-logo.png" alt="" width={18} height={18} /> SEIRICON · JUNTOS
          </span>
          <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--gris)" }}>Folio JT-…</span>
        </div>
        <p className="prev-doc-titulo">Acta de documentación de daños</p>

        <div className="prev-fila">
          <span>Nombre</span>
          <span className="prev-hueco">Tu nombre</span>
        </div>
        <div className="prev-fila">
          <span>Cédula</span>
          <span className="prev-hueco">Tu cédula</span>
        </div>
        <div className="prev-fila">
          <span>Dirección del inmueble</span>
          <span className="prev-hueco">Tu dirección</span>
        </div>
        <div className="prev-fila">
          <span>Tipo de inmueble</span>
          <b>{tipoLabel}</b>
        </div>
        <div className="prev-fila">
          <span>Espacios documentados</span>
          <b>
            {espacios.length} · {totalFotos} foto{totalFotos !== 1 ? "s" : ""}
          </b>
        </div>

        {espacios.map((e) => (
          <div key={e.id} style={{ marginTop: 8 }}>
            <p style={{ fontSize: 10.5, fontWeight: 800 }}>{e.nombre}</p>
            {e.perdidas.trim() && (
              <p style={{ fontSize: 9.5, fontWeight: 500, color: "var(--gris)" }}>Pérdidas: {e.perdidas.trim()}</p>
            )}
            <div className="prev-fotos">
              {e.fotos.map((f, i) => (
                <img key={i} src={f.preview} alt={`Foto ${i + 1} de ${e.nombre}`} />
              ))}
            </div>
          </div>
        ))}

        <p className="prev-pie">
          Cada foto lleva la fecha, la hora y el GPS quemados · Verificación con folio y huella digital del
          documento en el pie de cada página.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p className="gancho-punto">
          <FileCheck2 className="ic" aria-hidden="true" />
          <span>
            <b>Para tu aseguradora:</b> el daño documentado con fecha, ubicación y tu declaración.
          </span>
        </p>
        <p className="gancho-punto">
          <Landmark className="ic" aria-hidden="true" />
          <span>
            <b>Para pedir ayudas del Estado:</b> el registro de damnificados pide fotos de los daños — estas son.
          </span>
        </p>
        <p className="gancho-punto">
          <HandCoins className="ic" aria-hidden="true" />
          <span>
            <b>Para cotizar la reparación:</b> con el daño documentado, nadie te lo improvisa después.
          </span>
        </p>
      </div>

      <AvisoDocumento />

      <div className="cta-abajo">
        <button type="button" onClick={onContinuar} className="btn btn-azul">
          Ponerle mi nombre y descargarla <ArrowRight className="ic" aria-hidden="true" />
        </button>
        <button type="button" onClick={onEditar} className="btn btn-fantasma">
          Volver a editar los espacios
        </button>
      </div>
    </div>
  );
}
