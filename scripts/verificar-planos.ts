/**
 * Verifica la CAPA DE PRESENTACIÓN de planos y renders
 * (`src/components/productos-tecnicos/logica/`): qué versión se marca como
 * vigente en la vista, qué se pinta apagado, que el cupo se calcule bien
 * para pintarlo, y que la ubicación y el "quién y cuándo" de cada versión
 * lleguen enteros hasta la pantalla.
 *
 * Lo que YA verifica `scripts/verificar-productos-tecnicos.ts` no se repite
 * aquí: una sola versión vigente por plano, que subir una versión nueva no
 * borre la anterior, y el rechazo de formatos no permitidos son garantías
 * del DOMINIO (`src/lib/productos-tecnicos/versionado.ts` y `formatos.ts`) y
 * se prueban allá, sin conocer que existe una pantalla. Este script prueba
 * la orquestación que hace la VISTA sobre ese dominio — que no le añade
 * reglas nuevas, pero sí le puede añadir errores nuevos si se agrupa mal, se
 * ordena mal, o se pierde un dato en el camino de la base a la pantalla.
 *
 * SIN BASE DE DATOS, sin React, sin DOM — lógica pura, con el mismo estilo
 * que `scripts/verificar-reglas-alerta.ts`.
 *
 * Uso: `npx tsx scripts/verificar-planos.ts`. Sale con código 1 si algo falla.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { TipoProductoTecnico } from "@/generated/prisma";
import { CUPO_BYTES_POR_OBRA, formatearBytes } from "@/lib/productos-tecnicos";
import type { ProductoApi } from "@/components/productos-tecnicos/logica/api-productos-tecnicos";
import { aProductoParaVista } from "@/components/productos-tecnicos/logica/mapear-producto";
import { etiquetaDeUbicacion, type EdificioOpcion } from "@/components/productos-tecnicos/logica/ubicaciones";
import {
  cabeEnCupo,
  cupoParaPintar,
  nivelDeCupo,
  UMBRAL_AVISO,
  UMBRAL_CRITICO,
} from "@/components/productos-tecnicos/logica/vista-cupo";
import {
  acceptDeTipo,
  etiquetaFormatos,
  extensionesAceptadas,
} from "@/components/productos-tecnicos/logica/vista-formatos";
import {
  agruparPlanos,
  ordenarParaVista,
  renderesVigentes,
  type ProductoParaVista,
} from "@/components/productos-tecnicos/logica/vista-planos";

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

function verificarIgual(descripcion: string, obtenido: unknown, esperado: unknown) {
  const iguales = JSON.stringify(obtenido) === JSON.stringify(esperado);
  verificar(
    iguales ? descripcion : `${descripcion} → esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(obtenido)}`,
    iguales,
  );
}

const RAIZ = path.resolve(__dirname, "..");
function leer(rutaRelativa: string): string {
  return readFileSync(path.join(RAIZ, rutaRelativa), "utf8");
}

// ════════════════════════════════════════════════════════════════════════════
// Utilería de datos: un plano y su obra de mentira
// ════════════════════════════════════════════════════════════════════════════

const MB = 1024 * 1024;
const OBRA = "obra-1";

function producto(overrides: Partial<ProductoParaVista> & { id: string }): ProductoParaVista {
  return {
    proyecto_id: OBRA,
    tipo: "PLANO" as TipoProductoTecnico,
    version: 1,
    vigente: false,
    reemplaza_a: null,
    nombre: "Planta arquitectónica nivel 1",
    pisoId: null,
    unidadId: null,
    fecha: "2026-01-15T14:30:00.000Z",
    subidoPorId: "usuario-1",
    subidoPorNombre: "Ana Arquitecta",
    ubicacionEtiqueta: "Obra completa",
    ...overrides,
  };
}

const EDIFICIOS: EdificioOpcion[] = [
  {
    id: "edificio-1",
    nombre: "Torre A",
    pisos: [
      { id: "piso-3", numero: 3, unidades: [{ id: "apto-301", nombre: "301" }, { id: "apto-302", nombre: "302" }] },
      { id: "piso-5", numero: 5, unidades: [{ id: "apto-501", nombre: "501" }] },
    ],
  },
];

function productoApi(overrides: Partial<ProductoApi> & { id: string }): ProductoApi {
  return {
    proyecto_id: OBRA,
    piso_id: null,
    unidad_id: null,
    tipo: "PLANO",
    nombre: "Planta arquitectónica nivel 1",
    descripcion: null,
    mime: "application/pdf",
    bytes: 2 * MB,
    version: 1,
    vigente: true,
    reemplaza_a: null,
    subido_por_id: "usuario-1",
    created_at: "2026-01-15T14:30:00.000Z",
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════

console.log("Productos Técnicos — capa de presentación (planos y renders)\n");

// ──────────────────────────────────────────────────────────────────────────
console.log("1 — Qué versión se marca VIGENTE en la vista, y qué queda apagado");
// ──────────────────────────────────────────────────────────────────────────
{
  // Cadena de tres versiones — la 3 es la vigente, número más alto y vigente
  // coinciden (el caso normal: nadie volvió atrás).
  const cadenaNormal = [
    producto({ id: "v1", version: 1, vigente: false, reemplaza_a: null }),
    producto({ id: "v2", version: 2, vigente: false, reemplaza_a: "v1" }),
    producto({ id: "v3", version: 3, vigente: true, reemplaza_a: "v2" }),
  ];
  const vistaNormal = ordenarParaVista(cadenaNormal);
  verificar("la vigente (v3) va primera", vistaNormal[0].id === "v3" && vistaNormal[0].vigente);
  verificarIgual(
    "el resto queda apagado (vigente: false) y ordenado por versión descendente",
    vistaNormal.slice(1).map((v) => [v.id, v.vigente]),
    [["v2", false], ["v1", false]],
  );

  // Caso borde: se volvió atrás. La v1 es la vigente aunque la v3 —con más
  // versión— siga existiendo. Es EXACTAMENTE el caso que existe para evitar
  // que alguien construya sobre un plano viejo: si la vigente no queda
  // primera aquí, la pantalla mentiría.
  const cadenaConReversion = [
    producto({ id: "v1", version: 1, vigente: true, reemplaza_a: null }),
    producto({ id: "v2", version: 2, vigente: false, reemplaza_a: "v1" }),
    producto({ id: "v3", version: 3, vigente: false, reemplaza_a: "v2" }),
  ];
  const vistaConReversion = ordenarParaVista(cadenaConReversion);
  verificar(
    "tras volver atrás, la v1 (vigente) va primera aunque tenga el número más bajo",
    vistaConReversion[0].id === "v1" && vistaConReversion[0].vigente,
  );
  verificarIgual(
    "la v3 (más reciente, pero YA NO vigente) queda apagada, antes que la v2 por número",
    vistaConReversion.slice(1).map((v) => v.id),
    ["v3", "v2"],
  );
  verificar(
    "de las tres, únicamente la vigente no está apagada",
    vistaConReversion.filter((v) => v.vigente).length === 1,
  );
}

console.log("\n  agruparPlanos parte el listado de la obra en sus planos individuales");
{
  const universo = [
    // Plano A: dos versiones, la 2 vigente.
    producto({ id: "a1", nombre: "Planta nivel 1", version: 1, vigente: false, reemplaza_a: null }),
    producto({ id: "a2", nombre: "Planta nivel 1", version: 2, vigente: true, reemplaza_a: "a1" }),
    // Plano B: una sola versión.
    producto({ id: "b1", nombre: "Fachada oriental", version: 1, vigente: true, reemplaza_a: null }),
  ];
  const agrupados = agruparPlanos(universo);
  verificar("dos plano distintos, no tres filas sueltas", agrupados.length === 2);
  verificarIgual(
    "cada grupo trae TODAS sus versiones, ninguna se pierde al agrupar",
    agrupados.map((p) => p.versiones.length).sort(),
    [1, 2],
  );
  const planoA = agrupados.find((p) => p.id === "a2");
  verificar("el id del grupo es el de la versión VIGENTE (ancla estable)", !!planoA);
  verificar(
    "dentro del plano A, la vigente (a2) es la primera de sus versiones",
    planoA?.versiones[0].id === "a2",
  );
}

// ──────────────────────────────────────────────────────────────────────────
console.log("\n2 — Cada versión llega a la vista con su fecha y quién la subió");
// ──────────────────────────────────────────────────────────────────────────
{
  const api = productoApi({ id: "p1", subido_por_id: "usuario-7", created_at: "2026-03-02T09:15:00.000Z" });
  const nombrePorId = new Map([["usuario-7", "Carlos Contratista"]]);
  const vista = aProductoParaVista(api, { nombrePorId, edificios: EDIFICIOS });
  verificar("la fecha no se pierde en el mapeo", vista.fecha === "2026-03-02T09:15:00.000Z");
  verificar("el id de quien subió no se pierde", vista.subidoPorId === "usuario-7");
  verificar("el nombre de quien subió se resuelve", vista.subidoPorNombre === "Carlos Contratista");

  console.log("  Caso borde: el usuario que subió ya no está (nombre no resuelto)");
  const sinNombre = aProductoParaVista(
    productoApi({ id: "p2", subido_por_id: "usuario-borrado" }),
    { nombrePorId: new Map(), edificios: EDIFICIOS },
  );
  verificar("subidoPorNombre queda null, no se inventa un nombre", sinNombre.subidoPorNombre === null);
  const vistaOrdenada = ordenarParaVista([{ ...sinNombre, vigente: true }]);
  verificar(
    "…y la fila de la vista igual muestra algo legible, nunca vacío",
    vistaOrdenada[0].subidoPor.length > 0 && vistaOrdenada[0].subidoPor !== "null",
  );

  console.log("  La ubicación (obra / piso / unidad) también se resuelve en el mapeo");
  verificarIgual(
    "sin piso ni unidad → Obra completa",
    aProductoParaVista(productoApi({ id: "p3" }), { nombrePorId: new Map(), edificios: EDIFICIOS })
      .ubicacionEtiqueta,
    "Obra completa",
  );
  verificarIgual(
    "con piso → nombra el piso y el edificio",
    aProductoParaVista(productoApi({ id: "p4", piso_id: "piso-5" }), { nombrePorId: new Map(), edificios: EDIFICIOS })
      .ubicacionEtiqueta,
    "Piso 5 · Torre A",
  );
  verificarIgual(
    "con unidad → nombra la unidad, su piso y su edificio",
    aProductoParaVista(
      productoApi({ id: "p5", piso_id: "piso-3", unidad_id: "apto-302" }),
      { nombrePorId: new Map(), edificios: EDIFICIOS },
    ).ubicacionEtiqueta,
    "302 · Piso 3 · Torre A",
  );
  console.log("  Caso borde: el piso/unidad referenciado ya no está en el árbol (no revienta)");
  verificar(
    "un piso_id que no existe no lanza, cae a una etiqueta genérica",
    etiquetaDeUbicacion(EDIFICIOS, "piso-fantasma", null) === "Piso",
  );
  verificar(
    "piso_id y unidad_id nulos a la vez → Obra completa",
    etiquetaDeUbicacion(EDIFICIOS, null, null) === "Obra completa",
  );

  console.log("  Renders: la vigente se lista, la reemplazada no");
  const renders = renderesVigentes([
    producto({ id: "r1", tipo: "RENDER" as TipoProductoTecnico, nombre: "Fachada", version: 1, vigente: false }),
    producto({ id: "r2", tipo: "RENDER" as TipoProductoTecnico, nombre: "Fachada", version: 2, vigente: true, reemplaza_a: "r1" }),
  ]);
  verificar("solo la vigente aparece en la grilla de renders", renders.length === 1 && renders[0].id === "r2");
}

// ──────────────────────────────────────────────────────────────────────────
console.log("\n3 — El cupo se calcula bien para pintarlo (barra y aviso previo)");
// ──────────────────────────────────────────────────────────────────────────
verificar("el umbral de aviso es 70%", UMBRAL_AVISO === 70);
verificar("el umbral crítico es 90%", UMBRAL_CRITICO === 90);
verificarIgual("0% → ok, 69% → ok, 70% → aviso, 89% → aviso, 90% → crítico, 100% → crítico", [
  nivelDeCupo(0), nivelDeCupo(69), nivelDeCupo(70), nivelDeCupo(89), nivelDeCupo(90), nivelDeCupo(100),
], ["ok", "ok", "aviso", "aviso", "critico", "critico"]);

{
  const mitad = cupoParaPintar({
    limiteBytes: CUPO_BYTES_POR_OBRA,
    usadoBytes: CUPO_BYTES_POR_OBRA / 2,
    restanteBytes: CUPO_BYTES_POR_OBRA / 2,
    porcentaje: 50,
  });
  verificar("al 50% el nivel es ok (no molesta con avisos de la nada)", mitad.nivel === "ok");
  verificar(
    "los textos legibles salen de formatearBytes (el mismo del dominio), no de un cálculo propio",
    mitad.usadoLegible === formatearBytes(CUPO_BYTES_POR_OBRA / 2) &&
      mitad.limiteLegible === formatearBytes(CUPO_BYTES_POR_OBRA),
  );

  const casiLleno = cupoParaPintar({
    limiteBytes: CUPO_BYTES_POR_OBRA,
    usadoBytes: CUPO_BYTES_POR_OBRA - 5 * MB,
    restanteBytes: 5 * MB,
    porcentaje: 100,
  });
  verificar("al borde real (quedan 5 MB) el nivel es crítico", casiLleno.nivel === "critico");

  console.log("  Aviso ANTES de subir: si el archivo elegido no cabe, se sabe sin esperar el 413 del servidor");
  const estadoConPoco = { limiteBytes: CUPO_BYTES_POR_OBRA, usadoBytes: CUPO_BYTES_POR_OBRA - 10 * MB, restanteBytes: 10 * MB, porcentaje: 99 };
  verificar("un archivo de 9 MB cabe", cabeEnCupo(estadoConPoco, 9 * MB));
  verificar("un archivo de exactamente lo que queda cabe (borde)", cabeEnCupo(estadoConPoco, 10 * MB));
  verificar("un archivo de 11 MB NO cabe", !cabeEnCupo(estadoConPoco, 11 * MB));
}

// ──────────────────────────────────────────────────────────────────────────
console.log("\n4 — El formulario de subida solo ofrece lo que el servidor va a aceptar");
// ──────────────────────────────────────────────────────────────────────────
{
  verificarIgual(
    "PLANO acepta las mismas extensiones que el dominio (FORMATOS_POR_TIPO), en el mismo orden",
    extensionesAceptadas("PLANO" as TipoProductoTecnico),
    [".pdf", ".png", ".jpg", ".webp"],
  );
  verificarIgual(
    "REGISTRO_INICIAL, aunque no tenga pantalla propia en este leaf, sigue siendo solo imagen",
    extensionesAceptadas("REGISTRO_INICIAL" as TipoProductoTecnico),
    [".png", ".jpg", ".webp"],
  );
  verificar(
    "el accept del input trae también los MIME (para navegadores que filtran por MIME, no extensión)",
    acceptDeTipo("RENDER" as TipoProductoTecnico).includes("application/pdf") &&
      acceptDeTipo("RENDER" as TipoProductoTecnico).includes(".pdf"),
  );
  verificar(
    "la etiqueta de ayuda nombra los formatos permitidos, no un texto genérico",
    etiquetaFormatos("PLANO" as TipoProductoTecnico) === "PDF, PNG, JPEG, WEBP",
  );
}

// ──────────────────────────────────────────────────────────────────────────
console.log("\n5 — La vista no reimplementa ni esquiva el dominio ni la API existente");
// ──────────────────────────────────────────────────────────────────────────
{
  const logica = [
    "vista-planos.ts",
    "vista-cupo.ts",
    "vista-formatos.ts",
    "mapear-producto.ts",
    "api-productos-tecnicos.ts",
  ]
    .map((f) => leer(`src/components/productos-tecnicos/logica/${f}`))
    .join("\n");

  verificar(
    "el módulo de vista no llama a Prisma directamente (eso es del server component / la API)",
    !/prisma\./.test(logica) && !/@\/lib\/prisma/.test(logica),
  );
  verificar(
    "ningún archivo de presentación borra/elimina productos técnicos",
    !/\b(borrarProducto|eliminarProducto|delete\(|deleteMany\()\b/.test(logica),
  );
  verificar(
    "agruparPlanos usa cadenaDeVersiones del DOMINIO en vez de reconstruir la cadena a mano",
    /cadenaDeVersiones/.test(leer("src/components/productos-tecnicos/logica/vista-planos.ts")),
  );

  const dialogo = leer("src/components/productos-tecnicos/SubidaProductoDialog.tsx");
  verificar(
    "el diálogo de subida usa acceptDeTipo() para el input, no una lista de extensiones escrita a mano",
    /accept=\{acceptDeTipo\(/.test(dialogo),
  );
  verificar(
    "el diálogo sube el archivo a través de subirProducto() (la ruta API existente), no con un fetch propio",
    /subirProducto\(/.test(dialogo) && !/fetch\(/.test(dialogo),
  );

  const cliente = leer("src/app/(dashboard)/dashboard/proyectos/[id]/tecnicos/client.tsx");
  verificar(
    "'volver a esta versión' llama a marcarVersionVigente(), que es el PATCH .../vigente ya existente",
    /marcarVersionVigente\(/.test(cliente),
  );
  verificar(
    "el cliente nunca llama fetch() directo — todo pasa por logica/api-productos-tecnicos.ts",
    !/\bfetch\(/.test(cliente),
  );

  const fila = leer("src/components/productos-tecnicos/VersionPlanoRow.tsx");
  verificar(
    "la fila de versión decide su estilo (apagada/plena) mirando `vigente`",
    /version\.vigente/.test(fila),
  );

  console.log("  La navegación no ofrece el módulo a quien no tiene la capacidad");
  const pagina = leer("src/app/(dashboard)/dashboard/proyectos/[id]/tecnicos/page.tsx");
  verificar(
    "la pantalla corta con perfilPuedeProductosTecnicos() antes de mostrar nada",
    /perfilPuedeProductosTecnicos\(/.test(pagina),
  );
  const listaProyecto = leer("src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx");
  verificar(
    "el link 'Planos y renders' del proyecto está condicionado por puede(tipo, \"productosTecnicos\")",
    /puede\([^)]*"productosTecnicos"\)/.test(listaProyecto) &&
      /\/tecnicos`/.test(listaProyecto),
  );
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} verificación(es) fallaron.`);
  process.exit(1);
}
console.log(
  "Capa de presentación de Productos Técnicos verificada sin errores. " +
    "(Las reglas del dominio — una sola vigente, versiones que nunca se borran, " +
    "rechazo de formatos no permitidos — están en scripts/verificar-productos-tecnicos.ts " +
    "y no se repiten aquí.)",
);
