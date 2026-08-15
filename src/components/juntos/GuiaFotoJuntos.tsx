import { Coins, Footprints } from "lucide-react";
import { MONEDA_REFERENCIA } from "@/components/juntos/config";
import MonedaDemo from "./MonedaDemo";

interface ContenidoGuia {
  titulo: string;
  Icon: typeof Coins;
  instrucciones: string[];
}

const CONTENIDO: Record<"cerca" | "lejos", ContenidoGuia> = {
  cerca: {
    titulo: `Foto 1 de 2 — Acércate con una moneda de ${MONEDA_REFERENCIA.nombre}`,
    Icon: Coins,
    instrucciones: [
      `Pega o sostén una moneda de ${MONEDA_REFERENCIA.nombre} PLANA contra la pared, justo al lado de la grieta.`,
      "Acércate a unos 30 cm: que la grieta y la moneda completa se vean nítidas.",
      "Evita sombras fuertes o contraluz — usa buena luz.",
    ],
  },
  lejos: {
    titulo: "Foto 2 de 2 — Dos o tres pasos atrás",
    Icon: Footprints,
    instrucciones: [
      "Aléjate dos o tres pasos.",
      "Encuadra el elemento completo, de piso a techo (la columna, el muro o la viga entera).",
      "No hace falta la moneda en esta foto.",
    ],
  },
}

/**
 * Guía ANTES de abrir la cámara (no se puede dibujar sobre el visor nativo):
 * instrucciones + la animación de la moneda cuando es la foto de
 * acercamiento, + el aviso de privacidad de la foto (spec-go-juntos.md,
 * Seguridad). La confirmación va DESPUÉS de capturar (ConfirmarFoto en
 * GrietaCameraCaptureJuntos.tsx).
 */
export default function GuiaFotoJuntos({ tipo }: { tipo: "cerca" | "lejos" }) {
  const c = CONTENIDO[tipo];
  const Icon = c.Icon;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="aviso-azul aviso">
        <span style={{ display: "flex", gap: 9, alignItems: "center", fontWeight: 800 }}>
          <Icon className="ic" aria-hidden="true" />
          {c.titulo}
        </span>
        <ul style={{ listStyle: "none", marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
          {c.instrucciones.map((linea) => (
            <li key={linea}>— {linea}</li>
          ))}
        </ul>
      </div>

      {tipo === "cerca" && <MonedaDemo />}

      <p className="micro" style={{ marginTop: 0 }}>
        La foto se analiza para ayudarte a clasificarla y no se guarda en nuestros servidores.
      </p>
    </div>
  );
}
