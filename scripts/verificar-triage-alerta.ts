/**
 * Verifica la capa de reconciliación (triage) de Seiricon Alerta Fase 2
 * (`src/lib/alerta/triage.ts` y `src/lib/alerta/observar-grieta.ts`) contra
 * la sección 6 del spec, deliberadamente SEPARADO del script de Fase 1
 * (`scripts/verificar-reglas-alerta.ts`, que sigue intacto y en 43/43).
 *
 * No hay test runner configurado en el proyecto — este script es la suite
 * de verificación, en asserts planos, igual que el de Fase 1.
 *
 * Uso: `npm run verify:triage`. Sale con código 1 si algo falla.
 * Ver docs/specs/2026-08-13-seiricon-alerta-fase2.md, sección 6.
 */
import { evaluarGrieta } from "@/lib/alerta/reglas";
import { ADVERTENCIA_VERDE, COPY_DISCREPANCIA, COPY_SIN_IA, LABEL_ELEMENTO, TITULO_NIVEL, TONO_NIVEL } from "@/lib/alerta/copys";
import { COPY_DISCREPANCIA_PATRON, LABEL_PATRON, ORDEN_PATRON } from "@/lib/alerta/copys";
import {
  CONFIANZA_MINIMA_VERDE,
  construirObservacionEfectiva,
  evaluarTriageGrieta,
  reconciliarElemento,
  reconciliarPatron,
  type EntradaTriage,
  type FuenteObservacion,
  type RespuestaPasante,
} from "@/lib/alerta/triage";
import {
  fusionarLecturas,
  normalizarObservacion,
  sanitizarNotaVisual,
  sinConsenso,
} from "@/lib/alerta/observar-grieta";
import type { Banderas, CalidadFoto, Elemento, Nivel, ObservacionGrieta, Patron } from "@/lib/alerta/tipos";

let total = 0;
let fallos = 0;

function verificar(descripcion: string, condicion: boolean) {
  total++;
  if (condicion) {
    console.log(`  OK   ${descripcion}`);
  } else {
    fallos++;
    console.error(`  FAIL ${descripcion}`);
  }
}

console.log("Seiricon Alerta — verificación de la capa de reconciliación (triage, Fase 2)\n");

// ─── Fixtures compartidos (mismo estilo que scripts/verificar-reglas-alerta.ts) ──
const RANGO_NIVEL: Record<Nivel, number> = { verde: 0, amarillo: 1, rojo: 2 };

const BANDERAS_SIN_ALARMA: Banderas = {
  acero_expuesto: false,
  concreto_triturado: false,
  desplazamiento_caras: false,
  elemento_inclinado: false,
  separacion_muro_estructura: false,
};

const CONFIANZA_ALTA = { elemento: 0.95, patron: 0.95, ancho: 0.95 };

const ELEMENTOS: Elemento[] = [
  "columna",
  "viga",
  "nudo_viga_columna",
  "muro_carga",
  "muro_divisorio",
  "losa_techo",
  "piso",
  "fachada",
  "no_determinado",
];

const PATRONES: Patron[] = [
  "diagonal",
  "diagonal_x",
  "vertical",
  "horizontal",
  "escalonada",
  "craquelado",
  "esquina_vano",
  "junta_entre_elementos",
];

const FUENTES: FuenteObservacion[] = ["ia", "manual"];
const PASANTES: RespuestaPasante[] = ["si", "no", "no_se"];

function obs(params: {
  elemento: Elemento;
  patron: Patron;
  ancho_mm?: number | null;
  banderas?: Partial<Banderas>;
  confianza?: Partial<{ elemento: number; patron: number; ancho: number }>;
  calidad_foto?: ObservacionGrieta["calidad_foto"];
}): ObservacionGrieta {
  return {
    elemento: params.elemento,
    patron: params.patron,
    ancho_mm: params.ancho_mm ?? null,
    banderas: { ...BANDERAS_SIN_ALARMA, ...params.banderas },
    confianza: { ...CONFIANZA_ALTA, ...params.confianza },
    calidad_foto: params.calidad_foto ?? "ok",
  };
}

function entrada(params: {
  declarado: Elemento;
  observacion: ObservacionGrieta;
  fuente?: FuenteObservacion;
  pasante?: RespuestaPasante;
}): EntradaTriage {
  return {
    declarado: params.declarado,
    observacion: params.observacion,
    fuente: params.fuente ?? "ia",
    pasante: params.pasante ?? "no_se",
  };
}

function nivelTriage(e: EntradaTriage): Nivel {
  return evaluarTriageGrieta(e).veredicto.nivel;
}

// ─── 1a) reconciliarElemento / construirObservacionEfectiva (T1/T2 en aislado) ──
console.log("1a) reconciliarElemento / construirObservacionEfectiva — comportamiento de T1/T2 tal como están descritos");

verificar(
  "sin discrepancia → gana lo declarado, hubo_discrepancia=false",
  reconciliarElemento("muro_divisorio", "muro_divisorio").elemento === "muro_divisorio" &&
    reconciliarElemento("muro_divisorio", "muro_divisorio").hubo_discrepancia === false
);
verificar(
  "empate de severidad (viga vs columna, ambos rango 4) → gana lo declarado",
  reconciliarElemento("viga", "columna").elemento === "viga" && reconciliarElemento("viga", "columna").hubo_discrepancia === true
);
verificar("gana el de mayor severidad (columna > muro_divisorio)", reconciliarElemento("muro_divisorio", "columna").elemento === "columna");

