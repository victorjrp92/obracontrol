/**
 * Verifica la fusión de intenciones (leaf-2.1) en `src/lib/plantillas-personal.ts`:
 *
 *  1. `TIPOS_OBRA` quedó con exactamente dos entradas (REFORMA + OBRA_NUEVA;
 *     "MODIFICACION" se fusionó dentro de "REFORMA").
 *  2. `resolverTipoObra` traduce los tres valores históricos de
 *     `Proyecto.tipo_obra` (REFORMA, MODIFICACION, OBRA_NUEVA) a una clave que
 *     SIEMPRE existe en `TIPOS_OBRA` — ninguna obra existente queda huérfana.
 *  3. `expandirModificacionesGenerales` — la modificación general sin espacio
 *     declarado ("techo", "pisos", "pintura general") se expande a una tarea
 *     por cada espacio del piso.
 *  4. `sugerirTareas()` sigue devolviendo, para las dos intenciones vigentes y
 *     todos los espacios del catálogo, tareas que resuelven rendimiento
 *     (`buscarRendimiento`) y fase (`faseDeTarea`) — el trabajo de otro leaf
 *     sobre el matching de tareas no debe quedar roto por esta fusión.
 *
 * No hay test runner configurado en el proyecto — este script es la suite de
 * verificación, en asserts planos (mismo patrón que verificar-reglas-alerta.ts).
 *
 * Uso: `npx tsx scripts/verificar-intenciones.ts`. Sale con código 1 si algo falla.
 */
import {
  TIPOS_OBRA,
  resolverTipoObra,
  sugerirTareas,
  nombreFaseDesdeObra,
  ESPACIOS_PERSONAL,
  MODIFICACIONES_GENERALES,
  expandirModificacionesGenerales,
  type TipoObra,
} from "@/lib/plantillas-personal";
import { buscarRendimiento } from "@/lib/rendimientos";
import { faseDeTarea } from "@/lib/fases-obra";

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

// ─────────────────────────────────────────────────────────────────────────
console.log("Seiricon — verificación de intenciones (fusión REFORMA/MODIFICACION + modificaciones generales)\n");

console.log("G1 — TIPOS_OBRA tiene exactamente dos entradas");
verificar("TIPOS_OBRA.length === 2", TIPOS_OBRA.length === 2);
verificar(
  "TIPOS_OBRA no incluye la clave retirada MODIFICACION",
  !TIPOS_OBRA.some((t) => (t.key as string) === "MODIFICACION"),
);
verificar("TIPOS_OBRA incluye REFORMA", TIPOS_OBRA.some((t) => t.key === "REFORMA"));
verificar("TIPOS_OBRA incluye OBRA_NUEVA", TIPOS_OBRA.some((t) => t.key === "OBRA_NUEVA"));
verificar(
  "cada entrada de TIPOS_OBRA tiene título y descripción no vacíos",
  TIPOS_OBRA.every((t) => t.titulo.trim().length > 0 && t.desc.trim().length > 0),
);

console.log("\nG1 — resolverTipoObra: ninguna obra existente queda huérfana");
// Los TRES valores históricos que puede tener `Proyecto.tipo_obra` en la base
// (columna String? sin enum — ver prisma/schema.prisma) deben resolver una
// clave que EXISTE en el catálogo vigente.
const valoresHistoricos: (string | null | undefined)[] = ["REFORMA", "MODIFICACION", "OBRA_NUEVA"];
for (const valor of valoresHistoricos) {
  const resuelto = resolverTipoObra(valor);
  verificar(
    `resolverTipoObra(${JSON.stringify(valor)}) = "${resuelto}" → existe en TIPOS_OBRA`,
    TIPOS_OBRA.some((t) => t.key === resuelto),
  );
}
verificar('resolverTipoObra("MODIFICACION") mapea específicamente a "REFORMA"', resolverTipoObra("MODIFICACION") === "REFORMA");
verificar('resolverTipoObra("REFORMA") = "REFORMA" (sin cambios)', resolverTipoObra("REFORMA") === "REFORMA");
verificar('resolverTipoObra("OBRA_NUEVA") = "OBRA_NUEVA" (sin cambios)', resolverTipoObra("OBRA_NUEVA") === "OBRA_NUEVA");
verificar("resolverTipoObra(null) cae a REFORMA (mismo default que el código anterior)", resolverTipoObra(null) === "REFORMA");
verificar("resolverTipoObra(undefined) cae a REFORMA", resolverTipoObra(undefined) === "REFORMA");
verificar('resolverTipoObra("valor-desconocido") cae a REFORMA (nunca revienta)', resolverTipoObra("valor-desconocido") === "REFORMA");

