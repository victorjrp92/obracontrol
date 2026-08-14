// Configuración editable de /alerta (Seiricon Alerta). Mismo patrón que
// src/components/beta/config.ts: valores que se pueden ajustar sin tocar el
// markup de los componentes.

// ─────────────────────────────────────────────────────────────────────────
// TODO(confirmar-telefono): números vigentes de líneas de emergencia.
// Esta es una herramienta para gente en una posible emergencia real — NO se
// inventan cifras. Cada `telefono` queda como placeholder literal hasta que
// el usuario confirme los números reales de cada ciudad (ver spec
// docs/specs/2026-08-13-seiricon-alerta-fase1.md, sección D y addendum F.0).
// ─────────────────────────────────────────────────────────────────────────
export interface LineaEmergencia {
  ciudad: string;
  telefono: string;
}

export const LINEA_EMERGENCIA_NACIONAL: LineaEmergencia = {
  ciudad: "Línea nacional de emergencias",
  telefono: "TODO(confirmar-telefono)",
};

export const LINEAS_EMERGENCIA_CIUDADES: LineaEmergencia[] = [
  { ciudad: "Cali", telefono: "TODO(confirmar-telefono)" },
  { ciudad: "Pereira", telefono: "TODO(confirmar-telefono)" },
  { ciudad: "Manizales", telefono: "TODO(confirmar-telefono)" },
];

// ─────────────────────────────────────────────────────────────────────────
// Fase 2 — triage de grietas (/alerta/grietas). Aditivo: nada de arriba cambia.
// Ver docs/specs/2026-08-13-seiricon-alerta-fase2.md.
// ─────────────────────────────────────────────────────────────────────────

/** Moneda de referencia para la Foto A (acercamiento) — GuiaFoto.tsx / prompt de observar-grieta.ts. */
export const MONEDA_REFERENCIA = { nombre: "$500 COP", diametro_mm: 23.7 };

/** Verificado contra Footer.tsx, contacto/page.tsx y privacidad/page.tsx — mismo correo en todo el sitio. */
export const CONTACTO_EMAIL = "info@seiricon.com";

// TODO(confirmar-whatsapp): número de WhatsApp de Seiricon para el puente con
// ingenieros (PuenteIngenieros.tsx). El botón de WhatsApp se queda oculto
// mientras este valor siga siendo el placeholder — mismo patrón que
// TALLY_EMBED_URL/TALLY_PLACEHOLDER en src/components/beta/config.ts.
export const CONTACTO_WHATSAPP_PLACEHOLDER = "TODO(confirmar-whatsapp)";
export const CONTACTO_WHATSAPP = CONTACTO_WHATSAPP_PLACEHOLDER;

export interface CanalOficial {
  ciudad: string;
  descripcion: string;
  url: string;
}

// TODO(confirmar-enlace): URLs reales de los canales oficiales de gestión del
// riesgo / curadurías por ciudad. No se inventan enlaces en un flujo de
// emergencia real — mismo criterio que LINEAS_EMERGENCIA_CIUDADES de arriba.
// PuenteIngenieros.tsx solo muestra los canales cuya url ya no sea el placeholder.
export const CANAL_OFICIAL_PLACEHOLDER = "TODO(confirmar-enlace)";
export const CANALES_OFICIALES: CanalOficial[] = [
  { ciudad: "Cali", descripcion: "Oficina de Gestión del Riesgo", url: CANAL_OFICIAL_PLACEHOLDER },
  { ciudad: "Pereira", descripcion: "Oficina de Gestión del Riesgo", url: CANAL_OFICIAL_PLACEHOLDER },
  { ciudad: "Manizales", descripcion: "Oficina de Gestión del Riesgo", url: CANAL_OFICIAL_PLACEHOLDER },
];

// `LABEL_ELEMENTO` (nombres en lenguaje llano de cada `Elemento`) vive en
// src/lib/alerta/copys.ts, no aquí: lo consume src/lib/pdf/InformeGrietasReport.tsx
// (capa `lib`) además de los componentes de esta carpeta, y `lib` no debe
// depender de `components`.