const efectivaConDiscrepancia = construirObservacionEfectiva(obs({ elemento: "columna", patron: "diagonal" }), {
  elemento: "columna",
  hubo_discrepancia: true,
});
verificar("construirObservacionEfectiva zera confianza.elemento si hubo discrepancia", efectivaConDiscrepancia.confianza.elemento === 0);

const efectivaSinDiscrepancia = construirObservacionEfectiva(obs({ elemento: "columna", patron: "diagonal" }), {
  elemento: "columna",
  hubo_discrepancia: false,
});
verificar("construirObservacionEfectiva conserva confianza si NO hubo discrepancia", efectivaSinDiscrepancia.confianza.elemento === 0.95);

// ─── 1) Matriz completa de reconciliación ──────────────────────────────────
console.log("\n1) Matriz de reconciliación — RANGO(pipeline completo) >= max(RANGO(declarado), RANGO(observado))");

const CONTEXTOS_FIJOS: { nombre: string; patron: Patron; banderas?: Partial<Banderas>; ancho_mm?: number | null }[] = [
  { nombre: "craquelado, sin banderas ni ancho", patron: "craquelado" },
  { nombre: "vertical con ancho 5mm", patron: "vertical", ancho_mm: 5 },
  { nombre: "horizontal con acero expuesto", patron: "horizontal", banderas: { acero_expuesto: true } },
];

let casosMatriz = 0;
let fallosMatriz = 0;
for (const declarado of ELEMENTOS) {
  for (const observado of ELEMENTOS) {
    for (const ctx of CONTEXTOS_FIJOS) {
      casosMatriz++;
      const observacionDeclarado = obs({ elemento: declarado, patron: ctx.patron, ancho_mm: ctx.ancho_mm, banderas: ctx.banderas });
      const observacionObservado = obs({ elemento: observado, patron: ctx.patron, ancho_mm: ctx.ancho_mm, banderas: ctx.banderas });

      const nivelDeclarado = RANGO_NIVEL[evaluarGrieta(observacionDeclarado).nivel];
      const nivelObservado = RANGO_NIVEL[evaluarGrieta(observacionObservado).nivel];
      // Pipeline COMPLETO (T1 + T2 + red de seguridad de aplicarCandidatoDescartado, ver
      // triage.ts) — no solo T1/T2 crudos, que por sí solos NO garantizan este invariante
      // (ver HALLAZGO en la cabecera de triage.ts).
      const nivelReconciliado = RANGO_NIVEL[nivelTriage(entrada({ declarado, observacion: observacionObservado }))];

      if (nivelReconciliado < Math.max(nivelDeclarado, nivelObservado)) fallosMatriz++;
    }
  }
}
verificar(
  `matriz declarado×observado×contexto (${casosMatriz} combinaciones, 0 violaciones esperadas)`,
  fallosMatriz === 0
);

// ─── 2) Invariante de monotonía ────────────────────────────────────────────
console.log("\n2) Invariante de monotonía — evaluarTriageGrieta nunca da un nivel más suave que evaluarGrieta");

let casosMonotonia = 0;
let fallosMonotonia = 0;
for (const declarado of ELEMENTOS) {
  for (const observado of ELEMENTOS) {
    for (const patron of PATRONES) {
      for (const fuente of FUENTES) {
        for (const pasante of PASANTES) {
          casosMonotonia++;
          const observacion = obs({ elemento: observado, patron });
          const e = entrada({ declarado, observacion, fuente, pasante });
          const nivelBase = RANGO_NIVEL[evaluarGrieta(observacion).nivel];
          const nivelDeTriage = RANGO_NIVEL[nivelTriage(e)];
          if (nivelDeTriage < nivelBase) fallosMonotonia++;
        }
      }
    }
  }
}
verificar(`invariante de monotonía sostenida en ${casosMonotonia} combinaciones (0 violaciones)`, fallosMonotonia === 0);

// ─── 3) Verde solo por el camino único ─────────────────────────────────────
console.log("\n3) Verde solo por el camino único");

const CANONICO: EntradaTriage = entrada({
  declarado: "muro_divisorio",
  observacion: obs({ elemento: "muro_divisorio", patron: "craquelado" }),
  fuente: "ia",
  pasante: "no",
});
verificar("caso canónico (ia, sin discrepancia, muro_divisorio+craquelado, sin banderas, confianza alta) → verde", nivelTriage(CANONICO) === "verde");

