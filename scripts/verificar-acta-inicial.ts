/**
 * Verifica el registro fotográfico inicial y el acta de estado inicial
 * (leaf-5.2) contra las seis reglas que hacen útil el documento.
 *
 * LO QUE ESTÁ EN JUEGO. Este entregable existe para ganar una discusión
 * concreta: «esa grieta ya estaba» contra «no, la hiciste tú». La gana un
 * registro fotográfico fechado y geolocalizado del estado previo. Y la pierde,
 * entera, si una sola de estas cosas se cuela:
 *
 *   - una foto subida desde la galería (no prueba fecha),
 *   - una foto sin fecha, hora y ubicación quemadas (lo mismo),
 *   - un acta que no identifique el predio del que habla,
 *   - un acta que prometa una figura procesal que el producto no entrega,
 *   - un acta que afirme que el inmueble se puede habitar.
 *
 * Por eso el script no se limita a comprobar que el código corre: hace un
 * escaneo ESTÁTICO de los archivos del registro inicial buscando cualquier vía
 * de subida desde archivo, y un CONTROL POSITIVO —bloque 6— que mete una foto
 * sin overlay y comprueba que el propio verificador falla. Un guardián que no
 * se puede ver fallar no es un guardián.
 *
 * No toca la base de datos ni la red. Importar módulos que usan Prisma no abre
 * ninguna conexión —Prisma conecta en la primera consulta— y aquí no se hace
 * ninguna.
 *
 * No hay test runner en el proyecto: este script es la suite, en asserts planos,
 * con el mismo estilo que `scripts/verificar-reglas-alerta.ts`.
 *
 * Uso: `npx tsx scripts/verificar-acta-inicial.ts`. Sale con código 1 si algo falla.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";
import { ActaEstadoInicialReport } from "@/lib/pdf/ActaEstadoInicialReport";

import {
  esFolioDeFamilia,
  hashContenido,
  hashCorto,
  PATRON_FOLIO,
  type PrefijoFolio,
} from "@/lib/documentos/folio";
import { resolverVerificacion } from "@/lib/documentos/cotejo";
import { PREFIJO_POR_TIPO, planificarEmision } from "@/lib/documentos/versiones";
import { ETIQUETA_TIPO, TERMINOS_PROHIBIDOS } from "@/lib/documentos/lenguaje";
import { ETIQUETAS_DOCUMENTO } from "@/lib/inmueble/copys";
import type { DatosInmueble } from "@/lib/inmueble";

import {
  construirMarca,
  leerMarca,
  serializarMarca,
  tieneOverlay,
  OVERLAY_FECHA_HORA_UBICACION,
  VERSION_MARCA,
} from "@/components/productos-tecnicos/logica/marca-foto-inicial";
import {
  listarEspacios,
  tieneEspacios,
  type ArbolInmueble,
} from "@/components/productos-tecnicos/logica/arbol-espacios";
import {
  construirPayloadActa,
  esActaInicialError,
  fotosEnOrden,
  leerContenidoActa,
  serializarContenidoActa,
  textosDelPayload,
  MAX_FOTOS_ACTA,
  type FotoRegistroFila,
  type PayloadActaInicial,
} from "@/components/productos-tecnicos/logica/acta-estado-inicial";
import {
  expresionProhibida,
  COLOCACIONES_PROHIBIDAS,
  RUTA_VERIFICACION,
  TEXTOS_DEL_ACTA,
  TEXTO_VERIFICACION,
} from "@/components/productos-tecnicos/logica/copys-acta-inicial";
import {
  aFotoVista,
  agruparPorEspacio,
  numerarComoEnElActa,
  separarPorMarca,
  type FotoRegistroVista,
} from "@/components/productos-tecnicos/logica/vista-registro-inicial";
import type { ProductoApi } from "@/components/productos-tecnicos/logica/api-productos-tecnicos";

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
    iguales
      ? descripcion
      : `${descripcion} → esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(obtenido)}`,
    iguales,
  );
}

/** Comprueba que `fn` lanza, y que lanza el código esperado. */
function verificarLanza(descripcion: string, codigoEsperado: string, fn: () => void) {
  total++;
  try {
    fn();
    fallos++;
    console.error(`  FAIL ${descripcion} (no lanzó error)`);
  } catch (err) {
    const codigo = esActaInicialError(err) ? err.codigo : "(error sin código)";
    if (codigo === codigoEsperado) {
      console.log(`  OK   ${descripcion}`);
    } else {
      fallos++;
      console.error(`  FAIL ${descripcion} → esperado ${codigoEsperado}, lanzó ${codigo}`);
    }
  }
}

const RAIZ = path.resolve(__dirname, "..");

function leer(rutaRelativa: string): string {
  return readFileSync(path.join(RAIZ, rutaRelativa), "utf8");
}

/**
 * El código sin comentarios.
 *
 * Hace falta porque los propios archivos EXPLICAN por qué no usan
 * `<input type="file" capture>`, y un `grep` sobre el fuente crudo encontraría
 * esa explicación y la confundiría con el defecto que busca. El guardián no
 * puede saltar por el comentario que dice que el defecto no está.
 *
 * El `//` solo se corta cuando no viene precedido de `:`, para no destrozar las
 * URLs (`https://…`) que aparecen dentro de cadenas.
 */
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// ════════════════════════════════════════════════════════════════════════════
// Utilería de datos: un inmueble y un registro de mentira
// ════════════════════════════════════════════════════════════════════════════

const ARBOL: ArbolInmueble = [
  {
    id: "torre-a",
    nombre: "Torre A",
    pisos: [
      {
        id: "piso-5",
        numero: 5,
        unidades: [
          {
            id: "apto-501",
            nombre: "Apto 501",
            espacios: [
              { id: "esp-cocina", nombre: "Cocina" },
              { id: "esp-sala", nombre: "Sala" },
            ],
          },
        ],
      },
      {
        id: "piso-9",
        numero: 9,
        unidades: [
          {
            id: "apto-904",
            nombre: "Apto 904",
            espacios: [{ id: "esp-bano", nombre: "Baño principal" }],
          },
        ],
      },
    ],
  },
];

