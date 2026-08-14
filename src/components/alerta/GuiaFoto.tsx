import { Coins, Footprints } from "lucide-react";
import { MONEDA_REFERENCIA } from "./config";

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
      `Pega o sostén una moneda de ${MONEDA_REFERENCIA.nombre} justo al lado de la grieta.`,
      "Acércate a unos 30 cm, que se vea la grieta y la moneda completa y nítida.",
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
};

/**
 * Tarjeta de instrucción + diagrama ANTES de abrir la cámara (spec D6): no se
 * puede dibujar una guía encima del visor nativo, así que la "guía en
 * pantalla" es esto — se muestra antes de la captura, y la confirmación va
 * DESPUÉS (ver ConfirmarFoto en GrietaCameraCapture.tsx).
 */
export default function GuiaFoto({ tipo }: { tipo: "cerca" | "lejos" }) {
  const c = CONTENIDO[tipo];
  const Icon = c.Icon;
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="text-sm font-bold text-blue-900 sm:text-base">{c.titulo}</h3>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 pl-1 text-sm text-blue-800">
        {c.instrucciones.map((linea) => (
          <li key={linea}>• {linea}</li>
        ))}
      </ul>
    </div>
  );
}