verificar("fuente manual rompe el verde", nivelTriage({ ...CANONICO, fuente: "manual" }) !== "verde");
verificar("discrepancia (declarado distinto) rompe el verde", nivelTriage({ ...CANONICO, declarado: "piso" }) !== "verde");
verificar(
  "elemento observado distinto (sin discrepancia con lo declarado) rompe el verde",
  nivelTriage({ ...CANONICO, declarado: "piso", observacion: obs({ elemento: "piso", patron: "craquelado" }) }) !== "verde"
);
verificar(
  "patrón distinto de craquelado rompe el verde",
  nivelTriage({ ...CANONICO, observacion: obs({ elemento: "muro_divisorio", patron: "vertical" }) }) !== "verde"
);
verificar(
  "una bandera activa rompe el verde",
  nivelTriage({
    ...CANONICO,
    observacion: obs({ elemento: "muro_divisorio", patron: "craquelado", banderas: { acero_expuesto: true } }),
  }) !== "verde"
);
verificar(
  "calidad_foto distinta de ok rompe el verde",
  nivelTriage({ ...CANONICO, observacion: obs({ elemento: "muro_divisorio", patron: "craquelado", calidad_foto: "oscura" }) }) !== "verde"
);
verificar(
  "confianza por debajo del umbral rompe el verde",
  nivelTriage({
    ...CANONICO,
    observacion: obs({ elemento: "muro_divisorio", patron: "craquelado", confianza: { elemento: 0.3 } }),
  }) !== "verde"
);
verificar("pasante='si' rompe el verde", nivelTriage({ ...CANONICO, pasante: "si" }) !== "verde");

// ─── 4) Reglas de negativos absolutos + elevación a rojo por pasante ───────
console.log("\n4) fuente manual / no_determinado / pasante='si' nunca verde; muro_carga+escalonada+pasante='si' → rojo");

let fallosManualNuncaVerde = 0;
for (const elemento of ELEMENTOS) {
  for (const patron of PATRONES) {
    if (nivelTriage(entrada({ declarado: elemento, observacion: obs({ elemento, patron }), fuente: "manual" })) === "verde") {
      fallosManualNuncaVerde++;
    }
  }
}
verificar(`fuente manual nunca da verde (${ELEMENTOS.length * PATRONES.length} combinaciones)`, fallosManualNuncaVerde === 0);

let fallosNoDeterminadoNuncaVerde = 0;
for (const patron of PATRONES) {
  const e = entrada({ declarado: "no_determinado", observacion: obs({ elemento: "no_determinado", patron }), fuente: "ia" });
  if (nivelTriage(e) === "verde") fallosNoDeterminadoNuncaVerde++;
}
verificar(`no_determinado nunca da verde (${PATRONES.length} patrones)`, fallosNoDeterminadoNuncaVerde === 0);

let fallosPasanteSiNuncaVerde = 0;
for (const elemento of ELEMENTOS) {
  for (const patron of PATRONES) {
    const e = entrada({ declarado: elemento, observacion: obs({ elemento, patron }), fuente: "ia", pasante: "si" });
    if (nivelTriage(e) === "verde") fallosPasanteSiNuncaVerde++;
  }
}
verificar(`pasante='si' nunca da verde (${ELEMENTOS.length * PATRONES.length} combinaciones)`, fallosPasanteSiNuncaVerde === 0);

verificar(
  "muro_carga + escalonada + pasante='si' → rojo",
  nivelTriage(
    entrada({
      declarado: "muro_carga",
      observacion: obs({ elemento: "muro_carga", patron: "escalonada" }),
      fuente: "ia",
      pasante: "si",
    })
  ) === "rojo"
);

// ─── 5) Discrepancia declarada/observada ───────────────────────────────────
console.log("\n5) Discrepancia — declarado muro_divisorio + observado columna → gana columna");

const casoDiscrepancia = evaluarTriageGrieta(
  entrada({ declarado: "muro_divisorio", observacion: obs({ elemento: "columna", patron: "diagonal" }) })
);
verificar("gana el elemento observado (columna)", casoDiscrepancia.reconciliacion.elemento === "columna");
verificar("hubo_discrepancia === true", casoDiscrepancia.reconciliacion.hubo_discrepancia === true);
verificar("observacionEfectiva.confianza.elemento === 0", casoDiscrepancia.observacionEfectiva.confianza.elemento === 0);

// ─── 6) Copys nuevos ────────────────────────────────────────────────────────
console.log("\n6) Copys nuevos — sin la palabra 'segur' y ADVERTENCIA_VERDE no vacía");

const COPYS_NUEVOS: Record<string, unknown> = {
  TITULO_NIVEL,
  TONO_NIVEL,
  ADVERTENCIA_VERDE,
  COPY_DISCREPANCIA,
  COPY_SIN_IA,
  LABEL_ELEMENTO,
  // Refinamiento 2026-08-13 (R3):
  COPY_DISCREPANCIA_PATRON,
  LABEL_PATRON,
};

function todosLosStrings(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(todosLosStrings);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(todosLosStrings);
  return [];
}

const stringsCopysNuevos = Object.values(COPYS_NUEVOS).flatMap(todosLosStrings);
verificar("ninguna constante nueva de copys.ts matchea /\\bsegur/i", stringsCopysNuevos.every((s) => !/\bsegur/i.test(s)));
verificar(
  "ADVERTENCIA_VERDE existe y no está vacía",
  typeof ADVERTENCIA_VERDE === "string" && ADVERTENCIA_VERDE.trim().length > 0
);

// ─── 7) normalizarObservacion — monótona, nunca ablanda un rojo ───────────
console.log("\n7) normalizarObservacion — clamps, rechazo por enum desconocido, no nulifica ancho_mm");