const ESPACIOS = listarEspacios(ARBOL);

const INMUEBLE: DatosInmueble = {
  matricula_inmobiliaria: "370-7596",
  direccion_inmueble: "Calle 33A #2B-100",
  conjunto_edificio: "Conjunto Prados del Naranjo",
  unidad_inmueble: "Apto 904B",
  ciudad: "Cali",
  tipo_propiedad: "APARTAMENTO",
  metraje_total: 70,
  anio_construccion: 2001,
  altura_libre_m: 2.4,
  habitada_durante_obra: true,
  solicitante: "Ana Steward",
};

const PROFESIONAL = { nombre: "Ana Arquitecta", matricula: "76251-12345 ANT" };
const EMITIDA = new Date("2026-08-30T15:00:00.000Z");

/** Una foto del registro, con su marca bien puesta. */
function foto(params: {
  id: string;
  espacioId: string;
  espacio: string;
  unidadId: string;
  minutos: number;
  nota?: string | null;
}): FotoRegistroFila {
  const capturadaEn = new Date(Date.UTC(2026, 7, 30, 14, params.minutos, 0));
  return {
    id: params.id,
    nombre: params.espacio,
    descripcion: serializarMarca(
      construirMarca({
        espacioId: params.espacioId,
        espacio: params.espacio,
        unidadId: params.unidadId,
        capturadaEn,
        gps: { lat: 3.451647, lng: -76.531985 },
        nota: params.nota ?? null,
      }),
    ),
    unidad_id: params.unidadId,
    created_at: capturadaEn.toISOString(),
  };
}

/**
 * El registro completo. Ojo al orden en que llegan: la del baño (piso 9) se tomó
 * ANTES que las del piso 5, para poder comprobar que el acta ordena por el
 * recorrido del inmueble y no por la hora.
 */
const REGISTRO_SANO: FotoRegistroFila[] = [
  foto({ id: "f-bano-1", espacioId: "esp-bano", espacio: "Baño principal", unidadId: "apto-904", minutos: 5 }),
  foto({
    id: "f-cocina-2",
    espacioId: "esp-cocina",
    espacio: "Cocina",
    unidadId: "apto-501",
    minutos: 40,
    nota: "Fisura vertical sobre el marco de la puerta",
  }),
  foto({ id: "f-cocina-1", espacioId: "esp-cocina", espacio: "Cocina", unidadId: "apto-501", minutos: 20 }),
  foto({ id: "f-sala-1", espacioId: "esp-sala", espacio: "Sala", unidadId: "apto-501", minutos: 55 }),
];

/**
 * El mismo registro con UNA foto sin marca: misma fila, misma imagen, pero sin
 * fecha, hora ni ubicación. Es exactamente lo que quedaría si alguien subiera
 * una imagen de la galería por la ruta genérica de productos técnicos.
 */
const REGISTRO_ENVENENADO: FotoRegistroFila[] = [
  ...REGISTRO_SANO.slice(0, 3),
  { ...REGISTRO_SANO[3], descripcion: null },
];

/**
 * EL CONTROL POSITIVO, en su forma fuerte.
 *
 * Con `--control-positivo` el registro con el que se verifica TODO es el
 * envenenado, y ninguna comprobación de este archivo cambia ni una línea. Si el
 * script sigue diciendo «N/N OK» con una foto sin fecha dentro, es que no
 * comprueba nada. La demostración está en el ledger: la ejecución normal sale
 * con 0, la de la bandera sale con 1.
 */
const CONTROL_POSITIVO = process.argv.includes("--control-positivo");
const REGISTRO: FotoRegistroFila[] = CONTROL_POSITIVO ? REGISTRO_ENVENENADO : REGISTRO_SANO;

function payloadDe(fotos: readonly FotoRegistroFila[]): PayloadActaInicial {
  return construirPayloadActa({
    obra: { id: "obra-1", nombre: "Reforma Apto 904" },
    inmueble: INMUEBLE,
    arbol: ARBOL,
    fotos,
    profesional: PROFESIONAL,
    emitidaEn: EMITIDA,
  });
}

/**
 * EL VERIFICADOR EN SÍ: las cuatro condiciones que un registro tiene que cumplir
 * para poder emitirse como acta. Se declara como función porque el bloque 6 la
 * vuelve a llamar con datos rotos y comprueba que devuelve `false`.
 */
function registroEmisible(fotos: readonly FotoRegistroFila[]): boolean {
  if (fotos.length === 0) return false;
  if (!fotos.every((f) => tieneOverlay(f.descripcion))) return false;
  try {
    const payload = payloadDe(fotos);
    return payload.totalFotos === fotos.length && payload.inmueble.length > 0;
  } catch {
    return false;
  }
}

/** Los archivos que forman el registro inicial. Es la superficie que se audita. */
const ARCHIVOS_REGISTRO_INICIAL = [
  "src/components/productos-tecnicos/CamaraRegistroInicial.tsx",
  "src/components/productos-tecnicos/SelectorEspacioRegistro.tsx",
  "src/components/productos-tecnicos/FotoRegistroCard.tsx",
  "src/components/productos-tecnicos/EspacioRegistroSection.tsx",
  "src/components/productos-tecnicos/FotosSinMarcaAviso.tsx",
  "src/components/productos-tecnicos/RegistroInicialPanel.tsx",
  "src/components/productos-tecnicos/PanelActaInicial.tsx",
  "src/components/productos-tecnicos/ActaEmitidaCard.tsx",
  "src/components/productos-tecnicos/logica/marca-foto-inicial.ts",
  "src/components/productos-tecnicos/logica/arbol-espacios.ts",
  "src/components/productos-tecnicos/logica/acta-estado-inicial.ts",
  "src/components/productos-tecnicos/logica/copys-acta-inicial.ts",
  "src/components/productos-tecnicos/logica/api-acta-inicial.ts",
  "src/components/productos-tecnicos/logica/vista-registro-inicial.ts",
  "src/components/productos-tecnicos/logica/vista-acta-inicial.ts",
  "src/app/(dashboard)/dashboard/proyectos/[id]/tecnicos/registro-inicial/page.tsx",
  "src/app/(dashboard)/dashboard/proyectos/[id]/tecnicos/registro-inicial/client.tsx",
  "src/app/api/productos-tecnicos/acta/route.ts",
  "src/app/api/productos-tecnicos/acta/_almacen-acta.ts",
  "src/app/api/productos-tecnicos/acta/foto/route.ts",
  "src/app/api/productos-tecnicos/acta/foto/[id]/route.ts",
  "src/app/api/productos-tecnicos/acta/[id]/pdf/route.ts",
  "src/lib/pdf/ActaEstadoInicialReport.tsx",
];

