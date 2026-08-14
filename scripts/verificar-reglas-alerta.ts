/**
 * Verifica el motor de reglas de Seiricon Alerta (`src/lib/alerta/`) contra la
 * tabla A.2 del spec, regla por regla, más los casos borde marcados por el
 * revisor (confianza baja, `no_determinado`, ancho exactamente igual al
 * umbral). No hay test runner configurado en el proyecto — este script es la
 * suite de verificación, en asserts planos.
 *
 * Uso: `npm run verify:alerta`. Sale con código 1 si algo falla.
 */
import { evaluarFiltroSeguridad, type FiltroSeguridadRespuestas } from "@/lib/alerta/filtro-seguridad";
import { evaluarGrieta, evaluarInmueble, CONFIANZA_MINIMA } from "@/lib/alerta/reglas";
import { COPY_NIVEL, QUE_NO_HACER_SI_NO_VERDE } from "@/lib/alerta/copys";
import type { Banderas, Elemento, Nivel, ObservacionGrieta, Patron, Veredicto } from "@/lib/alerta/tipos";

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

function verificarLanza(descripcion: string, fn: () => void) {
  total++;
  try {
    fn();
    fallos++;
    console.error(`  FAIL ${descripcion} (no lanzó error)`);
  } catch {
    console.log(`  OK   ${descripcion}`);
  }
}

const BANDERAS_SIN_ALARMA: Banderas = {
  acero_expuesto: false,
  concreto_triturado: false,
  desplazamiento_caras: false,
  elemento_inclinado: false,
  separacion_muro_estructura: false,
};

const CONFIANZA_ALTA = { elemento: 0.95, patron: 0.95, ancho: 0.95 };

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

function assertNivel(descripcion: string, veredicto: Veredicto, esperado: Nivel) {
  verificar(`${descripcion} → esperado ${esperado}, obtuvo ${veredicto.nivel}`, veredicto.nivel === esperado);
}

console.log("Seiricon Alerta — verificación del motor de reglas\n");

console.log("Regla 1 — elemento estructural + bandera crítica → Rojo");
assertNivel(
  "columna con acero expuesto",
  evaluarGrieta(obs({ elemento: "columna", patron: "vertical", banderas: { acero_expuesto: true } })),
  "rojo"
);
assertNivel(
  "viga con concreto triturado",
  evaluarGrieta(obs({ elemento: "viga", patron: "horizontal", banderas: { concreto_triturado: true } })),
  "rojo"
);
assertNivel(
  "nudo viga-columna con desplazamiento de caras",
  evaluarGrieta(
    obs({ elemento: "nudo_viga_columna", patron: "craquelado", banderas: { desplazamiento_caras: true } })
  ),
  "rojo"
);

console.log("\nRegla 2 — elemento estructural + patrón diagonal, cualquier ancho → Rojo");
assertNivel(
  "columna con patrón diagonal_x",
  evaluarGrieta(obs({ elemento: "columna", patron: "diagonal_x" })),
  "rojo"
);
assertNivel(
  "viga con patrón diagonal y ancho mínimo",
  evaluarGrieta(obs({ elemento: "viga", patron: "diagonal", ancho_mm: 0.2 })),
  "rojo"
);

console.log("\nRegla 3 — elemento inclinado o separación muro/estructura, cualquier elemento → Rojo");
assertNivel(
  "muro divisorio inclinado",
  evaluarGrieta(obs({ elemento: "muro_divisorio", patron: "craquelado", banderas: { elemento_inclinado: true } })),
  "rojo"
);
assertNivel(
  "piso con separación muro/estructura",
  evaluarGrieta(obs({ elemento: "piso", patron: "horizontal", banderas: { separacion_muro_estructura: true } })),
  "rojo"
);

console.log("\nRegla 4 — muro de carga ancho >3mm, o escalonada con indicio de pasante → Rojo");
assertNivel(
  "muro de carga con ancho 5mm",
  evaluarGrieta(obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: 5 })),
  "rojo"
);
assertNivel(
  "muro de carga escalonada con desplazamiento de caras (indicio de pasante)",
  evaluarGrieta(obs({ elemento: "muro_carga", patron: "escalonada", banderas: { desplazamiento_caras: true } })),
  "rojo"
);
console.log("  Caso borde: ancho exactamente en el umbral (3mm, no > 3) → NO debe ser rojo");
assertNivel(
  "muro de carga con ancho exactamente 3mm",
  evaluarGrieta(obs({ elemento: "muro_carga", patron: "vertical", ancho_mm: 3 })),
  "amarillo"
);
assertNivel(
  "muro de carga escalonada SIN desplazamiento de caras (sin indicio de pasante)",
  evaluarGrieta(obs({ elemento: "muro_carga", patron: "escalonada" })),
  "amarillo"
);