const OBSERVACION_BASE = {
  elemento: "muro_carga",
  patron: "vertical",
  ancho_mm: 5,
  banderas: { ...BANDERAS_SIN_ALARMA },
  confianza: { elemento: 0.9, patron: 0.9, ancho: 0.9 },
  calidad_foto: "ok",
};

const confianzaFueraDeRango = normalizarObservacion({
  ...OBSERVACION_BASE,
  confianza: { elemento: 1.5, patron: -0.3, ancho: 0.5 },
});
verificar(
  "confianza fuera de [0,1] se clampa",
  confianzaFueraDeRango !== null &&
    confianzaFueraDeRango.confianza.elemento === 1 &&
    confianzaFueraDeRango.confianza.patron === 0 &&
    confianzaFueraDeRango.confianza.ancho === 0.5
);

const anchoNegativo = normalizarObservacion({ ...OBSERVACION_BASE, ancho_mm: -4 });
verificar("ancho_mm negativo → null", anchoNegativo !== null && anchoNegativo.ancho_mm === null);

const sinReferenciaEscala = normalizarObservacion({
  ...OBSERVACION_BASE,
  ancho_mm: 5,
  calidad_foto: "sin_referencia_escala",
  confianza: { elemento: 0.9, patron: 0.9, ancho: 0.9 },
});
verificar(
  "calidad_foto='sin_referencia_escala' → confianza.ancho=0 PERO conserva ancho_mm (no lo nulifica — no ablanda la regla 4 de muro_carga)",
  sinReferenciaEscala !== null && sinReferenciaEscala.confianza.ancho === 0 && sinReferenciaEscala.ancho_mm === 5
);
verificar(
  "esa observación con muro_carga + ancho>3mm sigue dando rojo aunque confianza.ancho sea 0 (regla 4 no depende de confianza.ancho)",
  sinReferenciaEscala !== null && evaluarGrieta(sinReferenciaEscala).nivel === "rojo"
);

const elementoDesconocido = normalizarObservacion({ ...OBSERVACION_BASE, elemento: "pared_magica" });
verificar("elemento con enum desconocido → observación completa rechazada (null)", elementoDesconocido === null);

const patronDesconocido = normalizarObservacion({ ...OBSERVACION_BASE, patron: "en_espiral" });
verificar("patrón con enum desconocido → observación completa rechazada (null)", patronDesconocido === null);

const calidadDesconocida = normalizarObservacion({ ...OBSERVACION_BASE, calidad_foto: "borrosa" });
verificar("calidad_foto con enum desconocido → observación completa rechazada (null)", calidadDesconocida === null);

verificar("raw no-objeto → null", normalizarObservacion(null) === null && normalizarObservacion("texto") === null);

// ─── 8) sanitizarNotaVisual ─────────────────────────────────────────────────
console.log("\n8) sanitizarNotaVisual — corta a 140 caracteres, descarta lenguaje de juicio");

const notaLarga = "x".repeat(200);
verificar("corta a 140 caracteres", sanitizarNotaVisual(notaLarga)?.length === 140);

const PALABRAS_PROHIBIDAS_DE_PRUEBA = [
  "Se ve segura la estructura",
  "Hay peligro inminente",
  "nivel rojo detectado",
  "parece amarillo",
  "todo verde por aquí",
  "deberían evacuar",
  "riesgo de colapso",
  "tranquilo, no es nada",
  "no pasa nada",
  "te recomiendo reforzarlo",
];
let fallosPalabrasProhibidas = 0;
for (const nota of PALABRAS_PROHIBIDAS_DE_PRUEBA) {
  if (sanitizarNotaVisual(nota) !== null) fallosPalabrasProhibidas++;
}
verificar(
  `descarta por completo notas con lenguaje de juicio (${PALABRAS_PROHIBIDAS_DE_PRUEBA.length} frases probadas)`,
  fallosPalabrasProhibidas === 0
);

verificar(
  "nota neutral y corta se conserva tal cual",
  sanitizarNotaVisual("grieta diagonal de unos 2mm en la esquina superior") ===
    "grieta diagonal de unos 2mm en la esquina superior"
);
verificar("nota vacía o no-string → null", sanitizarNotaVisual("") === null && sanitizarNotaVisual(undefined) === null);

// ══════════════════════════════════════════════════════════════════════════
// Refinamiento de confiabilidad del triage (2026-08-13) — R1 a R4.
// Ver docs/specs/2026-08-13-alerta-refinamiento-vision.md.
// ══════════════════════════════════════════════════════════════════════════

// ─── 9) R1 — fusionarLecturas (doble lectura / consenso) ───────────────────
console.log("\n9) R1 — fusionarLecturas: fusión conservadora de dos lecturas independientes");

const LECTURA_A = obs({ elemento: "muro_divisorio", patron: "craquelado" });

const fusionElementoDistinto = fusionarLecturas(LECTURA_A, obs({ elemento: "columna", patron: "craquelado" }));
verificar(
  "elemento distinto entre lecturas → se conserva el de la primera y confianza.elemento = 0",
  fusionElementoDistinto.elemento === "muro_divisorio" && fusionElementoDistinto.confianza.elemento === 0
);
verificar(
  "esa fusión NO puede resolver en verde (confianza.elemento 0 activa la regla 7)",
  evaluarGrieta(fusionElementoDistinto).nivel !== "verde"
);