console.log("Acta de estado inicial y registro fotográfico — verificación (leaf-5.2)\n");

// ════════════════════════════════════════════════════════════════════════════
// 1 — NO HAY NINGUNA VÍA DE SUBIR DESDE LA GALERÍA
// ════════════════════════════════════════════════════════════════════════════
console.log("1 — Ninguna vía de subida desde la galería en el registro inicial");

verificar(
  `los ${ARCHIVOS_REGISTRO_INICIAL.length} archivos del registro inicial existen`,
  ARCHIVOS_REGISTRO_INICIAL.every((f) => existsSync(path.join(RAIZ, f))),
);

const CODIGO = new Map(ARCHIVOS_REGISTRO_INICIAL.map((f) => [f, sinComentarios(leer(f))]));

const conInputArchivo = [...CODIGO.entries()].filter(([, codigo]) =>
  /type\s*=\s*["'{]?\s*["']?file["']?/i.test(codigo),
);
verificar(
  conInputArchivo.length === 0
    ? "ningún archivo del registro inicial declara un <input type=\"file\">"
    : `hay <input type="file"> en: ${conInputArchivo.map(([f]) => f).join(", ")}`,
  conInputArchivo.length === 0,
);

const conAccept = [...CODIGO.entries()].filter(([, codigo]) => /\baccept\s*=/.test(codigo));
verificar(
  conAccept.length === 0
    ? "ningún archivo del registro inicial usa el atributo accept (ni image/*, ni ningún otro)"
    : `hay accept= en: ${conAccept.map(([f]) => f).join(", ")}`,
  conAccept.length === 0,
);

const conCapture = [...CODIGO.entries()].filter(([, codigo]) => /\bcapture\s*=/.test(codigo));
verificar(
  conCapture.length === 0
    ? "tampoco se usa capture=: el registro no depende de una pista que el navegador puede ignorar"
    : `hay capture= en: ${conCapture.map(([f]) => f).join(", ")}`,
  conCapture.length === 0,
);

const conFilePicker = [...CODIGO.entries()].filter(([, codigo]) =>
  /showOpenFilePicker|DataTransfer|onDrop\s*=|webkitdirectory/.test(codigo),
);
verificar(
  conFilePicker.length === 0
    ? "tampoco hay selector de archivos por API ni zona de arrastrar y soltar"
    : `hay selector alterno en: ${conFilePicker.map(([f]) => f).join(", ")}`,
  conFilePicker.length === 0,
);

const camara = CODIGO.get("src/components/productos-tecnicos/CamaraRegistroInicial.tsx")!;
verificar(
  "la cámara toma los píxeles de getUserMedia (MediaStream), no de un archivo",
  camara.includes("getUserMedia") && camara.includes("drawImage"),
);
verificar(
  "la cámara detiene las pistas del MediaStream al desmontarse",
  camara.includes("getTracks()") && camara.includes(".stop()"),
);

const panel = CODIGO.get("src/components/productos-tecnicos/RegistroInicialPanel.tsx")!;
verificar(
  "la pantalla del registro no monta SubidaProductoDialog (el diálogo de planos y renders)",
  !panel.includes("SubidaProductoDialog"),
);
verificar(
  "la pantalla del registro no llama subirProducto() (la subida genérica desde archivo)",
  !panel.includes("subirProducto"),
);

