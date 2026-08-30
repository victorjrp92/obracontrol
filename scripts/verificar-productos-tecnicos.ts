/**
 * Verifica los cimientos del módulo de Productos Técnicos
 * (`src/lib/productos-tecnicos/`): el cupo de 1 GB por obra, el amarre a obra
 * / piso / unidad, quién entra al módulo, la detección del tipo real del
 * archivo por sus primeros bytes, y la garantía de una sola versión vigente
 * por plano.
 *
 * SIN BASE DE DATOS. Todo lo que necesita saber el dominio entra por los tres
 * puertos de `PuertosSubida`, y aquí se inyectan a mano. Eso es lo que permite
 * probar cosas que con Postgres delante costarían un seed entero: que el cupo
 * cuenta las versiones REEMPLAZADAS, que un perfil sin permiso se corta ANTES
 * de tocar la base, o que un `.pdf` que por dentro es un PNG se rechaza.
 *
 * No hay test runner en el proyecto — este script es la suite, en asserts
 * planos, con el mismo estilo que `scripts/verificar-reglas-alerta.ts`.
 *
 * Uso: `npx tsx scripts/verificar-productos-tecnicos.ts`. Sale con código 1 si
 * algo falla.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { TipoCuenta, TipoProductoTecnico } from "@/generated/prisma";
import { assertPerfilConAcceso, perfilPuedeProductosTecnicos } from "@/lib/productos-tecnicos/acceso";
import {
  bytesOcupados,
  estadoCupo,
  formatearBytes,
  verificarCupo,
  verificarTamanoArchivo,
  CUPO_BYTES_POR_OBRA,
  MAX_BYTES_POR_ARCHIVO,
} from "@/lib/productos-tecnicos/cupo";
import { ProductoTecnicoError, type CodigoProductoTecnico } from "@/lib/productos-tecnicos/errores";
import {
  detectarFormato,
  extensionCanonica,
  extensionDe,
  validarArchivo,
  BYTES_CABECERA,
  FORMATOS_POR_TIPO,
} from "@/lib/productos-tecnicos/formatos";
import { rutaPerteneceAObra, rutaProductoTecnico } from "@/lib/productos-tecnicos/ruta";
import { prepararSubida } from "@/lib/productos-tecnicos/subida";
import { nivelDeUbicacion, validarUbicacion } from "@/lib/productos-tecnicos/ubicacion";
import {
  cadenaDeVersiones,
  planificarCambioDeVigente,
  planificarNuevaVersion,
  vigenteDeLaCadena,
} from "@/lib/productos-tecnicos/versionado";
import type {
  ArchivoEntrante,
  EntradaSubida,
  ProductoVersionado,
  PuertosSubida,
} from "@/lib/productos-tecnicos/tipos";

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

function describirError(err: unknown): string {
  if (err instanceof ProductoTecnicoError) return `${err.status}/${err.codigo}`;
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** Comprueba que algo síncrono lanza con el status y el código esperados. */
function verificarLanza(
  descripcion: string,
  fn: () => unknown,
  esperado: { status: number; codigo: CodigoProductoTecnico },
) {
  total++;
  try {
    fn();
    fallos++;
    console.error(`  FAIL ${descripcion} (no lanzó error)`);
  } catch (err) {
    if (
      err instanceof ProductoTecnicoError &&
      err.status === esperado.status &&
      err.codigo === esperado.codigo
    ) {
      console.log(`  OK   ${descripcion}`);
    } else {
      fallos++;
      console.error(
        `  FAIL ${descripcion} → esperado ${esperado.status}/${esperado.codigo}, obtuvo ${describirError(err)}`,
      );
    }
  }
}