console.log("\nnombreFaseDesdeObra sigue devolviendo una etiqueta no vacía para las dos intenciones");
verificar('nombreFaseDesdeObra("OBRA_NUEVA") === "Obra nueva"', nombreFaseDesdeObra("OBRA_NUEVA") === "Obra nueva");
verificar('nombreFaseDesdeObra("REFORMA") === "Reforma"', nombreFaseDesdeObra("REFORMA") === "Reforma");
verificar(
  "nombreFaseDesdeObra(resolverTipoObra(\"MODIFICACION\")) también resuelve (proyectos legado)",
  nombreFaseDesdeObra(resolverTipoObra("MODIFICACION")).length > 0,
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nG2 — modificación general sin espacio declarado se expande a todos los espacios del piso");

const ESPACIOS_PISO = ["Cocina", "Baño principal", "Sala"];

verificar("sin modificaciones seleccionadas → []", expandirModificacionesGenerales([], ESPACIOS_PISO).length === 0);
verificar("piso sin espacios → [] (no existe un 'espacio piso completo')", expandirModificacionesGenerales(["pintura"], []).length === 0);
verificar("clave desconocida se ignora (no revienta, no genera filas)", expandirModificacionesGenerales(["no-existe"], ESPACIOS_PISO).length === 0);

const unaModExpandida = expandirModificacionesGenerales(["pintura"], ESPACIOS_PISO);
verificar(
  "una modificación general → una tarea por cada espacio del piso (misma cantidad)",
  unaModExpandida.length === ESPACIOS_PISO.length,
);
verificar(
  "la modificación aplicó a TODOS los espacios del piso, sin excepción",
  ESPACIOS_PISO.every((esp) => unaModExpandida.some((r) => r.espacio === esp)),
);
const catalogoPintura = MODIFICACIONES_GENERALES.find((m) => m.key === "pintura")!;
verificar(
  "la tarea expandida usa el nombre/duración del catálogo (no un valor inventado)",
  unaModExpandida.every(
    (r) => r.tarea.nombre === catalogoPintura.tarea.nombre && r.tarea.tiempo_acordado_dias === catalogoPintura.tarea.tiempo_acordado_dias,
  ),
);

const dosModExpandidas = expandirModificacionesGenerales(["pintura", "techo"], ESPACIOS_PISO);
verificar(
  "dos modificaciones generales → (espacios × modificaciones) tareas",
  dosModExpandidas.length === ESPACIOS_PISO.length * 2,
);
verificar(
  "cada espacio del piso recibió las DOS modificaciones (no solo una)",
  ESPACIOS_PISO.every(
    (esp) =>
      dosModExpandidas.some((r) => r.espacio === esp && r.tarea.nombre === catalogoPintura.tarea.nombre) &&
      dosModExpandidas.some((r) => r.espacio === esp && r.tarea.nombre === MODIFICACIONES_GENERALES.find((m) => m.key === "techo")!.tarea.nombre),
  ),
);

console.log("\nMODIFICACIONES_GENERALES tiene al menos techo, pisos y pintura, con tarea y duración válidas");
verificar("hay al menos 3 modificaciones generales en el catálogo", MODIFICACIONES_GENERALES.length >= 3);
for (const clave of ["techo", "pisos", "pintura"]) {
  verificar(`el catálogo incluye "${clave}"`, MODIFICACIONES_GENERALES.some((m) => m.key === clave));
}
verificar(
  "todas las modificaciones generales tienen tarea con nombre y días > 0",
  MODIFICACIONES_GENERALES.every((m) => m.tarea.nombre.trim().length > 0 && m.tarea.tiempo_acordado_dias > 0),
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nG4 (no romper otro leaf) — sugerirTareas() sigue devolviendo tareas con rendimiento y fase, para las dos intenciones");

const TIPOS: TipoObra[] = ["REFORMA", "OBRA_NUEVA"];
let combosRevisados = 0;
for (const tipoObra of TIPOS) {
  for (const espacio of ESPACIOS_PERSONAL) {
    const tareas = sugerirTareas(espacio.label, tipoObra);
    verificar(`sugerirTareas("${espacio.label}", "${tipoObra}") no queda vacío`, tareas.length > 0);
    for (const t of tareas) {
      combosRevisados++;
      verificar(
        `[${tipoObra}/${espacio.label}] "${t.nombre}" resuelve rendimiento`,
        buscarRendimiento(t.nombre) !== null,
      );
      verificar(`[${tipoObra}/${espacio.label}] "${t.nombre}" resuelve fase`, faseDeTarea(t.nombre) !== null);
    }
  }
}
verificar("se revisó al menos una tarea por cada combinación espacio × intención", combosRevisados > 0);

console.log("\nMODIFICACIONES_GENERALES: cada tarea curada también resuelve rendimiento y fase");
for (const m of MODIFICACIONES_GENERALES) {
  verificar(`"${m.tarea.nombre}" (${m.key}) resuelve rendimiento`, buscarRendimiento(m.tarea.nombre) !== null);
  verificar(`"${m.tarea.nombre}" (${m.key}) resuelve fase`, faseDeTarea(m.tarea.nombre) !== null);
}

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log("Intenciones (TIPOS_OBRA + modificaciones generales) verificadas sin errores.");