const apiActa = CODIGO.get("src/components/productos-tecnicos/logica/api-acta-inicial.ts")!;
verificar(
  "la capa de red del registro no sabe nombrar la ruta genérica POST /api/productos-tecnicos",
  !/fetch\(\s*["']\/api\/productos-tecnicos["']/.test(apiActa),
);
verificar(
  "la única subida del registro va a /api/productos-tecnicos/acta/foto",
  apiActa.includes("/api/productos-tecnicos/acta/foto"),
);

const rutaFoto = CODIGO.get("src/app/api/productos-tecnicos/acta/foto/route.ts")!;
verificar(
  "la ruta de subida empieza por requireUser() (contrato de rutas nuevas)",
  rutaFoto.includes("requireUser()"),
);
verificar(
  "la ruta de subida valida el tenant con contextoProductosTecnicos() + assertObraAccesible()",
  rutaFoto.includes("contextoProductosTecnicos(") && rutaFoto.includes("assertObraAccesible("),
);
verificar(
  "la ruta de subida exige instante y coordenadas, y construye la marca en el SERVIDOR",
  rutaFoto.includes("capturada_en") &&
    rutaFoto.includes("construirMarca(") &&
    rutaFoto.includes("MARGEN_PASADO_MS"),
);
verificar(
  "la ruta de subida deja el formato en manos del dominio (prepararSubida → magic number)",
  rutaFoto.includes("prepararSubida(") && rutaFoto.includes("REGISTRO_INICIAL"),
);

// ════════════════════════════════════════════════════════════════════════════
// 2 — TODA FOTO LLEVA FECHA, HORA Y UBICACIÓN
// ════════════════════════════════════════════════════════════════════════════
console.log("\n2 — Toda foto del registro lleva fecha, hora y ubicación quemadas");

const marcaBuena = construirMarca({
  espacioId: "esp-cocina",
  espacio: "Cocina",
  unidadId: "apto-501",
  capturadaEn: new Date("2026-08-30T14:20:00.000Z"),
  gps: { lat: 3.451647, lng: -76.531985 },
});
verificar("la marca declara qué se quemó, no un simple booleano", marcaBuena.overlay === OVERLAY_FECHA_HORA_UBICACION);
verificar("la marca lleva versión de formato", marcaBuena.v === VERSION_MARCA);
verificarIgual(
  "la marca sobrevive al viaje de ida y vuelta por `descripcion`",
  leerMarca(serializarMarca(marcaBuena)),
  marcaBuena,
);

verificar("las cuatro fotos del registro de prueba llevan overlay", REGISTRO.every((f) => tieneOverlay(f.descripcion)));

console.log("  Sin marca, o con una marca incompleta, NO es una foto del registro:");
verificar("descripcion nula → no hay marca", leerMarca(null) === null);
verificar("descripcion vacía → no hay marca", leerMarca("") === null);
verificar("texto libre (no JSON) → no hay marca", leerMarca("Foto de la cocina") === null);
verificar("JSON que no es un objeto → no hay marca", leerMarca("[1,2,3]") === null);
verificar(
  "marca de otra versión → no hay marca",
  leerMarca(JSON.stringify({ ...marcaBuena, v: 99 })) === null,
);
verificar(
  "marca sin la constancia del overlay → no hay marca",
  leerMarca(JSON.stringify({ ...marcaBuena, overlay: "solo-fecha" })) === null,
);
verificar(
  "marca sin instante de captura → no hay marca",
  leerMarca(JSON.stringify({ ...marcaBuena, capturadaEn: "" })) === null,
);
verificar(
  "marca con instante ilegible → no hay marca",
  leerMarca(JSON.stringify({ ...marcaBuena, capturadaEn: "ayer por la tarde" })) === null,
);
verificar(
  "marca sin latitud → no hay marca",
  leerMarca(JSON.stringify({ ...marcaBuena, lat: null })) === null,
);
verificar(
  "marca sin longitud → no hay marca",
  leerMarca(JSON.stringify({ ...marcaBuena, lng: undefined })) === null,
);
verificar(
  "coordenada fuera del planeta (lat 91) → no hay marca",
  leerMarca(JSON.stringify({ ...marcaBuena, lat: 91 })) === null,
);
verificar(
  "coordenada fuera del planeta (lng -181) → no hay marca",
  leerMarca(JSON.stringify({ ...marcaBuena, lng: -181 })) === null,
);
verificar(
  "marca sin espacio → no hay marca",
  leerMarca(JSON.stringify({ ...marcaBuena, espacioId: "  " })) === null,
);

console.log("  Construir una marca incompleta lanza, no rellena con valores por defecto:");
let lanzoSinGps = false;
try {
  construirMarca({
    espacioId: "esp-cocina",
    espacio: "Cocina",
    unidadId: "apto-501",
    capturadaEn: new Date(),
    gps: { lat: Number.NaN, lng: -76.5 },
  });
} catch {
  lanzoSinGps = true;
}
verificar("construirMarca() sin coordenadas utilizables lanza", lanzoSinGps);

console.log("  La pantalla aplica la MISMA regla que el documento:");
function productoApi(fila: FotoRegistroFila): ProductoApi {
  return {
    id: fila.id,
    proyecto_id: "obra-1",
    piso_id: null,
    unidad_id: fila.unidad_id,
    tipo: "REGISTRO_INICIAL",
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    mime: "image/jpeg",
    bytes: 120_000,
    version: 1,
    vigente: true,
    reemplaza_a: null,
    subido_por_id: "usuario-1",
    created_at: fila.created_at,
  };
}
verificar(
  "aFotoVista() devuelve null para una fila sin marca — no se pinta como si fuera del registro",
  aFotoVista(productoApi({ ...REGISTRO[0], descripcion: null }), ESPACIOS, "blob:x") === null,
);

const vistas = REGISTRO.map((f) => aFotoVista(productoApi(f), ESPACIOS, "blob:x")).filter(
  (f): f is FotoRegistroVista => f !== null,
);
verificar("las cuatro fotos válidas sí llegan a la pantalla", vistas.length === 4);

const gruposVista = agruparPorEspacio(vistas, ESPACIOS);
verificarIgual(
  "la pantalla agrupa por espacio en el orden del inmueble (Cocina, Sala, Baño)",
  gruposVista.map((g) => g.nombre),
  ["Cocina", "Sala", "Baño principal"],
);
const numeros = numerarComoEnElActa(gruposVista);
verificarIgual(
  "la pantalla numera igual que el acta: la foto 3 es la misma en los dos sitios",
  [numeros.get("f-cocina-1"), numeros.get("f-cocina-2"), numeros.get("f-sala-1"), numeros.get("f-bano-1")],
  [1, 2, 3, 4],
);

// ════════════════════════════════════════════════════════════════════════════
// 3 — EL ACTA SE REGISTRA CON FOLIO Y VERIFICA
// ════════════════════════════════════════════════════════════════════════════
console.log("\n3 — El acta se registra con folio y verifica en la página de verificación");

/**
 * Construir el acta es lo primero que se hace aquí, y con razón: si el registro
 * no cumple, no hay documento del que hablar. Con `--control-positivo` es
 * exactamente lo que ocurre, y el script se para aquí con código 1.
 */
let payload: PayloadActaInicial;
try {
  payload = payloadDe(REGISTRO);
  verificar("el acta se construye a partir del registro de la obra", true);
} catch (err) {
  verificar(
    `el acta se construye a partir del registro de la obra → ${err instanceof Error ? err.message : String(err)}`,
    false,
  );
  console.log(`\n${total - fallos}/${total} verificaciones OK`);
  console.error(
    `${fallos} verificación(es) fallaron. El registro no cumple las reglas y no hay acta que verificar.`,
  );
  process.exit(1);
}
const contenido = serializarContenidoActa(payload);

verificar("el acta de estado inicial lleva prefijo de folio AE", PREFIJO_POR_TIPO.ACTA_ESTADO_INICIAL === "AE");

const emision = planificarEmision({ tipo: "ACTA_ESTADO_INICIAL", contenido }, EMITIDA);
verificar("el folio emitido tiene la forma canónica", PATRON_FOLIO.test(emision.folio));
verificar("el folio emitido empieza por AE-", emision.folio.startsWith("AE-"));
verificar("nace como versión 1 y sin nada a que reemplazar", emision.version === 1 && emision.reemplaza_a === null);
verificar(
  "la huella es SHA-256 del contenido serializado + el folio",
  emision.hash === hashContenido(contenido, emision.folio),
);

const PREFIJOS_PROFESIONAL: readonly PrefijoFolio[] = ["AE", "CT"];
verificar(
  "la ruta pública de verificación reconoce el folio como de la familia del profesional",
  esFolioDeFamilia(emision.folio, PREFIJOS_PROFESIONAL),
);

const hallado = {
  estado: "encontrado" as const,
  documento: {
    tipo: "ACTA_ESTADO_INICIAL" as const,
    hash: emision.hash,
    emitido: EMITIDA,
    firmas: {
      profesional: { fecha: "2026-08-30", matricula: PROFESIONAL.matricula },
      recibido: null,
    },
  },
};

/**
 * `ResultadoVerificacion` es una unión de tres formas —encontrado, ausente e
 * indisponible—, y solo una de ellas tiene `huellaCoincide`. Se estrecha aquí,
 * una vez, en lugar de repetir la comprobación en cada assert.
 */
function comoEncontrado(resultado: ReturnType<typeof resolverVerificacion>) {
  return "existe" in resultado && resultado.existe ? resultado : null;
}

const conHuellaImpresa = comoEncontrado(resolverVerificacion([hallado], hashCorto(emision.hash)));
verificar(
  "con la huella CORTA impresa en el pie, la verificación dice que el contenido coincide",
  conHuellaImpresa?.huellaCoincide === true,
);
const conHuellaCompleta = comoEncontrado(resolverVerificacion([hallado], emision.hash));
verificar(
  "con el SHA-256 completo también coteja",
  conHuellaCompleta?.huellaCoincide === true,
);
const sinHuella = comoEncontrado(resolverVerificacion([hallado], null));
verificar(
  "sin huella responde `null` (no la mandó ≠ no coincide)",
  sinHuella !== null && sinHuella.huellaCoincide === null,
);
verificar(
  "la verificación publica la firma del profesional y su matrícula",
  sinHuella?.firmas?.profesional?.matricula === PROFESIONAL.matricula,
);
verificarIgual("y dice de qué tipo de documento se trata", sinHuella?.tipo, "ACTA_ESTADO_INICIAL");

console.log("  Un solo byte distinto rompe el cotejo:");
const otroContenido = `${contenido} `;
const otraHuella = hashContenido(otroContenido, emision.folio);
verificar("un espacio de más al final cambia la huella", otraHuella !== emision.hash);
const cotejoRoto = comoEncontrado(resolverVerificacion([hallado], hashCorto(otraHuella)));
verificar(
  "y la verificación lo dice: el contenido no coincide",
  cotejoRoto?.huellaCoincide === false,
);

console.log("  El contenido es reproducible y se congela tal cual se resume:");
verificar(
  "serializar dos veces el mismo payload da la MISMA cadena",
  serializarContenidoActa(payloadDe(REGISTRO)) === contenido,
);
verificarIgual(
  "el contenido guardado se vuelve a leer entero",
  leerContenidoActa(contenido)?.totalFotos,
  payload.totalFotos,
);
verificar("un contenido ilegible se detecta", leerContenidoActa("{no soy json") === null);

console.log("  La página pública de verificación existe y es la que dice el pie del PDF:");
verificar(
  "existe src/app/verificar/page.tsx",
  existsSync(path.join(RAIZ, "src/app/verificar/page.tsx")),
);
verificar("la ruta declarada en los copys es /verificar", RUTA_VERIFICACION === "/verificar");
verificar(
  "el pie del PDF remite a esa misma dirección",
  TEXTO_VERIFICACION.includes(`seiricon.com${RUTA_VERIFICACION}`),
);
const clienteVerificar = sinComentarios(leer("src/app/verificar/client.tsx"));
verificar(
  "la página consulta /api/documentos/verificar (la ruta que responde por AE y CT)",
  clienteVerificar.includes("/api/documentos/verificar"),
);
const proxy = sinComentarios(leer("src/proxy.ts"));
verificar(
  "la página de verificación es pública: /verificar no está en el matcher del proxy",
  !proxy.includes("/verificar"),
);
verificar(
  "la respuesta afirmativa aclara que NO confirma el estado del inmueble",
  clienteVerificar.includes("No confirma el estado del inmueble"),
);

console.log("  La emisión pasa por el módulo de documentos, nunca escribiendo la fila a mano:");
const rutaActa = CODIGO.get("src/app/api/productos-tecnicos/acta/route.ts")!;
verificar(
  "la ruta del acta emite con emitirDocumento() / emitirCorreccion()",
  rutaActa.includes("emitirDocumento(") && rutaActa.includes("emitirCorreccion("),
);
verificar(
  "la ruta del acta NO escribe ni actualiza documentos_firmables por su cuenta",
  !/documentoFirmable\s*\.\s*(create|update|updateMany|upsert|delete)/.test(rutaActa),
);
const rutaPdf = CODIGO.get("src/app/api/productos-tecnicos/acta/[id]/pdf/route.ts")!;
verificar(
  "el PDF se imprime desde la copia congelada, no reconstruyendo el contenido",
  rutaPdf.includes("leerSnapshotActa("),
);
verificar(
  "y antes de imprimir vuelve a cotejar la huella contra el registro",
  rutaPdf.includes("hashContenido(") && rutaPdf.includes("CONTENIDO_ALTERADO"),
);

// ════════════════════════════════════════════════════════════════════════════
// 4 — DATOS DEL INMUEBLE, INCLUIDA LA MATRÍCULA
// ════════════════════════════════════════════════════════════════════════════
console.log("\n4 — El acta lleva los datos del inmueble, incluida la matrícula inmobiliaria");

const etiquetas = payload.inmueble.map((l) => l.etiqueta);
verificar(
  `el bloque del inmueble incluye «${ETIQUETAS_DOCUMENTO.matricula_inmobiliaria}»`,
  etiquetas.includes(ETIQUETAS_DOCUMENTO.matricula_inmobiliaria),
);
verificarIgual(
  "y con el valor del predio, tal cual",
  payload.inmueble.find((l) => l.etiqueta === ETIQUETAS_DOCUMENTO.matricula_inmobiliaria)?.valor,
  INMUEBLE.matricula_inmobiliaria,
);
verificar(
  "el bloque sale de lineasInmuebleParaDocumento(): dirección, ciudad, tipo, área, año y norma sísmica",
  [
    ETIQUETAS_DOCUMENTO.direccion_inmueble,
    ETIQUETAS_DOCUMENTO.ciudad,
    ETIQUETAS_DOCUMENTO.tipo_propiedad,
    ETIQUETAS_DOCUMENTO.metraje_total,
    ETIQUETAS_DOCUMENTO.anio_construccion,
    ETIQUETAS_DOCUMENTO.norma_sismica,
  ].every((e) => etiquetas.includes(e)),
);
verificar(
  "la dirección se lee junto al conjunto, como la escribe un arquitecto",
  payload.inmueble
    .find((l) => l.etiqueta === ETIQUETAS_DOCUMENTO.direccion_inmueble)
    ?.valor.includes("Conjunto Prados del Naranjo") === true,
);

console.log("  Sin matrícula, el acta NO se emite (no se emite a medias):");
verificarLanza("un inmueble sin matrícula no produce acta", "SIN_MATRICULA_INMOBILIARIA", () =>
  construirPayloadActa({
    obra: { id: "obra-1", nombre: "Reforma Apto 904" },
    inmueble: { ...INMUEBLE, matricula_inmobiliaria: null },
    arbol: ARBOL,
    fotos: REGISTRO,
    profesional: PROFESIONAL,
    emitidaEn: EMITIDA,
  }),
);
verificarLanza("una matrícula en blanco tampoco cuela", "SIN_MATRICULA_INMOBILIARIA", () =>
  construirPayloadActa({
    obra: { id: "obra-1", nombre: "Reforma Apto 904" },
    inmueble: { ...INMUEBLE, matricula_inmobiliaria: "   " },
    arbol: ARBOL,
    fotos: REGISTRO,
    profesional: PROFESIONAL,
    emitidaEn: EMITIDA,
  }),
);
verificarLanza("sin dirección tampoco", "SIN_DIRECCION", () =>
  construirPayloadActa({
    obra: { id: "obra-1", nombre: "Reforma Apto 904" },
    inmueble: { ...INMUEBLE, direccion_inmueble: "" },
    arbol: ARBOL,
    fotos: REGISTRO,
    profesional: PROFESIONAL,
    emitidaEn: EMITIDA,
  }),
);

console.log("  El registro fotográfico va organizado por espacio y numerado:");
verificar("el inmueble de prueba tiene espacios", tieneEspacios(ARBOL));
verificarIgual("se aplanan los tres espacios de la obra", ESPACIOS.length, 3);
verificarIgual(
  "cada espacio lleva su dirección completa dentro de la obra",
  ESPACIOS[0].ubicacion,
  "Cocina · Apto 501 · Piso 5 · Torre A",
);
verificarIgual(
  "el acta agrupa por espacio, en el orden del recorrido y no por hora de captura",
  payload.espacios.map((e) => e.nombre),
  ["Cocina", "Sala", "Baño principal"],
);
verificarIgual(
  "la numeración es global y corre en el orden de lectura del documento",
  fotosEnOrden(payload).map((f) => `${f.numero}:${f.productoId}`),
  ["1:f-cocina-1", "2:f-cocina-2", "3:f-sala-1", "4:f-bano-1"],
);
verificar(
  "cada foto imprime dónde se tomó dentro del inmueble",
  fotosEnOrden(payload).every((f) => f.ubicacion.includes("Torre A") || f.ubicacion === f.espacio),
);
verificar(
  "cada foto conserva su instante y sus coordenadas",
  fotosEnOrden(payload).every((f) => !Number.isNaN(Date.parse(f.capturadaEn)) && Number.isFinite(f.lat)),
);
verificarIgual("el acta acota el registro en el tiempo", payload.primeraCaptura, REGISTRO[0].created_at);
verificarIgual(
  "y dice cuál fue la última captura",
  payload.ultimaCaptura,
  REGISTRO[3].created_at,
);
verificarIgual("el resumen cuenta espacios y fotos", [payload.totalEspacios, payload.totalFotos], [3, 4]);
verificar(
  "la observación del profesional viaja con su foto",
  fotosEnOrden(payload).find((f) => f.productoId === "f-cocina-2")?.nota ===
    "Fisura vertical sobre el marco de la puerta",
);

console.log("  Un espacio borrado de la obra no borra su foto del acta:");
const arbolSinCocina: ArbolInmueble = [
  {
    ...ARBOL[0],
    pisos: [
      {
        ...ARBOL[0].pisos[0],
        unidades: [
          { ...ARBOL[0].pisos[0].unidades[0], espacios: [{ id: "esp-sala", nombre: "Sala" }] },
        ],
      },
      ARBOL[0].pisos[1],
    ],
  },
];
const payloadSinCocina = construirPayloadActa({
  obra: { id: "obra-1", nombre: "Reforma Apto 904" },
  inmueble: INMUEBLE,
  arbol: arbolSinCocina,
  fotos: REGISTRO,
  profesional: PROFESIONAL,
  emitidaEn: EMITIDA,
});
verificar("las cuatro fotos siguen en el acta", payloadSinCocina.totalFotos === 4);
verificarIgual(
  "el espacio que ya no existe va al final, con el nombre congelado en su foto",
  payloadSinCocina.espacios.map((e) => e.nombre),
  ["Sala", "Baño principal", "Cocina"],
);

console.log("  Topes y estados vacíos:");
verificarLanza("un registro sin fotos no produce acta", "SIN_FOTOS", () => payloadDe([]));
verificarLanza("pasarse del tope de fotos no produce acta", "DEMASIADAS_FOTOS", () =>
  payloadDe(
    Array.from({ length: MAX_FOTOS_ACTA + 1 }, (_, i) =>
      foto({
        id: `f-${i}`,
        espacioId: "esp-sala",
        espacio: "Sala",
        unidadId: "apto-501",
        minutos: i % 59,
      }),
    ),
  ),
);
verificarLanza("sin nombre del profesional tampoco", "SIN_PROFESIONAL", () =>
  construirPayloadActa({
    obra: { id: "obra-1", nombre: "Reforma Apto 904" },
    inmueble: INMUEBLE,
    arbol: ARBOL,
    fotos: REGISTRO,
    profesional: { nombre: "   ", matricula: null },
    emitidaEn: EMITIDA,
  }),
);

// ════════════════════════════════════════════════════════════════════════════
// 5 — LENGUAJE: «CONCEPTO TÉCNICO», NUNCA UNA FIGURA PROCESAL NI UNA PROMESA
// ════════════════════════════════════════════════════════════════════════════
console.log("\n5 — Lenguaje: concepto técnico, nunca peritaje, y sin afirmar seguridad ni habitabilidad");

verificar(
  "el acta se llama «Acta de estado inicial» en pantalla",
  ETIQUETA_TIPO.ACTA_ESTADO_INICIAL === "Acta de estado inicial",
);
verificar(
  "y el documento declara que es un concepto técnico de registro",
  payload.metodologia.naturaleza.toLowerCase().includes("concepto técnico"),
);

const textosProhibidos = TEXTOS_DEL_ACTA.map((t) => ({ t, mal: expresionProhibida(t) })).filter(
  (x) => x.mal !== null,
);
verificar(
  textosProhibidos.length === 0
    ? `los ${TEXTOS_DEL_ACTA.length} textos del acta están limpios`
    : `texto prohibido: ${JSON.stringify(textosProhibidos)}`,
  textosProhibidos.length === 0,
);

const delPayload = textosDelPayload(payload).map((t) => ({ t, mal: expresionProhibida(t) })).filter(
  (x) => x.mal !== null,
);
verificar(
  delPayload.length === 0
    ? "el acta ya construida —inmueble, espacios y notas incluidos— también está limpia"
    : `texto prohibido en el acta construida: ${JSON.stringify(delPayload)}`,
  delPayload.length === 0,
);

console.log("  El barrido cubre las dos listas, y las dos muerden:");
verificar(
  "la lista de términos prohibidos viene de src/lib/documentos/lenguaje.ts, no se reescribe aquí",
  TERMINOS_PROHIBIDOS.length >= 4,
);
for (const termino of TERMINOS_PROHIBIDOS) {
  verificar(
    `un texto con «${termino}» sería rechazado`,
    expresionProhibida(`Este documento constituye un ${termino} del inmueble.`) === termino,
  );
}
for (const colocacion of COLOCACIONES_PROHIBIDAS) {
  verificar(
    `una afirmación con «${colocacion}» sería rechazada`,
    expresionProhibida(`Se concluye que el inmueble ${colocacion} tras la revisión.`) !== null,
  );
}
verificar(
  "un texto normal del acta no se rechaza por casualidad",
  expresionProhibida("Se observaron fisuras en el muro de la cocina.") === null,
);

console.log("  La metodología dice qué NO incluye, y lo dice completo:");
verificar("hay al menos seis exclusiones declaradas", payload.metodologia.noIncluye.length >= 6);
for (const clave of [
  "ensayos",
  "cálculo estructural",
  "elementos ocultos",
  "habitabilidad",
]) {
  verificar(
    `la lista de exclusiones nombra «${clave}»`,
    payload.metodologia.noIncluye.some((l) => l.toLowerCase().includes(clave)),
  );
}
verificar(
  "y remite el pronunciamiento a un profesional con matrícula vigente",
  payload.metodologia.noIncluye.some((l) => l.includes("matrícula vigente")),
);

console.log("  Ningún archivo del entregable contiene una figura prohibida:");
const archivosSucios = [...CODIGO.entries()]
  .map(([archivo, codigo]) => ({
    archivo,
    mal: TERMINOS_PROHIBIDOS.find((t) => codigo.toLowerCase().includes(t)) ?? null,
  }))
  .filter((x) => x.mal !== null);
verificar(
  archivosSucios.length === 0
    ? `los ${CODIGO.size} archivos del entregable están limpios de figuras procesales`
    : `figura prohibida en: ${JSON.stringify(archivosSucios)}`,
  archivosSucios.length === 0,
);

// El archivo que DEFINE la lista de colocaciones se excluye de este barrido: la
// lista tiene que contener lo prohibido para poder buscarlo, igual que
// `lenguaje.ts` parte sus términos por la misma razón.
const DEFINE_LAS_COLOCACIONES = "src/components/productos-tecnicos/logica/copys-acta-inicial.ts";
const conAfirmacion = [...CODIGO.entries()]
  .filter(([archivo]) => archivo !== DEFINE_LAS_COLOCACIONES)
  .map(([archivo, codigo]) => ({
    archivo,
    mal: COLOCACIONES_PROHIBIDAS.find((c) => codigo.toLowerCase().includes(c)) ?? null,
  }))
  .filter((x) => x.mal !== null);
verificar(
  conAfirmacion.length === 0
    ? "ningún archivo afirma que el inmueble sea seguro, estable o habitable"
    : `afirmación prohibida en: ${JSON.stringify(conAfirmacion)}`,
  conAfirmacion.length === 0,
);

// ════════════════════════════════════════════════════════════════════════════
// 6 — CONTROL POSITIVO: UNA FOTO SIN OVERLAY HACE FALLAR AL VERIFICADOR
// ════════════════════════════════════════════════════════════════════════════
console.log("\n6 — Control positivo: una foto sin overlay hace FALLAR al verificador");

verificar(
  "con el registro completo, el verificador da por bueno el acta",
  registroEmisible(REGISTRO_SANO) === true,
);
verificar(
  "con UNA foto sin overlay, el mismo verificador dice que NO",
  registroEmisible(REGISTRO_ENVENENADO) === false,
);
verificarLanza(
  "y el acta se niega a construirse, nombrando el código FOTO_SIN_OVERLAY",
  "FOTO_SIN_OVERLAY",
  () => payloadDe(REGISTRO_ENVENENADO),
);

console.log("  El control positivo aguanta las tres formas de romper el overlay:");
const variantes: Array<[string, string]> = [
  ["una descripción de texto libre en vez de marca", "Foto tomada en la cocina"],
  ["una marca sin coordenadas", JSON.stringify({ ...marcaBuena, lat: null, lng: null })],
  ["una marca que no declara el overlay", JSON.stringify({ ...marcaBuena, overlay: "ninguno" })],
];
for (const [descripcion, veneno] of variantes) {
  const roto = [...REGISTRO_SANO.slice(0, 3), { ...REGISTRO_SANO[3], descripcion: veneno }];
  verificar(`${descripcion} → el verificador falla`, registroEmisible(roto) === false);
}

console.log("  La foto envenenada NO se esconde: sale aparte, para poder descartarla:");
const separado = separarPorMarca(
  REGISTRO_ENVENENADO.map(productoApi),
  ESPACIOS,
  new Map(REGISTRO_ENVENENADO.map((f) => [f.id, null])),
);
verificarIgual("tres fotos del registro y una fuera de él", [separado.fotos.length, separado.sinMarca.length], [3, 1]);
verificarIgual(
  "la que queda fuera es la que perdió la marca, con su id para poder descartarla",
  separado.sinMarca[0]?.id,
  "f-sala-1",
);
verificarIgual(
  "un registro sano no deja ninguna fuera",
  separarPorMarca(REGISTRO_SANO.map(productoApi), ESPACIOS, new Map()).sinMarca.length,
  0,
);
const avisoSinMarca = CODIGO.get("src/components/productos-tecnicos/FotosSinMarcaAviso.tsx")!;
verificar(
  "y la pantalla las enseña con su botón de descartar, en vez de dejarlas invisibles",
  avisoSinMarca.includes("onDescartar") && avisoSinMarca.includes("Descartar"),
);

console.log("  Y no falla por cualquier cosa: el registro sano vuelve a pasar:");
verificar(
  "quitando la foto envenenada, el acta se emite otra vez",
  registroEmisible(REGISTRO_SANO.slice(0, 3)) === true,
);
verificarIgual(
  "y queda con tres fotos, renumeradas de 1 a 3",
  fotosEnOrden(payloadDe(REGISTRO_SANO.slice(0, 3))).map((f) => f.numero),
  [1, 2, 3],
);

// ════════════════════════════════════════════════════════════════════════════
// 7 — EL ACTA SE IMPRIME DE VERDAD
// ════════════════════════════════════════════════════════════════════════════
//
// Todo lo de arriba comprueba el contenido. Esto comprueba el papel: que
// react-pdf sepa dibujar el componente con los datos reales del acta. Es un
// riesgo que ninguna otra comprobación cubre —una plantilla con un estilo
// inválido no rompe ni tipos ni lint, rompe en el momento en que alguien pulsa
// «descargar»— y es barato de cerrar aquí.
console.log("\n7 — El acta se imprime de verdad (react-pdf, sin base de datos)");

/** Un PNG de 1×1 transparente. Basta para probar que las imágenes se dibujan. */
const PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function imprimir(opciones: {
  imagenes: Record<string, string>;
  firmaDataUrl: string | null;
  firmadoMomento: string | null;
}): Promise<Buffer> {
  return renderToBuffer(
    ActaEstadoInicialReport({
      payload,
      folio: emision.folio,
      huellaCorta: hashCorto(emision.hash),
      logoDataUrl: null,
      ...opciones,
    }),
  );
}

async function bloqueDeImpresion() {
  const todas = Object.fromEntries(fotosEnOrden(payload).map((f) => [f.productoId, PIXEL_PNG]));

  const firmada = await imprimir({
    imagenes: todas,
    firmaDataUrl: PIXEL_PNG,
    firmadoMomento: "30 de agosto de 2026, 10:15",
  });
  verificar("el acta firmada genera un PDF válido", firmada.subarray(0, 5).toString() === "%PDF-");
  verificar("y no es un PDF vacío", firmada.length > 3000);

  const sinFirmar = await imprimir({ imagenes: todas, firmaDataUrl: null, firmadoMomento: null });
  verificar(
    "un acta todavía sin firmar también se imprime (con el espacio de firma en blanco)",
    sinFirmar.subarray(0, 5).toString() === "%PDF-",
  );

  // Una foto que no se pudo descargar deja un hueco; lo que no puede es tumbar
  // el documento entero.
  const conHueco = await imprimir({
    imagenes: Object.fromEntries(Object.entries(todas).slice(1)),
    firmaDataUrl: null,
    firmadoMomento: null,
  });
  verificar(
    "una foto que falta deja un hueco, no rompe la generación",
    conHueco.subarray(0, 5).toString() === "%PDF-",
  );
}

bloqueDeImpresion()
  .catch((err) => {
    fallos++;
    total++;
    console.error(`  FAIL el acta no se pudo imprimir → ${err instanceof Error ? err.message : err}`);
  })
  .finally(() => {
    console.log(`\n${total - fallos}/${total} verificaciones OK`);
    if (fallos > 0) {
      console.error(`${fallos} verificación(es) fallaron.`);
      process.exit(1);
    }
    console.log("Registro fotográfico inicial y acta de estado inicial verificados sin errores.");
  });