console.log("\nRegla 5 — elemento estructural sin caer en rojo arriba → Amarillo");
assertNivel(
  "columna con patrón vertical, sin banderas",
  evaluarGrieta(obs({ elemento: "columna", patron: "vertical" })),
  "amarillo"
);
assertNivel(
  "muro de carga con ancho pequeño (1mm), patrón craquelado",
  evaluarGrieta(obs({ elemento: "muro_carga", patron: "craquelado", ancho_mm: 1 })),
  "amarillo"
);

console.log("\nRegla 6 — muro divisorio con ancho medible, escalonada, o riesgo de desprendimiento → Amarillo");
assertNivel(
  "muro divisorio con ancho medible (2mm)",
  evaluarGrieta(obs({ elemento: "muro_divisorio", patron: "vertical", ancho_mm: 2 })),
  "amarillo"
);
assertNivel(
  "muro divisorio escalonada sin ancho medido",
  evaluarGrieta(obs({ elemento: "muro_divisorio", patron: "escalonada" })),
  "amarillo"
);
assertNivel(
  "muro divisorio craquelado con desplazamiento de caras (riesgo de desprendimiento, gana antes que la regla 8)",
  evaluarGrieta(obs({ elemento: "muro_divisorio", patron: "craquelado", banderas: { desplazamiento_caras: true } })),
  "amarillo"
);

console.log("\nRegla 7 — no_determinado / mala calidad de foto / confianza baja → Amarillo");
assertNivel(
  "elemento no_determinado",
  evaluarGrieta(obs({ elemento: "no_determinado", patron: "craquelado" })),
  "amarillo"
);
assertNivel(
  "foto oscura en un piso (no cubierto por reglas 1-6)",
  evaluarGrieta(obs({ elemento: "piso", patron: "horizontal", calidad_foto: "oscura" })),
  "amarillo"
);
assertNivel(
  "confianza.elemento por debajo del umbral en una fachada",
  evaluarGrieta(obs({ elemento: "fachada", patron: "craquelado", confianza: { elemento: 0.3 } })),
  "amarillo"
);
assertNivel(
  "confianza.ancho por debajo del umbral CON ancho_mm reportado",
  evaluarGrieta(obs({ elemento: "fachada", patron: "vertical", ancho_mm: 2, confianza: { ancho: 0.2 } })),
  "amarillo"
);
assertNivel(
  "confianza.ancho baja pero ancho_mm es null → no debe activar la regla 7 por esta vía (cae a la 9)",
  evaluarGrieta(obs({ elemento: "fachada", patron: "vertical", ancho_mm: null, confianza: { ancho: 0.1 } })),
  "amarillo" // no hay camino a verde para "fachada": cae en la 9, mismo nivel, pero por otra razón
);

console.log("\nUmbral de confianza (A.3) — CONFIANZA_MINIMA = 0.6, comparación estricta '<'");
verificar("CONFIANZA_MINIMA es 0.6", CONFIANZA_MINIMA === 0.6);
assertNivel(
  "muro divisorio craquelado sin banderas, confianza EXACTAMENTE en el umbral (0.6) → sigue pudiendo ser verde",
  evaluarGrieta(
    obs({
      elemento: "muro_divisorio",
      patron: "craquelado",
      confianza: { elemento: 0.6, patron: 0.6, ancho: 0.6 },
    })
  ),
  "verde"
);
assertNivel(
  "muro divisorio craquelado sin banderas, confianza apenas POR DEBAJO del umbral (0.59) → amarillo",
  evaluarGrieta(
    obs({
      elemento: "muro_divisorio",
      patron: "craquelado",
      confianza: { elemento: 0.59, patron: 0.95, ancho: 0.95 },
    })
  ),
  "amarillo"
);