const fusionPatronDistinto = fusionarLecturas(LECTURA_A, obs({ elemento: "muro_divisorio", patron: "diagonal" }));
verificar(
  "patrón distinto entre lecturas → se conserva el de la primera y confianza.patron = 0",
  fusionPatronDistinto.patron === "craquelado" && fusionPatronDistinto.confianza.patron === 0
);

const fusionCoincidente = fusionarLecturas(
  obs({ elemento: "muro_divisorio", patron: "craquelado", confianza: { elemento: 0.9, patron: 0.7 } }),
  obs({ elemento: "muro_divisorio", patron: "craquelado", confianza: { elemento: 0.8, patron: 0.95 } })
);
verificar(
  "lecturas coincidentes → confianza de elemento/patrón = la MENOR de las dos",
  fusionCoincidente.confianza.elemento === 0.8 && fusionCoincidente.confianza.patron === 0.7
);

const fusionBanderas = fusionarLecturas(
  obs({ elemento: "columna", patron: "vertical", banderas: { acero_expuesto: true } }),
  obs({ elemento: "columna", patron: "vertical", banderas: { desplazamiento_caras: true } })
);
verificar(
  "banderas → unión lógica (OR) campo por campo: lo que vio cualquiera de las dos, cuenta",
  fusionBanderas.banderas.acero_expuesto &&
    fusionBanderas.banderas.desplazamiento_caras &&
    !fusionBanderas.banderas.concreto_triturado
);
verificar("esa fusión con acero expuesto en columna → rojo (regla 1)", evaluarGrieta(fusionBanderas).nivel === "rojo");

const fusionAncho = fusionarLecturas(
  obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: 2 }),
  obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: 5 })
);
verificar("ancho_mm → gana el MÁXIMO de ambas lecturas", fusionAncho.ancho_mm === 5);
verificar("ese máximo mantiene vivo el rojo de la regla 4 (muro de carga, ancho > 3mm)", evaluarGrieta(fusionAncho).nivel === "rojo");

const fusionAnchoNull = fusionarLecturas(
  obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: null }),
  obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: 4 })
);
verificar("ancho_mm con una lectura en null → gana la no-null", fusionAnchoNull.ancho_mm === 4);

const fusionCalidad = fusionarLecturas(
  obs({ elemento: "muro_divisorio", patron: "craquelado", calidad_foto: "ok" }),
  obs({ elemento: "muro_divisorio", patron: "craquelado", calidad_foto: "movida" })
);
verificar("calidad_foto → gana la PEOR de las dos ('ok' es la mejor)", fusionCalidad.calidad_foto === "movida");

const CALIDADES_MALAS: CalidadFoto[] = ["oscura", "movida", "muy_lejos", "sin_referencia_escala"];
let fallosCalidadPeor = 0;
for (const mala of CALIDADES_MALAS) {
  const a = fusionarLecturas(
    obs({ elemento: "muro_divisorio", patron: "craquelado", calidad_foto: "ok" }),
    obs({ elemento: "muro_divisorio", patron: "craquelado", calidad_foto: mala })
  );
  const b = fusionarLecturas(
    obs({ elemento: "muro_divisorio", patron: "craquelado", calidad_foto: mala }),
    obs({ elemento: "muro_divisorio", patron: "craquelado", calidad_foto: "ok" })
  );
  if (a.calidad_foto !== mala || b.calidad_foto !== mala) fallosCalidadPeor++;
}
verificar(`'ok' nunca gana contra una calidad mala, en cualquier orden (${CALIDADES_MALAS.length} calidades × 2)`, fallosCalidadPeor === 0);

const fusionConfianzaAncho = fusionarLecturas(
  obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: 2, confianza: { ancho: 0.9 } }),
  obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: 2, confianza: { ancho: 0.2 } })
);
verificar("confianza.ancho → gana la MÍNIMA de ambas", fusionConfianzaAncho.confianza.ancho === 0.2);

const fusionRango = fusionarLecturas(
  { ...obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: 3 }), ancho_rango: { min: 1, max: 3 } },
  { ...obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: 6 }), ancho_rango: { min: 4, max: 6 } }
);
verificar(
  "ancho_rango → unión de los dos rangos (min de los mínimos, max de los máximos), y ancho_mm = ese máximo",
  fusionRango.ancho_rango?.min === 1 && fusionRango.ancho_rango?.max === 6 && fusionRango.ancho_mm === 6
);

const unaSolaLectura = sinConsenso(obs({ elemento: "muro_divisorio", patron: "craquelado" }));
verificar(
  "sinConsenso (solo respondió una de las dos llamadas) → TODAS las confianzas a 0",
  unaSolaLectura.confianza.elemento === 0 && unaSolaLectura.confianza.patron === 0 && unaSolaLectura.confianza.ancho === 0
);
verificar("una sola lectura nunca resuelve en verde", evaluarGrieta(unaSolaLectura).nivel !== "verde");