/** La versión asíncrona, para `prepararSubida`. */
async function verificarRechaza(
  descripcion: string,
  fn: () => Promise<unknown>,
  esperado: { status: number; codigo: CodigoProductoTecnico },
) {
  total++;
  try {
    await fn();
    fallos++;
    console.error(`  FAIL ${descripcion} (no lanzó error)`);
  } catch (err) {
    if (
      err instanceof ProductoTecnicoError &&
      err.status === esperado.status &&
      err.codigo === esperado.codigo
    ) {
      console.log(`  OK   ${descripcion}`);
    } else {
      fallos++;
      console.error(
        `  FAIL ${descripcion} → esperado ${esperado.status}/${esperado.codigo}, obtuvo ${describirError(err)}`,
      );
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Utilería: cabeceras reales, archivos de mentira y puertos inyectados
// ════════════════════════════════════════════════════════════════════════════

const MB = 1024 * 1024;

function cabecera(...bytes: number[]): Uint8Array {
  const buf = new Uint8Array(BYTES_CABECERA);
  buf.set(bytes.slice(0, BYTES_CABECERA));
  return buf;
}

// Primeros bytes REALES de cada formato.
const CAB_PDF = cabecera(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37); // "%PDF-1.7"
const CAB_PNG = cabecera(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const CAB_JPEG = cabecera(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
const CAB_WEBP = cabecera(
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
);
// "RIFF" pero WAVE: comparte los cuatro primeros bytes con WEBP y no lo es.
const CAB_WAV = cabecera(
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
);
// Un ZIP, que es lo que de verdad suele esconderse detrás de un nombre falso.
const CAB_ZIP = cabecera(0x50, 0x4b, 0x03, 0x04);
const CAB_BASURA = cabecera(0x00, 0x01, 0x02, 0x03, 0x04, 0x05);

function archivo(datos: {
  cabecera: Uint8Array;
  nombre: string;
  mime?: string | null;
  bytes?: number;
}): ArchivoEntrante {
  return {
    nombre: datos.nombre,
    mimeDeclarado: datos.mime ?? null,
    bytes: datos.bytes ?? 2 * MB,
    cabecera: datos.cabecera,
  };
}

const OBRA = "obra-1";

function entrada(cambios: Partial<EntradaSubida> = {}): EntradaSubida {
  return {
    ubicacion: { proyectoId: OBRA },
    tipo: "PLANO",
    nombre: "Planta arquitectónica nivel 1",
    descripcion: null,
    archivo: archivo({ cabecera: CAB_PDF, nombre: "planta-n1.pdf", mime: "application/pdf" }),
    reemplazaA: null,
    ...cambios,
  };
}

function puertos(cambios: Partial<PuertosSubida> = {}): PuertosSubida {
  return {
    bytesUsadosEnObra: async () => 0,
    ubicacionPertenece: async () => true,
    buscarProducto: async () => null,
    ...cambios,
  };
}

function version(datos: Partial<ProductoVersionado> & { id: string }): ProductoVersionado {
  return {
    proyecto_id: OBRA,
    tipo: "PLANO" as TipoProductoTecnico,
    version: 1,
    vigente: false,
    reemplaza_a: null,
    ...datos,
  };
}

const RAIZ = path.resolve(__dirname, "..");

function leer(rutaRelativa: string): string {
  return readFileSync(path.join(RAIZ, rutaRelativa), "utf8");
}

// ════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("Productos Técnicos — cimientos del módulo\n");

  // ──────────────────────────────────────────────────────────────────────────
  console.log("1 — Cupo de 1 GB por obra");
  // ──────────────────────────────────────────────────────────────────────────
  verificar("el cupo es exactamente 1 GB (1024³)", CUPO_BYTES_POR_OBRA === 1024 * 1024 * 1024);
  verificar(
    "un proyecto real de arquitecto (~262 MB) cabe con margen de sobra",
    262 * MB * 3 < CUPO_BYTES_POR_OBRA,
  );
  verificar("una obra vacía no ocupa nada", bytesOcupados([]) === 0);
  verificarIgual(
    "estadoCupo(0) deja el gigabyte entero libre",
    estadoCupo(0),
    {
      limiteBytes: CUPO_BYTES_POR_OBRA,
      usadoBytes: 0,
      restanteBytes: CUPO_BYTES_POR_OBRA,
      porcentaje: 0,
    },
  );
  verificarIgual(
    "estadoCupo(1 GB) deja 0 libres y marca 100%",
    estadoCupo(CUPO_BYTES_POR_OBRA),
    {
      limiteBytes: CUPO_BYTES_POR_OBRA,
      usadoBytes: CUPO_BYTES_POR_OBRA,
      restanteBytes: 0,
      porcentaje: 100,
    },
  );

  console.log("  Caso borde: lo que cabe EXACTO cabe; un byte más, no");
  verificar(
    "un archivo que ocupa justo lo que queda se acepta",
    verificarCupo(CUPO_BYTES_POR_OBRA - 10 * MB, 10 * MB).restanteBytes === 0,
  );
  verificarLanza(
    "un byte por encima del cupo se rechaza con 413",
    () => verificarCupo(CUPO_BYTES_POR_OBRA - 10 * MB, 10 * MB + 1),
    { status: 413, codigo: "CUPO_EXCEDIDO" },
  );

  console.log("  El mensaje dice cuánto queda (si no, hay que adivinar)");
  try {
    verificarCupo(CUPO_BYTES_POR_OBRA - 24 * MB, 40 * MB);
    verificar("el rechazo por cupo trae mensaje", false);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    verificar(
      `el mensaje dice cuánto queda libre y cuánto pesa el archivo: «${mensaje}»`,
      mensaje.includes("Quedan 24 MB") && mensaje.includes("40 MB") && mensaje.includes("1 GB"),
    );
  }

  verificar("formatearBytes redondea sin depender del locale", formatearBytes(1536) === "1.5 KB");
  verificar("formatearBytes(1 GB) === '1 GB'", formatearBytes(CUPO_BYTES_POR_OBRA) === "1 GB");

  console.log("\n  El cálculo INCLUYE las versiones reemplazadas");
  // Una obra con dos versiones del mismo plano: la vieja (reemplazada, 600 MB)
  // y la nueva (vigente, 400 MB). La vieja NO se borró — ocupa igual.
  const productosDeLaObra = [
    { bytes: 600 * MB, vigente: false }, // versión 1, reemplazada
    { bytes: 400 * MB, vigente: true }, // versión 2, vigente
  ];
  const soloVigentes = productosDeLaObra.filter((p) => p.vigente).reduce((s, p) => s + p.bytes, 0);
  verificar(
    "bytesOcupados suma vigentes Y reemplazadas (1000 MB), no solo las vigentes",
    bytesOcupados(productosDeLaObra) === 1000 * MB,
  );
  verificar(
    "contar solo las vigentes daría 400 MB — la diferencia es lo que está en juego",
    soloVigentes === 400 * MB && soloVigentes !== bytesOcupados(productosDeLaObra),
  );
  verificar(
    "con las reemplazadas quedan 24 MB libres; sin ellas parecerían 624 MB",
    estadoCupo(bytesOcupados(productosDeLaObra)).restanteBytes === 24 * MB &&
      estadoCupo(soloVigentes).restanteBytes === 624 * MB,
  );
  await verificarRechaza(
    "subir 40 MB a esa obra se rechaza (cabría si no contaran las reemplazadas)",
    () =>
      prepararSubida(
        entrada({
          archivo: archivo({
            cabecera: CAB_PDF,
            nombre: "planta-n2.pdf",
            mime: "application/pdf",
            bytes: 40 * MB,
          }),
        }),
        puertos({ bytesUsadosEnObra: async () => bytesOcupados(productosDeLaObra) }),
        "ARQUITECTO",
      ),
    { status: 413, codigo: "CUPO_EXCEDIDO" },
  );
  {
    const plan = await prepararSubida(
      entrada({
        archivo: archivo({
          cabecera: CAB_PDF,
          nombre: "planta-n2.pdf",
          mime: "application/pdf",
          bytes: 20 * MB,
        }),
      }),
      puertos({ bytesUsadosEnObra: async () => bytesOcupados(productosDeLaObra) }),
      "ARQUITECTO",
    );
    verificar(
      "lo que sí cabe (20 MB) se acepta y el cupo devuelto ya lo descuenta",
      plan.cupo.usadoBytes === 1020 * MB && plan.cupo.restanteBytes === 4 * MB,
    );
  }

  console.log("\n  Tope por archivo suelto");
  verificar("el tope por archivo es 50 MB", MAX_BYTES_POR_ARCHIVO === 50 * MB);
  verificarLanza(
    "un archivo de 0 bytes se rechaza",
    () => verificarTamanoArchivo(0),
    { status: 400, codigo: "ENTRADA_INVALIDA" },
  );
  verificarLanza(
    "un archivo de 51 MB se rechaza con 413",
    () => verificarTamanoArchivo(51 * MB),
    { status: 413, codigo: "ARCHIVO_DEMASIADO_GRANDE" },
  );
  await verificarRechaza(
    "un archivo vacío dice «llegó vacío», no «no reconozco el formato»",
    () =>
      prepararSubida(
        entrada({
          archivo: {
            nombre: "planta.pdf",
            mimeDeclarado: "application/pdf",
            bytes: 0,
            cabecera: new Uint8Array(0),
          },
        }),
        puertos(),
        "ARQUITECTO",
      ),
    { status: 400, codigo: "ENTRADA_INVALIDA" },
  );
  await verificarRechaza(
    "un PDF legítimo de 51 MB se rechaza por tamaño, no por formato",
    () =>
      prepararSubida(
        entrada({
          archivo: archivo({
            cabecera: CAB_PDF,
            nombre: "planta.pdf",
            mime: "application/pdf",
            bytes: 51 * MB,
          }),
        }),
        puertos(),
        "ARQUITECTO",
      ),
    { status: 413, codigo: "ARCHIVO_DEMASIADO_GRANDE" },
  );

  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n2 — Obra, piso o unidad; y SIEMPRE una obra");
  // ──────────────────────────────────────────────────────────────────────────
  verificar(
    "un archivo de la obra entera es válido y queda a nivel OBRA",
    nivelDeUbicacion(validarUbicacion({ proyectoId: OBRA })) === "OBRA",
  );
  verificar(
    "un archivo de un piso queda a nivel PISO",
    nivelDeUbicacion(validarUbicacion({ proyectoId: OBRA, pisoId: "piso-3" })) === "PISO",
  );
  verificar(
    "un archivo de una unidad queda a nivel UNIDAD",
    nivelDeUbicacion(validarUbicacion({ proyectoId: OBRA, unidadId: "apto-904" })) === "UNIDAD",
  );
  verificarLanza(
    "sin obra no hay producto técnico",
    () => validarUbicacion({ proyectoId: "" }),
    { status: 400, codigo: "UBICACION_INVALIDA" },
  );
  verificarLanza(
    "una obra en blanco tampoco cuenta como obra",
    () => validarUbicacion({ proyectoId: "   ", pisoId: "piso-3" }),
    { status: 400, codigo: "UBICACION_INVALIDA" },
  );
  verificarLanza(
    "piso y unidad a la vez es ambiguo y se rechaza",
    () => validarUbicacion({ proyectoId: OBRA, pisoId: "piso-3", unidadId: "apto-904" }),
    { status: 400, codigo: "UBICACION_INVALIDA" },
  );
  verificarIgual(
    "los ids vacíos se normalizan a null, no a cadena vacía",
    validarUbicacion({ proyectoId: OBRA, pisoId: "  ", unidadId: "" }),
    { proyectoId: OBRA, pisoId: null, unidadId: null },
  );

  for (const caso of [
    { etiqueta: "obra", ubicacion: { proyectoId: OBRA }, nivel: "OBRA" },
    { etiqueta: "piso", ubicacion: { proyectoId: OBRA, pisoId: "piso-3" }, nivel: "PISO" },
    { etiqueta: "unidad", ubicacion: { proyectoId: OBRA, unidadId: "apto-904" }, nivel: "UNIDAD" },
  ]) {
    const plan = await prepararSubida(entrada({ ubicacion: caso.ubicacion }), puertos(), "ARQUITECTO");
    verificar(
      `prepararSubida acepta el amarre a ${caso.etiqueta} y siempre conserva la obra`,
      plan.nivel === caso.nivel && plan.ubicacion.proyectoId === OBRA,
    );
  }

  console.log("  Aislamiento: un piso que no es de esa obra no entra");
  await verificarRechaza(
    "un piso de otra obra se rechaza con 404 (no se confirma que exista)",
    () =>
      prepararSubida(
        entrada({ ubicacion: { proyectoId: OBRA, pisoId: "piso-de-otra-obra" } }),
        puertos({ ubicacionPertenece: async () => false }),
        "ARQUITECTO",
      ),
    { status: 404, codigo: "UBICACION_AJENA" },
  );

  console.log("  La ruta de storage cuelga de la obra");
  {
    const ruta = rutaProductoTecnico({
      proyectoId: OBRA,
      tipo: "PLANO",
      extension: "pdf",
      sufijoUnico: "1756500000000-a1b2c3d4",
    });
    verificar(
      `la ruta empieza por productos-tecnicos/<obra>/: «${ruta}»`,
      ruta === "productos-tecnicos/obra-1/PLANO/1756500000000-a1b2c3d4.pdf",
    );
    verificar("rutaPerteneceAObra reconoce su propia obra", rutaPerteneceAObra(ruta, OBRA));
    verificar(
      "rutaPerteneceAObra rechaza la ruta de otra obra",
      !rutaPerteneceAObra(ruta, "obra-2"),
    );
    verificar(
      "un intento de salirse del prefijo se limpia en vez de escaparse",
      !rutaProductoTecnico({
        proyectoId: "../../evidencias",
        tipo: "PLANO",
        extension: "pdf",
        sufijoUnico: "x",
      }).includes(".."),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n3 — Solo ARQUITECTO y CONSTRUCTORA");
  // ──────────────────────────────────────────────────────────────────────────
  const CON_ACCESO: TipoCuenta[] = ["ARQUITECTO", "CONSTRUCTORA"];
  const SIN_ACCESO: TipoCuenta[] = ["CONTRATISTA", "PROPIETARIO"];

  for (const tipo of CON_ACCESO) {
    verificar(`${tipo} tiene la capacidad productosTecnicos`, perfilPuedeProductosTecnicos(tipo));
  }
  for (const tipo of SIN_ACCESO) {
    verificar(`${tipo} NO tiene la capacidad productosTecnicos`, !perfilPuedeProductosTecnicos(tipo));
    verificarLanza(
      `${tipo} recibe 403 al entrar al módulo`,
      () => assertPerfilConAcceso(tipo),
      { status: 403, codigo: "PERFIL_SIN_ACCESO" },
    );
  }

  for (const tipo of CON_ACCESO) {
    const plan = await prepararSubida(entrada(), puertos(), tipo);
    verificar(`${tipo} puede subir un plano`, plan.version === 1 && plan.mime === "application/pdf");
  }

  console.log("  El 403 corta ANTES de consultar nada");
  for (const tipo of SIN_ACCESO) {
    let llamadas = 0;
    const espias: PuertosSubida = {
      bytesUsadosEnObra: async () => {
        llamadas++;
        return 0;
      },
      ubicacionPertenece: async () => {
        llamadas++;
        return true;
      },
      buscarProducto: async () => {
        llamadas++;
        return null;
      },
    };
    await verificarRechaza(
      `${tipo} recibe 403 en prepararSubida`,
      () => prepararSubida(entrada(), espias, tipo),
      { status: 403, codigo: "PERFIL_SIN_ACCESO" },
    );
    verificar(`${tipo} no llegó a tocar ningún puerto (0 consultas)`, llamadas === 0);
  }

  console.log("  Las rutas API no tienen otro camino de entrada");
  const RUTAS = [
    "src/app/api/productos-tecnicos/route.ts",
    "src/app/api/productos-tecnicos/[id]/vigente/route.ts",
    "src/app/api/productos-tecnicos/[id]/descarga/route.ts",
  ];
  for (const ruta of RUTAS) {
    const fuente = leer(ruta);
    verificar(`${ruta} empieza por requireUser()`, /requireUser\(/.test(fuente));
    verificar(
      `${ruta} pasa por contextoProductosTecnicos() (que es quien devuelve el 403)`,
      /contextoProductosTecnicos\(/.test(fuente),
    );
    verificar(
      `${ruta} valida la obra con assertObraAccesible()`,
      /assertObraAccesible\(/.test(fuente),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n4 — Qué es el archivo DE VERDAD (magic number)");
  // ──────────────────────────────────────────────────────────────────────────
  verificar("los primeros bytes de un PDF lo identifican", detectarFormato(CAB_PDF)?.formato === "pdf");
  verificar("PNG", detectarFormato(CAB_PNG)?.formato === "png");
  verificar("JPEG", detectarFormato(CAB_JPEG)?.formato === "jpeg");
  verificar("WEBP", detectarFormato(CAB_WEBP)?.formato === "webp");
  verificar("un ZIP no es ninguno de los cuatro", detectarFormato(CAB_ZIP) === null);
  verificar("bytes arbitrarios no son ningún formato", detectarFormato(CAB_BASURA) === null);
  verificar(
    "un WAV empieza igual que un WEBP ('RIFF') y NO se confunde con uno",
    detectarFormato(CAB_WAV) === null,
  );
  verificar("extensionDe lee la última extensión", extensionDe("plano.final.PDF") === "pdf");
  verificar("un nombre sin extensión no inventa una", extensionDe("plano") === null);
  verificar("la extensión canónica de jpeg es jpg", extensionCanonica("jpeg") === "jpg");

  console.log("  Un archivo cuya extensión miente sobre su contenido se rechaza");
  verificarLanza(
    "un .pdf que por dentro es un PNG",
    () => validarArchivo("PLANO", archivo({ cabecera: CAB_PNG, nombre: "plano.pdf" })),
    { status: 415, codigo: "EXTENSION_ENGANOSA" },
  );
  verificarLanza(
    "un .png que por dentro es un PDF",
    () => validarArchivo("PLANO", archivo({ cabecera: CAB_PDF, nombre: "render.png" })),
    { status: 415, codigo: "EXTENSION_ENGANOSA" },
  );
  verificarLanza(
    "un .jpg que por dentro es un WEBP",
    () => validarArchivo("REGISTRO_INICIAL", archivo({ cabecera: CAB_WEBP, nombre: "fachada.jpg" })),
    { status: 415, codigo: "EXTENSION_ENGANOSA" },
  );
  verificarLanza(
    "un .pdf que por dentro es un ZIP (ni siquiera se reconoce el formato)",
    () => validarArchivo("PLANO", archivo({ cabecera: CAB_ZIP, nombre: "planos.pdf" })),
    { status: 415, codigo: "FORMATO_NO_RECONOCIDO" },
  );
  await verificarRechaza(
    "prepararSubida rechaza el .pdf falsificado (no solo la función suelta)",
    () =>
      prepararSubida(
        entrada({
          archivo: archivo({ cabecera: CAB_ZIP, nombre: "planos.pdf", mime: "application/pdf" }),
        }),
        puertos(),
        "ARQUITECTO",
      ),
    { status: 415, codigo: "FORMATO_NO_RECONOCIDO" },
  );

  console.log("  El Content-Type del cliente tampoco decide");
  verificarLanza(
    "declara application/pdf pero el contenido es PNG",
    () =>
      validarArchivo(
        "PLANO",
        archivo({ cabecera: CAB_PNG, nombre: "render.png", mime: "application/pdf" }),
      ),
    { status: 415, codigo: "MIME_ENGANOSO" },
  );
  {
    const plan = await prepararSubida(
      entrada({
        archivo: archivo({
          cabecera: CAB_PNG,
          nombre: "render.png",
          mime: "application/octet-stream",
        }),
      }),
      puertos(),
      "ARQUITECTO",
    );
    verificar(
      "el mime que se guarda sale del contenido (image/png), no del declarado",
      plan.mime === "image/png" && plan.extension === "png",
    );
  }

  console.log("  Qué formato acepta cada tipo de producto");
  verificarIgual(
    "el registro fotográfico es solo imagen",
    FORMATOS_POR_TIPO.REGISTRO_INICIAL,
    ["png", "jpeg", "webp"],
  );
  verificarIgual("los planos aceptan PDF", FORMATOS_POR_TIPO.PLANO, ["pdf", "png", "jpeg", "webp"]);
  verificarIgual("los renders aceptan PDF", FORMATOS_POR_TIPO.RENDER, ["pdf", "png", "jpeg", "webp"]);
  verificarLanza(
    "un PDF legítimo NO vale como registro fotográfico",
    () => validarArchivo("REGISTRO_INICIAL", archivo({ cabecera: CAB_PDF, nombre: "acta.pdf" })),
    { status: 415, codigo: "FORMATO_NO_PERMITIDO" },
  );
  for (const cab of [CAB_PNG, CAB_JPEG, CAB_WEBP]) {
    const firma = detectarFormato(cab)!;
    verificar(
      `${firma.etiqueta} sí vale como registro fotográfico`,
      validarArchivo(
        "REGISTRO_INICIAL",
        archivo({ cabecera: cab, nombre: `foto.${firma.extensiones[0]}` }),
      ).formato === firma.formato,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n5 — Una sola versión vigente por plano");
  // ──────────────────────────────────────────────────────────────────────────
  const v1 = version({ id: "v1", version: 1, vigente: true });

  verificarIgual(
    "un plano nuevo nace en la versión 1, sin reemplazar nada",
    planificarNuevaVersion({ proyectoId: OBRA, tipo: "PLANO" }, null),
    { version: 1, reemplazaA: null, aDesactivar: [] },
  );
  verificarIgual(
    "subir sobre la vigente da la 2, la enlaza y apaga la anterior (no la borra)",
    planificarNuevaVersion({ proyectoId: OBRA, tipo: "PLANO" }, v1),
    { version: 2, reemplazaA: "v1", aDesactivar: ["v1"] },
  );
  verificarLanza(
    "no se puede reemplazar un producto de OTRA obra",
    () =>
      planificarNuevaVersion(
        { proyectoId: OBRA, tipo: "PLANO" },
        version({ id: "ajeno", proyecto_id: "obra-2", vigente: true }),
      ),
    { status: 400, codigo: "VERSION_INVALIDA" },
  );
  verificarLanza(
    "una versión nueva no puede cambiar el tipo del producto",
    () =>
      planificarNuevaVersion(
        { proyectoId: OBRA, tipo: "RENDER" },
        version({ id: "v1", vigente: true, tipo: "PLANO" }),
      ),
    { status: 400, codigo: "VERSION_INVALIDA" },
  );
  verificarLanza(
    "no se reemplaza una versión que ya fue reemplazada",
    () => planificarNuevaVersion({ proyectoId: OBRA, tipo: "PLANO" }, version({ id: "v1", vigente: false })),
    { status: 400, codigo: "VERSION_INVALIDA" },
  );

  // Cadena de tres versiones: v1 → v2 → v3, con la v3 vigente.
  const cadenaCompleta: ProductoVersionado[] = [
    version({ id: "v1", version: 1, vigente: false, reemplaza_a: null }),
    version({ id: "v2", version: 2, vigente: false, reemplaza_a: "v1" }),
    version({ id: "v3", version: 3, vigente: true, reemplaza_a: "v2" }),
    // Ruido: otro plano de la misma obra, que no debe colarse en la cadena.
    version({ id: "otro", version: 1, vigente: true, reemplaza_a: null }),
  ];

  verificarIgual(
    "la cadena se reconstruye completa desde la última versión",
    cadenaDeVersiones(cadenaCompleta, "v3").map((p) => p.id),
    ["v1", "v2", "v3"],
  );
  verificarIgual(
    "…y también desde la primera",
    cadenaDeVersiones(cadenaCompleta, "v1").map((p) => p.id),
    ["v1", "v2", "v3"],
  );
  verificarIgual(
    "…y desde una intermedia",
    cadenaDeVersiones(cadenaCompleta, "v2").map((p) => p.id),
    ["v1", "v2", "v3"],
  );
  verificar(
    "otro plano de la misma obra no se mete en la cadena",
    cadenaDeVersiones(cadenaCompleta, "otro").length === 1,
  );
  verificar(
    "ninguna versión desaparece: las tres siguen existiendo",
    cadenaDeVersiones(cadenaCompleta, "v3").length === 3,
  );
  verificar(
    "solo una de las tres está vigente",
    cadenaDeVersiones(cadenaCompleta, "v3").filter((p) => p.vigente).length === 1,
  );
  verificar(
    "vigenteDeLaCadena devuelve la v3",
    vigenteDeLaCadena(cadenaDeVersiones(cadenaCompleta, "v3"))?.id === "v3",
  );
  verificarLanza(
    "dos vigentes en la misma cadena es un estado imposible y se detecta",
    () =>
      vigenteDeLaCadena([
        version({ id: "v1", version: 1, vigente: true }),
        version({ id: "v2", version: 2, vigente: true, reemplaza_a: "v1" }),
      ]),
    { status: 500, codigo: "VERSION_INVALIDA" },
  );

  console.log("  Volver a una versión anterior apaga la otra, no la borra");
  verificarIgual(
    "marcar la v1 como vigente apaga la v3",
    planificarCambioDeVigente(cadenaDeVersiones(cadenaCompleta, "v3"), "v1"),
    { vigente: "v1", aDesactivar: ["v3"] },
  );
  verificarIgual(
    "marcar la que ya está vigente no apaga nada",
    planificarCambioDeVigente(cadenaDeVersiones(cadenaCompleta, "v3"), "v3"),
    { vigente: "v3", aDesactivar: [] },
  );
  verificarLanza(
    "una versión que no es de esta cadena no se puede marcar vigente",
    () => planificarCambioDeVigente(cadenaDeVersiones(cadenaCompleta, "v3"), "otro"),
    { status: 404, codigo: "NO_ENCONTRADO" },
  );

  {
    const plan = await prepararSubida(
      entrada({ reemplazaA: "v3" }),
      puertos({
        buscarProducto: async (id) => cadenaCompleta.find((p) => p.id === id) ?? null,
      }),
      "ARQUITECTO",
    );
    verificar(
      "prepararSubida sobre la v3 planifica la v4 y solo apaga la v3",
      plan.version === 4 && plan.reemplazaA === "v3" && plan.aDesactivar.join() === "v3",
    );
  }
  await verificarRechaza(
    "reemplazar algo que no existe (o es de otro tenant) da 404",
    () =>
      prepararSubida(
        entrada({ reemplazaA: "no-existe" }),
        puertos({ buscarProducto: async () => null }),
        "ARQUITECTO",
      ),
    { status: 404, codigo: "NO_ENCONTRADO" },
  );

  console.log("  Nada en el módulo borra una versión anterior");
  {
    const indice = leer("src/lib/productos-tecnicos/index.ts");
    verificar(
      "la API pública no expone ninguna función de borrado de productos",
      !/\b(borrarProducto|eliminarProducto|borrarVersion|eliminarVersion)\b/.test(indice),
    );
    const dominio = [
      "subida.ts",
      "versionado.ts",
      "consultas.ts",
      "puertos-prisma.ts",
    ].map((f) => leer(`src/lib/productos-tecnicos/${f}`)).join("\n");
    verificar(
      "el dominio nunca llama a delete/deleteMany de productos técnicos",
      !/productoTecnico\.delete/.test(dominio),
    );
  }

  console.log("  El puerto del cupo no filtra por vigencia");
  {
    const fuente = leer("src/lib/productos-tecnicos/puertos-prisma.ts");
    const desde = fuente.indexOf("async bytesUsadosEnObra");
    const hasta = fuente.indexOf("async ubicacionPertenece");
    const cuerpo = desde >= 0 && hasta > desde ? fuente.slice(desde, hasta) : "";
    verificar("se pudo aislar el cuerpo de bytesUsadosEnObra", cuerpo.length > 0);
    verificar(
      "bytesUsadosEnObra no menciona `vigente` en su where (contaría de menos)",
      cuerpo.length > 0 && !/vigente/.test(cuerpo),
    );
  }

  console.log(`\n${total - fallos}/${total} verificaciones OK`);
  if (fallos > 0) {
    console.error(`${fallos} verificación(es) fallaron.`);
    process.exit(1);
  }
  console.log("Cimientos de Productos Técnicos verificados sin errores.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