console.log("\nRegla 8 — único camino a Verde: muro divisorio + craquelado + sin banderas");
assertNivel(
  "muro divisorio craquelado, sin banderas, confianza alta, foto ok",
  evaluarGrieta(obs({ elemento: "muro_divisorio", patron: "craquelado" })),
  "verde"
);
console.log("  Caso borde: craquelado en muro divisorio pero CON una bandera activa → no debe ser verde");
assertNivel(
  "muro divisorio craquelado con acero_expuesto=true (bandera atípica pero presente)",
  evaluarGrieta(obs({ elemento: "muro_divisorio", patron: "craquelado", banderas: { acero_expuesto: true } })),
  "amarillo"
);

console.log("\nRegla 9 — cualquier otro caso no cubierto → Amarillo por defecto (nunca verde por omisión)");
assertNivel(
  "piso con patrón junta_entre_elementos, sin banderas, confianza alta, foto ok",
  evaluarGrieta(obs({ elemento: "piso", patron: "junta_entre_elementos" })),
  "amarillo"
);
assertNivel(
  "losa_techo con patrón esquina_vano, sin banderas",
  evaluarGrieta(obs({ elemento: "losa_techo", patron: "esquina_vano" })),
  "amarillo"
);

console.log("\nCopys por nivel (A.4) — exactos, sin la palabra 'seguro' describiendo un resultado");
const rojoVer = evaluarGrieta(obs({ elemento: "columna", patron: "diagonal" }));
const amarilloVer = evaluarGrieta(obs({ elemento: "columna", patron: "vertical" }));
const verdeVer = evaluarGrieta(obs({ elemento: "muro_divisorio", patron: "craquelado" }));
verificar("que_hacer de rojo === COPY_NIVEL.rojo", rojoVer.que_hacer === COPY_NIVEL.rojo);
verificar("que_hacer de amarillo === COPY_NIVEL.amarillo", amarilloVer.que_hacer === COPY_NIVEL.amarillo);
verificar("que_hacer de verde === COPY_NIVEL.verde", verdeVer.que_hacer === COPY_NIVEL.verde);
verificar(
  "que_no_hacer de rojo/amarillo es la lista fija",
  JSON.stringify(rojoVer.que_no_hacer) === JSON.stringify(QUE_NO_HACER_SI_NO_VERDE) &&
    JSON.stringify(amarilloVer.que_no_hacer) === JSON.stringify(QUE_NO_HACER_SI_NO_VERDE)
);
verificar("que_no_hacer de verde está vacío", verdeVer.que_no_hacer.length === 0);
verificar(
  "ningún copy de nivel contiene la palabra 'seguro'",
  Object.values(COPY_NIVEL).every((c) => !/\bseguro\b/i.test(c))
);

console.log("\nevaluarInmueble — el nivel del inmueble es el PEOR, nunca un promedio");
assertNivel("mezcla [rojo, amarillo, verde] → rojo", evaluarInmueble([rojoVer, amarilloVer, verdeVer]), "rojo");
assertNivel("mezcla [amarillo, verde] → amarillo", evaluarInmueble([amarilloVer, verdeVer]), "amarillo");
assertNivel("solo [verde, verde] → verde", evaluarInmueble([verdeVer, verdeVer]), "verde");
verificarLanza("evaluarInmueble([]) lanza error (no hay grietas evaluadas)", () => evaluarInmueble([]));

console.log("\nFiltro de seguridad (A.5) — cualquier 'sí' corta el flujo");
const SIN_ALARMAS: FiltroSeguridadRespuestas = {
  edificioInclinado: false,
  columnaReventadaOVarillaExpuesta: false,
  pisosDesnivelados: false,
  olorAGas: false,
};
verificar("las 4 en 'no' → false (no corta)", evaluarFiltroSeguridad(SIN_ALARMAS) === false);
verificar(
  "edificioInclinado=true → true (corta)",
  evaluarFiltroSeguridad({ ...SIN_ALARMAS, edificioInclinado: true }) === true
);
verificar(
  "columnaReventadaOVarillaExpuesta=true → true (corta)",
  evaluarFiltroSeguridad({ ...SIN_ALARMAS, columnaReventadaOVarillaExpuesta: true }) === true
);
verificar(
  "pisosDesnivelados=true → true (corta)",
  evaluarFiltroSeguridad({ ...SIN_ALARMAS, pisosDesnivelados: true }) === true
);
verificar("olorAGas=true → true (corta)", evaluarFiltroSeguridad({ ...SIN_ALARMAS, olorAGas: true }) === true);

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Motor de reglas de Seiricon Alerta verificado sin errores.");