// La fusión nunca puede ablandar: barrido de pares de lecturas.
let casosFusion = 0;
let fallosFusion = 0;
for (const elementoA of ELEMENTOS) {
  for (const elementoB of ELEMENTOS) {
    for (const patron of PATRONES) {
      casosFusion++;
      const a = obs({ elemento: elementoA, patron });
      const b = obs({ elemento: elementoB, patron });
      const fusionada = fusionarLecturas(a, b);
      const nivelFusion = RANGO_NIVEL[evaluarGrieta(fusionada).nivel];
      if (nivelFusion < RANGO_NIVEL[evaluarGrieta(a).nivel]) fallosFusion++;
      // Si las dos lecturas discrepan en el elemento, la fusionada nunca puede dar verde.
      if (elementoA !== elementoB && evaluarGrieta(fusionada).nivel === "verde") fallosFusion++;
    }
  }
}
verificar(
  `la fusión nunca es más suave que la primera lectura, ni da verde con elementos discrepantes (${casosFusion} pares)`,
  fallosFusion === 0
);

// ─── 10) R2 — ancho como rango, extremo conservador ────────────────────────
console.log("\n10) R2 — normalizarObservacion con ancho_mm_min/ancho_mm_max: se usa el extremo conservador");

const BASE_RANGO = {
  elemento: "muro_carga",
  patron: "vertical",
  banderas: { ...BANDERAS_SIN_ALARMA },
  confianza: { elemento: 0.9, patron: 0.9, ancho: 0.9 },
  calidad_foto: "ok",
};

const rangoNormal = normalizarObservacion({ ...BASE_RANGO, ancho_mm_min: 2, ancho_mm_max: 4 });
verificar(
  "rango 2–4 mm → ancho_mm = 4 (el máximo, extremo conservador) y ancho_rango conserva los dos extremos",
  rangoNormal !== null && rangoNormal.ancho_mm === 4 && rangoNormal.ancho_rango?.min === 2 && rangoNormal.ancho_rango?.max === 4
);
verificar(
  "ese rango en muro de carga da rojo por la regla 4 (usar el mínimo lo habría ablandado a amarillo)",
  rangoNormal !== null && evaluarGrieta(rangoNormal).nivel === "rojo"
);

const rangoInvertido = normalizarObservacion({ ...BASE_RANGO, ancho_mm_min: 4, ancho_mm_max: 2 });
verificar(
  "min > max → se intercambian, NO se rechaza la observación",
  rangoInvertido !== null && rangoInvertido.ancho_mm === 4 && rangoInvertido.ancho_rango?.min === 2 && rangoInvertido.ancho_rango?.max === 4
);

const soloMin = normalizarObservacion({ ...BASE_RANGO, ancho_mm_min: 5, ancho_mm_max: null });
verificar("solo vino el mínimo → ese es el ancho_mm", soloMin !== null && soloMin.ancho_mm === 5);

const soloMax = normalizarObservacion({ ...BASE_RANGO, ancho_mm_min: null, ancho_mm_max: 5 });
verificar("solo vino el máximo → ese es el ancho_mm", soloMax !== null && soloMax.ancho_mm === 5);

const rangoNulo = normalizarObservacion({ ...BASE_RANGO, ancho_mm_min: null, ancho_mm_max: null });
verificar(
  "rango completamente null → ancho_mm null y sin ancho_rango (campo opcional, no se inventa)",
  rangoNulo !== null && rangoNulo.ancho_mm === null && rangoNulo.ancho_rango === undefined
);

const rangoNegativo = normalizarObservacion({ ...BASE_RANGO, ancho_mm_min: -2, ancho_mm_max: 6 });
verificar("extremo negativo → se descarta ese extremo, no la observación", rangoNegativo !== null && rangoNegativo.ancho_mm === 6);

const rangoSinEscala = normalizarObservacion({
  ...BASE_RANGO,
  ancho_mm_min: 3,
  ancho_mm_max: 5,
  calidad_foto: "sin_referencia_escala",
});
verificar(
  "sin_referencia_escala con rango → confianza.ancho = 0 pero ancho_mm se CONSERVA (sigue dando rojo en muro de carga)",
  rangoSinEscala !== null &&
    rangoSinEscala.confianza.ancho === 0 &&
    rangoSinEscala.ancho_mm === 5 &&
    evaluarGrieta(rangoSinEscala).nivel === "rojo"
);

const rangoPlanoCompat = normalizarObservacion({ ...BASE_RANGO, ancho_mm: 5 });
verificar(
  "compatibilidad: si el modelo responde con el `ancho_mm` plano del schema viejo, se lee igual",
  rangoPlanoCompat !== null && rangoPlanoCompat.ancho_mm === 5
);

// ─── 11) R3 — reconciliación del patrón ────────────────────────────────────
console.log("\n11) R3 — el patrón que confirma la persona se contrasta con el leído en la foto");

