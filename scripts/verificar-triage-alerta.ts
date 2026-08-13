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
import {
  construirObservacionEfectiva,
  evaluarTriageGrieta,
  reconciliarElemento,
  type EntradaTriage,
  type FuenteObservacion,
  type RespuestaPasante,
} from "@/lib/alerta/triage";
import {
  normalizarObservacion,
  sanitizarNotaVisual,
} from "@/lib/alerta/observar-grieta";
import type { Banderas, Elemento, Nivel, ObservacionGrieta, Patron } from "@/lib/alerta/tipos";

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

// ─── Resumen ────────────────────────────────────────────────────────────────
console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Capa de reconciliación (triage) de Seiricon Alerta verificada sin errores.");