verificar(
  "reconciliarPatron sin patrón declarado → sin discrepancia, se muestra el observado",
  reconciliarPatron("craquelado").hubo_discrepancia === false && reconciliarPatron("craquelado").patron === "craquelado"
);
verificar(
  "reconciliarPatron con el mismo patrón → sin discrepancia",
  reconciliarPatron("craquelado", "craquelado").hubo_discrepancia === false
);
verificar(
  "reconciliarPatron con patrón distinto → discrepancia, pero el patrón MOSTRADO sigue siendo el observado",
  reconciliarPatron("craquelado", "diagonal").hubo_discrepancia === true &&
    reconciliarPatron("craquelado", "diagonal").patron === "craquelado"
);

const casoPatronDeclarado = evaluarTriageGrieta({
  declarado: "columna",
  observacion: obs({ elemento: "columna", patron: "diagonal" }),
  fuente: "ia",
  pasante: "no",
  patron_declarado: "craquelado",
});
verificar(
  "declarado craquelado + observado diagonal en columna → rojo (gana el peor de los dos patrones)",
  casoPatronDeclarado.veredicto.nivel === "rojo"
);
verificar("esa discrepancia de patrón zera confianza.patron", casoPatronDeclarado.observacionEfectiva.confianza.patron === 0);
verificar("y queda marcada en reconciliacion_patron", casoPatronDeclarado.reconciliacion_patron.hubo_discrepancia === true);

const casoPatronInverso = evaluarTriageGrieta({
  declarado: "columna",
  observacion: obs({ elemento: "columna", patron: "craquelado" }),
  fuente: "ia",
  pasante: "no",
  patron_declarado: "diagonal",
});
verificar(
  "observado craquelado + declarado diagonal en columna → rojo (el patrón descartado también se evalúa)",
  casoPatronInverso.veredicto.nivel === "rojo"
);

verificar(
  "sin patrón declarado, reconciliacion_patron queda sin discrepancia (comportamiento idéntico a Fase 2)",
  evaluarTriageGrieta(CANONICO).reconciliacion_patron.hubo_discrepancia === false
);
verificar(
  "discrepancia de patrón rompe el verde",
  nivelTriage({ ...CANONICO, patron_declarado: "diagonal" }) !== "verde"
);
verificar(
  "confirmar el mismo patrón que leyó la IA NO rompe el verde",
  nivelTriage({ ...CANONICO, patron_declarado: "craquelado" }) === "verde"
);

verificar(
  "construirObservacionEfectiva zera confianza.patron si hubo discrepancia de patrón",
  construirObservacionEfectiva(obs({ elemento: "muro_divisorio", patron: "craquelado" }), { elemento: "muro_divisorio", hubo_discrepancia: false }, { patron: "craquelado", hubo_discrepancia: true }).confianza.patron === 0
);

// ─── 12) R4 — umbral asimétrico del verde ──────────────────────────────────
console.log("\n12) R4 — CONFIANZA_MINIMA_VERDE: el verde exige más confianza que el resto");

verificar(`CONFIANZA_MINIMA_VERDE = ${CONFIANZA_MINIMA_VERDE}, más alta que CONFIANZA_MINIMA de reglas.ts`, CONFIANZA_MINIMA_VERDE === 0.85);

verificar(
  "verde con confianza.elemento 0.84 → amarillo",
  nivelTriage({
    ...CANONICO,
    observacion: obs({ elemento: "muro_divisorio", patron: "craquelado", confianza: { elemento: 0.84 } }),
  }) === "amarillo"
);
verificar(
  "verde con confianza.patron 0.84 → amarillo",
  nivelTriage({
    ...CANONICO,
    observacion: obs({ elemento: "muro_divisorio", patron: "craquelado", confianza: { patron: 0.84 } }),
  }) === "amarillo"
);
verificar(
  "confianza exactamente 0.85 en elemento y patrón → sigue verde (si todo lo demás lo permite)",
  nivelTriage({
    ...CANONICO,
    observacion: obs({ elemento: "muro_divisorio", patron: "craquelado", confianza: { elemento: 0.85, patron: 0.85 } }),
  }) === "verde"
);
verificar(
  "confianza.ancho baja NO tumba el verde por sí sola cuando no hay ancho medible (R4 solo mira elemento y patrón)",
  nivelTriage({
    ...CANONICO,
    observacion: obs({ elemento: "muro_divisorio", patron: "craquelado", confianza: { ancho: 0.1 } }),
  }) === "verde"
);
verificar(
  "R4 nunca ablanda: un rojo con confianza baja sigue rojo",
  nivelTriage({
    declarado: "columna",
    observacion: obs({ elemento: "columna", patron: "diagonal", confianza: { elemento: 0.1, patron: 0.1 } }),
    fuente: "ia",
    pasante: "no",
  }) === "rojo"
);

// ─── 13) Invariante de monotonía EXTENDIDO (elemento Y patrón) ─────────────
console.log("\n13) Invariante extendido — el nivel final nunca es más suave que leer la observación bajo CUALQUIER candidato");

const CONTEXTOS_INVARIANTE: { ancho_mm: number | null; banderas: Partial<Banderas> }[] = [
  { ancho_mm: null, banderas: {} },
  { ancho_mm: 5, banderas: { desplazamiento_caras: true } },
];

let casosInvarianteExtendido = 0;
let fallosInvarianteExtendido = 0;
for (const declarado of ELEMENTOS) {
  for (const observado of ELEMENTOS) {
    for (const patronObservado of PATRONES) {
      for (const patronDeclarado of PATRONES) {
        for (const ctx of CONTEXTOS_INVARIANTE) {
          casosInvarianteExtendido++;
          const observacion = obs({
            elemento: observado,
            patron: patronObservado,
            ancho_mm: ctx.ancho_mm,
            banderas: ctx.banderas,
          });
          const e: EntradaTriage = {
            declarado,
            observacion,
            fuente: "ia",
            pasante: "no",
            patron_declarado: patronDeclarado,
          };
          const nivelFinal = RANGO_NIVEL[nivelTriage(e)];
          // Todos los candidatos: elemento declarado × observado, patrón observado × declarado.
          for (const elementoCandidato of [declarado, observado]) {
            for (const patronCandidato of [patronObservado, patronDeclarado]) {
              const nivelCandidato =
                RANGO_NIVEL[evaluarGrieta({ ...observacion, elemento: elementoCandidato, patron: patronCandidato }).nivel];
              if (nivelFinal < nivelCandidato) fallosInvarianteExtendido++;
            }
          }
        }
      }
    }
  }
}
verificar(
  `nivel final >= nivel de cualquier candidato (elemento Y patrón) en ${casosInvarianteExtendido} combinaciones (0 violaciones)`,
  fallosInvarianteExtendido === 0
);

// ─── 14) El camino a verde sigue siendo uno solo, ahora con más candados ───
console.log("\n14) Verde: barrido completo de las condiciones que lo permiten");

const CONFIANZAS_BARRIDO = [0, 0.59, 0.6, 0.84, 0.85, 0.95];
const CALIDADES_BARRIDO: CalidadFoto[] = ["ok", "oscura", "movida", "muy_lejos", "sin_referencia_escala"];
const BANDERAS_BARRIDO: Partial<Banderas>[] = [
  {},
  { acero_expuesto: true },
  { concreto_triturado: true },
  { desplazamiento_caras: true },
  { elemento_inclinado: true },
  { separacion_muro_estructura: true },
];

let casosVerde = 0;
let fallosVerde = 0;
for (const declarado of ELEMENTOS) {
  for (const observado of ELEMENTOS) {
    for (const patronObservado of PATRONES) {
      for (const patronDeclarado of [undefined, ...PATRONES]) {
        for (const fuente of FUENTES) {
          for (const pasante of PASANTES) {
            casosVerde++;
            const observacion = obs({ elemento: observado, patron: patronObservado });
            const e: EntradaTriage = { declarado, observacion, fuente, pasante, patron_declarado: patronDeclarado };
            if (nivelTriage(e) !== "verde") continue;
            const legitimo =
              fuente === "ia" &&
              declarado === observado &&
              observado === "muro_divisorio" &&
              patronObservado === "craquelado" &&
              (patronDeclarado === undefined || patronDeclarado === "craquelado") &&
              pasante !== "si";
            if (!legitimo) fallosVerde++;
          }
        }
      }
    }
  }
}
verificar(
  `todo verde del barrido (${casosVerde} combinaciones) es fuente ia + sin discrepancia de elemento NI de patrón + muro_divisorio/craquelado + pasante distinto de 'si'`,
  fallosVerde === 0
);

let casosVerdeObs = 0;
let fallosVerdeObs = 0;
for (const confElemento of CONFIANZAS_BARRIDO) {
  for (const confPatron of CONFIANZAS_BARRIDO) {
    for (const calidad of CALIDADES_BARRIDO) {
      for (const banderas of BANDERAS_BARRIDO) {
        casosVerdeObs++;
        const e: EntradaTriage = {
          declarado: "muro_divisorio",
          observacion: obs({
            elemento: "muro_divisorio",
            patron: "craquelado",
            banderas,
            confianza: { elemento: confElemento, patron: confPatron },
            calidad_foto: calidad,
          }),
          fuente: "ia",
          pasante: "no",
          patron_declarado: "craquelado",
        };
        if (nivelTriage(e) !== "verde") continue;
        const legitimo =
          calidad === "ok" &&
          Object.keys(banderas).length === 0 &&
          confElemento >= CONFIANZA_MINIMA_VERDE &&
          confPatron >= CONFIANZA_MINIMA_VERDE;
        if (!legitimo) fallosVerdeObs++;
      }
    }
  }
}
verificar(
  `todo verde del barrido de observación (${casosVerdeObs} combinaciones) exige calidad ok, cero banderas y confianza >= ${CONFIANZA_MINIMA_VERDE}`,
  fallosVerdeObs === 0
);

verificar(
  "ORDEN_PATRON cubre exactamente los 8 patrones del contrato, sin repetidos",
  ORDEN_PATRON.length === PATRONES.length && PATRONES.every((p) => ORDEN_PATRON.includes(p)) && new Set(ORDEN_PATRON).size === PATRONES.length
);
verificar(
  "LABEL_PATRON tiene una etiqueta llana y no vacía por patrón",
  PATRONES.every((p) => typeof LABEL_PATRON[p] === "string" && LABEL_PATRON[p].trim().length > 0)
);

// ─── Resumen ────────────────────────────────────────────────────────────────
console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Capa de reconciliación (triage) de Seiricon Alerta verificada sin errores.");
