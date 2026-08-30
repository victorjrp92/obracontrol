/**
 * Verifica las firmas y la inmutabilidad de los documentos firmables
 * (`src/lib/documentos/`): la firma del profesional, el «recibido conforme» del
 * cliente por enlace sin cuenta, y la regla que sostiene a las dos —un documento
 * firmado no se modifica nunca; corregirlo emite una versión nueva—.
 *
 * LO QUE ESTÁ EN JUEGO. Ley 527 de 1999 y Decreto 2364 de 2012: una firma
 * electrónica simple vale si se puede probar QUIÉN firmó, CUÁNDO, y que el
 * documento NO CAMBIÓ. Lo tercero lo cubre la huella SHA-256, y la huella solo
 * significa algo si el documento al que apunta es inmutable de verdad. Si una
 * fila firmada se pudiera reescribir —aunque fuera para arreglar una coma— la
 * huella dejaría de decir «esto es lo que se firmó» para decir «esto es lo que
 * dice hoy», que no prueba nada. De ahí que la mitad de este script no compruebe
 * comportamiento sino ESTRUCTURA: que no exista en el código una forma de
 * modificar un documento firmado.
 *
 * No toca la base de datos. Las reglas están escritas contra puertos y aquí se
 * les inyecta un almacén en memoria que reproduce las mismas condiciones de
 * escritura que Postgres —incluidas las carreras entre dos pestañas—.
 *
 * No hay test runner en el proyecto: este script es la suite, en asserts planos.
 *
 * Uso: `npx tsx scripts/verificar-firmas.ts`. Sale con código 1 si algo falla.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

import {
  asegurarBorrador,
  asegurarEnAlcance,
  asegurarModificable,
  cotejarHuella,
  dejarConstanciaDeRecibido,
  documentoParaCliente,
  documentosDelCliente,
  emitirCorreccion,
  emitirDocumento,
  esDocumentoError,
  estaFirmado,
  estaRecibido,
  extensionDeImagen,
  firmarDocumento,
  hallazgoDeFila,
  hashContenido,
  hashCorto,
  normalizarMatricula,
  normalizarReceptor,
  planificarCorreccion,
  planificarEmision,
  planificarFirma,
  planificarRecibido,
  prefijoDeFolio,
  resolverVerificacion,
  rutaImagenFirma,
  vistaCliente,
  CAMPOS_ESCRIBIBLES_UNA_VEZ,
  CAMPOS_INMUTABLES,
  COPY_FIRMA,
  COPY_RECIBIDO,
  ETIQUETA_TIPO,
  PATRON_FOLIO,
  PREFIJO_POR_TIPO,
  RECEPTOR_LARGO_MAX,
  RECEPTOR_LARGO_MIN,
  TERMINO_CONCEPTO,
  TERMINOS_PROHIBIDOS,
  fechaEnColombia,
  tieneTerminoProhibido,
  type AlmacenDocumentos,
  type DatosFirma,
  type DatosRecibido,
  type DocumentoGuardado,
  type DocumentoNuevo,
  type Firmante,
  type PerfilFirma,
} from "@/lib/documentos";
import { generarTokenAcceso, tokenTieneFormaValida } from "@/lib/tokens";
import { permitirPeticionDeToken } from "@/lib/rate-limit";

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
    iguales
  );
}

/** Comprueba que algo falla, y que falla por la razón correcta. */
async function verificarFalla(descripcion: string, codigo: string, fn: () => unknown | Promise<unknown>) {
  total++;
  try {
    await fn();
    fallos++;
    console.error(`  FAIL ${descripcion} (no lanzó)`);
  } catch (err) {
    if (esDocumentoError(err) && err.codigo === codigo) {
      console.log(`  OK   ${descripcion}`);
    } else {
      fallos++;
      const visto = esDocumentoError(err) ? err.codigo : String(err);
      console.error(`  FAIL ${descripcion} → esperado ${codigo}, obtuvo ${visto}`);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Almacén en memoria: el puerto, con las MISMAS condiciones que la consulta SQL
// ════════════════════════════════════════════════════════════════════════════

/**
 * Reproduce lo que hace `almacen-prisma.ts`, incluida la parte que importa: las
 * dos transiciones son compare-and-set y devuelven cuántas filas cambiaron. Un
 * `0` significa que otro llegó antes.
 *
 * Devuelve copias en cada lectura, como haría la base: así, si alguna regla
 * mutara el objeto que recibe, la fila guardada no se enteraría — y el fallo
 * saldría aquí en vez de en producción.
 */
function almacenEnMemoria(): AlmacenDocumentos & { filas: Map<string, DocumentoGuardado> } {
  const filas = new Map<string, DocumentoGuardado>();
  let secuencia = 0;

  const copia = (d: DocumentoGuardado): DocumentoGuardado => ({ ...d });

  return {
    filas,
    async porId(id) {
      const f = filas.get(id);
      return f ? copia(f) : null;
    },
    async porFolio(folio) {
      const f = [...filas.values()].find((d) => d.folio === folio);
      return f ? copia(f) : null;
    },
    async fueReemplazado(id) {
      return [...filas.values()].some((d) => d.reemplaza_a === id);
    },
    async reemplazados(ids) {
      const señalados = new Set([...filas.values()].map((d) => d.reemplaza_a).filter(Boolean));
      return new Set(ids.filter((id) => señalados.has(id)));
    },
    async firmadosDelProyecto(proyectoId) {
      return [...filas.values()]
        .filter((d) => d.proyecto_id === proyectoId && d.firmado_el !== null)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .map(copia);
    },
    async crear(nuevo: DocumentoNuevo) {
      const id = `doc-${++secuencia}`;
      const fila: DocumentoGuardado = {
        id,
        folio: nuevo.folio,
        hash: nuevo.hash,
        tipo: nuevo.tipo,
        proyecto_id: nuevo.proyecto_id,
        constructora_id: nuevo.constructora_id,
        firmado_por_id: null,
        firmado_el: null,
        matricula: null,
        recibido_por: null,
        recibido_el: null,
        version: nuevo.version,
        reemplaza_a: nuevo.reemplaza_a,
        created_at: new Date(2026, 7, 30, 10, 0, 0, secuencia),
      };
      filas.set(id, fila);
      return copia(fila);
    },
    async firmarSiSigueSinFirmar(id, datos: DatosFirma) {
      const fila = filas.get(id);
      if (!fila || fila.firmado_el !== null) return 0;
      fila.firmado_por_id = datos.firmado_por_id;
      fila.firmado_el = datos.firmado_el;
      fila.matricula = datos.matricula;
      return 1;
    },
    async recibirSiFirmadoYSinRecibir(id, datos: DatosRecibido) {
      const fila = filas.get(id);
      if (!fila || fila.firmado_el === null || fila.recibido_el !== null) return 0;
      fila.recibido_por = datos.recibido_por;
      fila.recibido_el = datos.recibido_el;
      return 1;
    },
  };
}

const PERFIL_COMPLETO: PerfilFirma = {
  imagenPath: rutaImagenFirma("usuario-arquitecto", "png"),
  matricula: "CO-25202-198765",
};
const FIRMANTE: Firmante = { usuarioId: "usuario-arquitecto", perfil: PERFIL_COMPLETO };

const OBRA_A = "proyecto-a";
const OBRA_B = "proyecto-b";
const TENANT_A = "constructora-a";
const TENANT_B = "constructora-b";

const CONTENIDO = JSON.stringify({
  inmueble: { ciudad: "Cali", anio: 1996 },
  hallazgos: [{ elemento: "muro_carga", ancho_mm: 2 }],
});

function datosDe(proyectoId: string, constructoraId: string, contenido = CONTENIDO) {
  return {
    tipo: "INFORME_TECNICO" as const,
    contenido,
    proyectoId,
    constructoraId,
  };
}

// ── Lectura de código fuente, para las comprobaciones estructurales ─────────

const RAIZ = path.resolve(__dirname, "..");

function leer(rutaRelativa: string): string {
  return readFileSync(path.join(RAIZ, rutaRelativa), "utf8");
}

/** Quita comentarios: importa lo que el código HACE, no lo que dice que hace. */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Todos los `.ts`/`.tsx` bajo un directorio, en rutas relativas a la raíz. */
function archivosBajo(relativo: string): string[] {
  const absoluto = path.join(RAIZ, relativo);
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      const completo = path.join(dir, entrada);
      if (statSync(completo).isDirectory()) recorrer(completo);
      else if (/\.tsx?$/.test(entrada)) salida.push(path.relative(RAIZ, completo));
    }
  };
  recorrer(absoluto);
  return salida;
}

/** El bloque `{ … }` que abre en `desde`, con las llaves emparejadas. */
function bloqueDesde(fuente: string, desde: number): string {
  const inicio = fuente.indexOf("{", desde);
  if (inicio === -1) return "";
  let nivel = 0;
  for (let i = inicio; i < fuente.length; i++) {
    if (fuente[i] === "{") nivel++;
    else if (fuente[i] === "}") {
      nivel--;
      if (nivel === 0) return fuente.slice(inicio, i + 1);
    }
  }
  return "";
}


// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

async function bloqueInmutabilidad() {
  const almacen = almacenEnMemoria();
  const doc = await emitirDocumento(datosDe(OBRA_A, TENANT_A), almacen);

  // El plan de emisión, antes de tocar nada: prefijo por tipo y huella del
  // contenido + folio. Es lo que fija qué dice el pie del PDF.
  const plan = planificarEmision(datosDe(OBRA_A, TENANT_A));
  verificar("el folio de un concepto técnico empieza por CT", plan.folio.startsWith("CT-"));
  verificar(
    "el folio de un acta de estado inicial empieza por AE",
    planificarEmision({ ...datosDe(OBRA_A, TENANT_A), tipo: "ACTA_ESTADO_INICIAL" }).folio.startsWith("AE-")
  );
  verificar(
    "dos emisiones del MISMO contenido no comparten folio ni huella",
    plan.folio !== planificarEmision(datosDe(OBRA_A, TENANT_A)).folio
  );

  verificarIgual("un documento nace en la versión 1 y sin reemplazar a nadie", [doc.version, doc.reemplaza_a], [1, null]);
  verificar("un documento nace SIN firmar", !estaFirmado(doc) && !estaRecibido(doc));
  verificar("el folio recién emitido cumple el patrón impreso en el pie", PATRON_FOLIO.test(doc.folio));
  verificarIgual("la huella es la del contenido + el folio", doc.hash, hashContenido(CONTENIDO, doc.folio));

  total++;
  try {
    asegurarModificable(doc);
    console.log("  OK   un borrador sin firmar sí se puede modificar");
  } catch {
    fallos++;
    console.error("  FAIL un borrador sin firmar sí se puede modificar");
  }
  await asegurarBorrador(doc.id, almacen);

  const firmado = await firmarDocumento(doc.id, FIRMANTE, almacen);
  verificar("al firmar se estampa quién firmó: la sesión ES la identidad", firmado.firmado_por_id === FIRMANTE.usuarioId);
  verificar("al firmar se estampa cuándo", firmado.firmado_el instanceof Date);
  verificarIgual("al firmar se congela la matrícula del perfil", firmado.matricula, PERFIL_COMPLETO.matricula);
  verificarIgual("firmar NO toca el folio ni la huella", [firmado.folio, firmado.hash], [doc.folio, doc.hash]);

  await verificarFalla("asegurarModificable lanza sobre un documento firmado", "DOCUMENTO_INMUTABLE", () =>
    asegurarModificable(firmado)
  );
  await verificarFalla("asegurarBorrador lanza sobre un documento firmado", "DOCUMENTO_INMUTABLE", () =>
    asegurarBorrador(doc.id, almacen)
  );
  await verificarFalla("firmar dos veces no produce una segunda firma", "YA_FIRMADO", () =>
    firmarDocumento(doc.id, { usuarioId: "otro-usuario", perfil: PERFIL_COMPLETO }, almacen)
  );

  const trasElIntento = await almacen.porId(doc.id);
  verificarIgual(
    "el intento de segunda firma no cambió NADA de la fila",
    [trasElIntento?.firmado_por_id, trasElIntento?.firmado_el?.getTime(), trasElIntento?.matricula],
    [firmado.firmado_por_id, firmado.firmado_el?.getTime(), firmado.matricula]
  );

  // La carrera de verdad: dos pestañas firmando a la vez. La condición vive en
  // el `where` de la escritura, así que la resuelve el almacén y no el proceso.
  const almacenCarrera = almacenEnMemoria();
  const enDisputa = await emitirDocumento(datosDe(OBRA_A, TENANT_A), almacenCarrera);
  const carrera = await Promise.allSettled([
    firmarDocumento(enDisputa.id, FIRMANTE, almacenCarrera),
    firmarDocumento(enDisputa.id, { usuarioId: "otro-usuario", perfil: PERFIL_COMPLETO }, almacenCarrera),
  ]);
  verificar(
    "dos firmas simultáneas: exactamente una gana, la otra falla",
    carrera.filter((r) => r.status === "fulfilled").length === 1
  );
  const ganador = await almacenCarrera.porId(enDisputa.id);
  verificar("tras la carrera hay UNA firma, no dos mezcladas", ganador?.firmado_el !== null && ganador?.firmado_por_id !== null);

  // Corregir: la única forma de cambiar lo que dice un documento firmado.
  const antesDeCorregir = JSON.stringify(await almacen.porId(doc.id));
  const correccion = await emitirCorreccion(doc.id, { contenido: `${CONTENIDO} corregido` }, almacen);
  const despuesDeCorregir = JSON.stringify(await almacen.porId(doc.id));

  verificar("corregir emite un documento NUEVO, con folio nuevo", correccion.folio !== doc.folio);
  verificar("el folio nuevo también cumple el patrón", PATRON_FOLIO.test(correccion.folio));
  verificarIgual("la corrección es la versión 2 y señala a la anterior", [correccion.version, correccion.reemplaza_a], [2, doc.id]);
  verificar("la corrección nace sin firmar: hay que volver a firmarla", !estaFirmado(correccion));
  verificarIgual("corregir NO cambió ni un byte de la fila anterior", despuesDeCorregir, antesDeCorregir);
  verificar("la anterior conserva su folio y su huella", doc.folio === (await almacen.porId(doc.id))?.folio);
  verificarIgual(
    "la corrección conserva la familia del folio anterior",
    prefijoDeFolio(correccion.folio),
    prefijoDeFolio(doc.folio)
  );
  verificarIgual("la corrección hereda la obra y el tenant", [correccion.proyecto_id, correccion.constructora_id], [OBRA_A, TENANT_A]);
}

// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

async function bloqueVersiones() {
  const almacen = almacenEnMemoria();
  const v1 = await emitirDocumento(datosDe(OBRA_A, TENANT_A), almacen);
  await firmarDocumento(v1.id, FIRMANTE, almacen);
  const v2 = await emitirCorreccion(v1.id, { contenido: "contenido corregido" }, almacen);

  verificar("la anterior queda marcada como reemplazada", await almacen.fueReemplazado(v1.id));
  verificar("la nueva todavía no está reemplazada por nadie", !(await almacen.fueReemplazado(v2.id)));

  // La marca no es una columna que alguien deba acordarse de poner: es el
  // `reemplaza_a` de la versión nueva leído al revés. Un estado derivado no se
  // puede desincronizar del hecho que lo produce.
  verificarIgual("la marca de reemplazo SALE del reemplaza_a de la nueva", v2.reemplaza_a, v1.id);

  const firmada = (await almacen.porId(v1.id)) as DocumentoGuardado;
  const verificacionV1 = resolverVerificacion(
    [
      hallazgoDeFila({
        tipo: firmada.tipo,
        hash: firmada.hash,
        created_at: firmada.created_at,
        firmado_el: firmada.firmado_el,
        matricula: firmada.matricula,
        recibido_el: firmada.recibido_el,
        version: firmada.version,
        reemplazado: await almacen.fueReemplazado(v1.id),
      }),
    ],
    hashCorto(firmada.hash)
  );

  verificar("la versión reemplazada SIGUE existiendo para quien la verifica", "existe" in verificacionV1 && verificacionV1.existe === true);
  verificar(
    "y su huella sigue cotejando: el papel viejo se comprueba igual que el primer día",
    "existe" in verificacionV1 && verificacionV1.existe === true && verificacionV1.huellaCoincide === true
  );
  verificarIgual(
    "la verificación avisa de que hay una versión posterior",
    "existe" in verificacionV1 && verificacionV1.existe === true ? verificacionV1.vigencia : null,
    { version: 1, reemplazado: true }
  );

  await verificarFalla("corregir dos veces la misma versión partiría la cadena: se impide", "VERSION_YA_REEMPLAZADA", () =>
    emitirCorreccion(v1.id, { contenido: "otra corrección" }, almacen)
  );

  const v3 = await emitirCorreccion(v2.id, { contenido: "tercera versión" }, almacen);
  verificarIgual("corregir la versión vigente sí se puede: sale la 3", [v3.version, v3.reemplaza_a], [3, v2.id]);
  verificar("después de dos correcciones, la v1 sigue intacta", (await almacen.porId(v1.id))?.hash === v1.hash);
  verificar("y la v2 queda a su vez reemplazada", await almacen.fueReemplazado(v2.id));

  await verificarFalla("un folio de familia desconocida no puede corregirse a ciegas", "FOLIO_DESCONOCIDO", () =>
    planificarCorreccion({ ...v1, folio: "ZZ-20260830-abc123" }, { contenido: "x", yaReemplazado: false })
  );

  // Un documento en su primera versión y sin reemplazar no arrastra la clave.
  const sinCadena = resolverVerificacion(
    [hallazgoDeFila({ tipo: "INFORME_TECNICO", hash: v3.hash, created_at: v3.created_at, firmado_el: null, matricula: null, recibido_el: null, version: 1, reemplazado: false })],
    null
  );
  verificarIgual(
    "un documento sin firmas y sin cadena responde EXACTAMENTE lo de siempre",
    Object.keys(sinCadena),
    ["existe", "tipo", "emitido", "huellaCoincide"]
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

async function bloqueHuella() {
  const folio = "CT-20260830-a3f9c1";
  const base = hashContenido(CONTENIDO, folio);

  verificar(
    "un byte distinto en el contenido da otra huella",
    base !== hashContenido(`${CONTENIDO} `, folio)
  );
  verificar(
    "un byte cambiado EN MEDIO de un contenido largo también la cambia",
    hashContenido('{"ciudad":"Cali"}', folio) !== hashContenido('{"ciudad":"Cali"}'.replace("Cali", "Calo"), folio)
  );
  verificar(
    "cambiar un dígito del folio también cambia la huella (el folio entra en el hash)",
    base !== hashContenido(CONTENIDO, "CT-20260830-a3f9c2")
  );
  verificar(
    "la huella CORTA impresa en el pie también cambia con un byte distinto",
    hashCorto(base) !== hashCorto(hashContenido(`${CONTENIDO} `, folio))
  );

  const almacen = almacenEnMemoria();
  const doc = await emitirDocumento(datosDe(OBRA_A, TENANT_A), almacen);
  await firmarDocumento(doc.id, FIRMANTE, almacen);
  const corregido = await emitirCorreccion(doc.id, { contenido: CONTENIDO }, almacen);
  verificar(
    "una corrección con el MISMO contenido tiene otra huella, porque tiene otro folio",
    corregido.hash !== doc.hash
  );

  const firmada = (await almacen.porId(doc.id)) as DocumentoGuardado;
  const hallazgo = hallazgoDeFila({
    tipo: firmada.tipo,
    hash: firmada.hash,
    created_at: firmada.created_at,
    firmado_el: firmada.firmado_el,
    matricula: firmada.matricula,
    recibido_el: firmada.recibido_el,
    version: firmada.version,
    reemplazado: true,
  });

  const conHuellaBuena = resolverVerificacion([hallazgo], hashCorto(firmada.hash));
  const conHuellaMala = resolverVerificacion([hallazgo], hashCorto(hashContenido("contenido alterado", firmada.folio)));
  const sinHuella = resolverVerificacion([hallazgo], null);

  verificar(
    "verificando con la huella impresa: el contenido NO cambió",
    "existe" in conHuellaBuena && conHuellaBuena.existe === true && conHuellaBuena.huellaCoincide === true
  );
  verificar(
    "verificando con otra huella: se dice que no cuadra, no se calla",
    "existe" in conHuellaMala && conHuellaMala.existe === true && conHuellaMala.huellaCoincide === false
  );
  verificar(
    "sin huella: «no la mandó» no es lo mismo que «no coincide»",
    "existe" in sinHuella && sinHuella.existe === true && sinHuella.huellaCoincide === null
  );
  verificarIgual("cotejarHuella acepta la corta impresa", cotejarHuella(firmada.hash, hashCorto(firmada.hash)), true);
  verificarIgual("cotejarHuella rechaza un prefijo demasiado corto", cotejarHuella(firmada.hash, firmada.hash.slice(0, 7)), false);
}

// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

async function bloqueFirma() {
  const almacen = almacenEnMemoria();
  const doc = await emitirDocumento(datosDe(OBRA_A, TENANT_A), almacen);

  await verificarFalla("sin imagen de firma en el perfil no se puede firmar", "SIN_IMAGEN_DE_FIRMA", () =>
    firmarDocumento(doc.id, { usuarioId: "u1", perfil: { imagenPath: null, matricula: "123-45" } }, almacen)
  );
  await verificarFalla("sin matrícula en el perfil no se puede firmar", "SIN_MATRICULA", () =>
    firmarDocumento(doc.id, { usuarioId: "u1", perfil: { imagenPath: "firmas/u1/firma.png", matricula: null } }, almacen)
  );
  await verificarFalla("una matrícula demasiado corta no vale como matrícula", "SIN_MATRICULA", () =>
    planificarFirma({ firmado_el: null }, { usuarioId: "u1", perfil: { imagenPath: "firmas/u1/firma.png", matricula: "ab" } })
  );
  verificar("tras los intentos fallidos el documento sigue SIN firmar", !estaFirmado((await almacen.porId(doc.id)) as DocumentoGuardado));

  const antes = new Date();
  const firmado = await firmarDocumento(doc.id, FIRMANTE, almacen);
  const despues = new Date();

  verificarIgual("quién: el id de la sesión, no un texto que alguien escriba", firmado.firmado_por_id, FIRMANTE.usuarioId);
  verificar(
    "cuándo: el reloj del servidor, entre el antes y el después de la llamada",
    firmado.firmado_el !== null && firmado.firmado_el >= antes && firmado.firmado_el <= despues
  );
  verificarIgual("matrícula: la que tenía el perfil al firmar", firmado.matricula, PERFIL_COMPLETO.matricula);

  // Lo que de verdad hay que probar: el perfil cambia y el documento no.
  const perfilNuevo: PerfilFirma = { imagenPath: PERFIL_COMPLETO.imagenPath, matricula: "CO-99999-000001" };
  await verificarFalla("volver a firmar con la matrícula nueva no procede", "YA_FIRMADO", () =>
    firmarDocumento(doc.id, { usuarioId: FIRMANTE.usuarioId, perfil: perfilNuevo }, almacen)
  );
  verificarIgual(
    "la matrícula del documento ya emitido NO cambia cuando el profesional actualiza la suya",
    (await almacen.porId(doc.id))?.matricula,
    PERFIL_COMPLETO.matricula
  );

  const siguiente = await emitirDocumento(datosDe(OBRA_A, TENANT_A), almacen);
  const conNueva = await firmarDocumento(siguiente.id, { usuarioId: FIRMANTE.usuarioId, perfil: perfilNuevo }, almacen);
  verificarIgual("los documentos que se firmen de ahora en adelante llevan la nueva", conNueva.matricula, perfilNuevo.matricula);
  verificarIgual("y el anterior sigue con la vieja", (await almacen.porId(doc.id))?.matricula, PERFIL_COMPLETO.matricula);

  verificarIgual("normalizarMatricula recorta espacios sobrantes", normalizarMatricula("  CO 25202   198765 "), "CO 25202 198765");
  verificarIgual("normalizarMatricula rechaza lo vacío", normalizarMatricula("   "), null);
  verificarIgual("normalizarMatricula rechaza lo absurdamente largo", normalizarMatricula("x".repeat(41)), null);
  verificarIgual("la imagen de firma se acepta por extensión o por tipo", extensionDeImagen("firma.PNG", "application/octet-stream"), "png");
  verificarIgual("un PDF no es una imagen de firma", extensionDeImagen("firma.pdf", "application/pdf"), null);
  verificarIgual("la ruta de la firma cuelga del id del profesional", rutaImagenFirma("abc12345", "png"), "firmas/abc12345/firma.png");
  await verificarFalla("un id con salto de directorio no construye ninguna ruta", "FUERA_DE_ALCANCE", () =>
    rutaImagenFirma("../../otro", "png")
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

async function bloqueRecibido() {
  const almacen = almacenEnMemoria();
  const doc = await emitirDocumento(datosDe(OBRA_A, TENANT_A), almacen);

  await verificarFalla("no se puede recibir un documento que nadie ha firmado", "NO_FIRMADO", () =>
    dejarConstanciaDeRecibido(doc.folio, OBRA_A, "Quien Recibe", almacen)
  );

  await firmarDocumento(doc.id, FIRMANTE, almacen);

  await verificarFalla("hay que decir quién recibe", "RECEPTOR_INVALIDO", () =>
    dejarConstanciaDeRecibido(doc.folio, OBRA_A, "  ", almacen)
  );
  await verificarFalla("dos letras no identifican a nadie", "RECEPTOR_INVALIDO", () =>
    dejarConstanciaDeRecibido(doc.folio, OBRA_A, "ab", almacen)
  );

  const vista = await dejarConstanciaDeRecibido(doc.folio, OBRA_A, "  Quien   Recibe  ", almacen);
  verificarIgual("quien recibe queda registrado, sin espacios de sobra", vista.recibidoPor, "Quien Recibe");
  verificar("y queda la fecha de la entrega", vista.recibidoEl !== null && vista.recibidoMomento !== null);

  const fila = (await almacen.porId(doc.id)) as DocumentoGuardado;
  const primeraFecha = fila.recibido_el?.getTime();

  await verificarFalla("la constancia no se pisa: solo la primera vale", "YA_RECIBIDO", () =>
    dejarConstanciaDeRecibido(doc.folio, OBRA_A, "Otra Persona", almacen)
  );
  verificarIgual("el segundo intento no cambió la fecha ni quién recibió", [(await almacen.porId(doc.id))?.recibido_el?.getTime(), (await almacen.porId(doc.id))?.recibido_por], [primeraFecha, "Quien Recibe"]);

  // Carrera: dos confirmaciones a la vez.
  const almacenCarrera = almacenEnMemoria();
  const otro = await emitirDocumento(datosDe(OBRA_A, TENANT_A), almacenCarrera);
  await firmarDocumento(otro.id, FIRMANTE, almacenCarrera);
  const carrera = await Promise.allSettled([
    dejarConstanciaDeRecibido(otro.folio, OBRA_A, "Persona Una", almacenCarrera),
    dejarConstanciaDeRecibido(otro.folio, OBRA_A, "Persona Dos", almacenCarrera),
  ]);
  verificar("dos constancias simultáneas: solo una queda", carrera.filter((r) => r.status === "fulfilled").length === 1);

  verificarIgual("el receptor se recorta al máximo, no se rechaza", normalizarReceptor("x".repeat(200))?.length, RECEPTOR_LARGO_MAX);
  verificarIgual(`por debajo de ${RECEPTOR_LARGO_MIN} caracteres no vale`, normalizarReceptor("ab"), null);
  await verificarFalla("planificarRecibido exige que esté firmado", "NO_FIRMADO", () =>
    planificarRecibido({ firmado_el: null, recibido_el: null }, "Quien Recibe")
  );

  // Recibir NO altera el contenido ni la firma: es una constancia, no una edición.
  verificarIgual(
    "dejar constancia no toca folio, huella, firma ni versión",
    [fila.folio, fila.hash, fila.firmado_por_id, fila.version],
    [doc.folio, doc.hash, FIRMANTE.usuarioId, 1]
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

async function bloqueAislamiento() {
  const almacen = almacenEnMemoria();

  const deA = await emitirDocumento(datosDe(OBRA_A, TENANT_A), almacen);
  await firmarDocumento(deA.id, FIRMANTE, almacen);
  const deB = await emitirDocumento(datosDe(OBRA_B, TENANT_B, "contenido de otra obra"), almacen);
  await firmarDocumento(deB.id, FIRMANTE, almacen);
  const borradorA = await emitirDocumento(datosDe(OBRA_A, TENANT_A, "borrador sin firmar"), almacen);
  const sinObra = await emitirDocumento({ tipo: "INFORME_TECNICO", contenido: "sin obra" }, almacen);

  await verificarFalla("un folio de otra obra no se resuelve por este enlace", "FUERA_DE_ALCANCE", () =>
    documentoParaCliente(deB.folio, OBRA_A, almacen)
  );
  await verificarFalla("y tampoco al revés", "FUERA_DE_ALCANCE", () =>
    documentoParaCliente(deA.folio, OBRA_B, almacen)
  );
  await verificarFalla("un documento sin obra no pertenece a ningún enlace", "FUERA_DE_ALCANCE", () =>
    documentoParaCliente(sinObra.folio, OBRA_A, almacen)
  );
  await verificarFalla("un folio que no existe falla igual", "FUERA_DE_ALCANCE", () =>
    documentoParaCliente("CT-20260830-000000", OBRA_A, almacen)
  );

  // El mensaje tiene que ser el MISMO: si «no existe» y «no es tuyo» se
  // distinguieran, el enlace serviría para averiguar qué folios existen.
  const mensajes = await Promise.all(
    [deB.folio, "CT-20260830-000000"].map(async (folio) => {
      try {
        await documentoParaCliente(folio, OBRA_A, almacen);
        return "no falló";
      } catch (err) {
        return esDocumentoError(err) ? `${err.codigo}|${err.message}` : "otro error";
      }
    })
  );
  verificarIgual("«no existe» y «no es tuyo» responden exactamente lo mismo", mensajes[0], mensajes[1]);

  await verificarFalla("tampoco se puede dejar constancia sobre un documento ajeno", "FUERA_DE_ALCANCE", () =>
    dejarConstanciaDeRecibido(deB.folio, OBRA_A, "Quien Recibe", almacen)
  );
  verificar("y el documento ajeno sigue sin constancia", (await almacen.porId(deB.id))?.recibido_el === null);

  const lista = await documentosDelCliente(OBRA_A, almacen);
  verificarIgual("la lista del enlace trae solo los documentos firmados de SU obra", lista.map((d) => d.folio), [deA.folio]);
  verificar("no aparece ningún documento de la otra obra", !lista.some((d) => d.folio === deB.folio));
  verificar("no aparecen los borradores sin firmar", !lista.some((d) => d.folio === borradorA.folio));

  const vista = vistaCliente((await almacen.porId(deA.id)) as DocumentoGuardado, false);
  verificarIgual(
    "la vista del cliente tiene exactamente los campos declarados, ni uno más",
    Object.keys(vista).sort(),
    [
      "emitido",
      "etiqueta",
      "firmadoEl",
      "firmadoMomento",
      "folio",
      "huellaCorta",
      "matricula",
      "recibidoEl",
      "recibidoMomento",
      "recibidoPor",
      "reemplazado",
      "tipo",
      "version",
    ]
  );

  const serializada = JSON.stringify(vista);
  for (const [que, valor] of [
    ["el id interno", deA.id],
    ["el id de la obra", OBRA_A],
    ["el id del tenant", TENANT_A],
    ["el id de quien firmó", FIRMANTE.usuarioId],
    ["la huella completa", deA.hash],
  ] as const) {
    verificar(`la vista del cliente no expone ${que}`, !serializada.includes(valor));
  }
  verificar("sí expone la huella CORTA, que es la que trae impresa el PDF", serializada.includes(hashCorto(deA.hash)));

  verificar("asegurarEnAlcance deja pasar el documento de la propia obra", asegurarEnAlcance(deA, OBRA_A).folio === deA.folio);
}

// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

function bloqueToken() {
  const MUESTRA = 5000;
  const tokens = Array.from({ length: MUESTRA }, () => generarTokenAcceso());

  verificar("todos los tokens miden 32 caracteres (24 bytes = 192 bits)", tokens.every((t) => t.length === 32));
  verificar("todos son urlsafe: viajan limpios en una URL y en un mensaje", tokens.every((t) => /^[A-Za-z0-9_-]{32}$/.test(t)));
  verificar(`${MUESTRA} tokens seguidos y ninguno repetido`, new Set(tokens).size === MUESTRA);
  verificar(
    "ningún token tiene forma de cuid (que lleva marca de tiempo y contador: no es un secreto)",
    !tokens.some((t) => /^c[a-z0-9]{24}$/.test(t))
  );
  verificar(
    "dos tokens seguidos no comparten prefijo: no hay parte predecible por orden de creación",
    tokens[0].slice(0, 8) !== tokens[1].slice(0, 8)
  );

  // Si hubiera una parte fija, la posición correspondiente tendría siempre el
  // mismo carácter. Con 5000 muestras, un solo valor en una posición sería
  // señal de que ahí no hay azar.
  const posicionesFijas = Array.from({ length: 32 }, (_, i) => new Set(tokens.map((t) => t[i])).size).filter((n) => n < 8);
  verificarIgual("ninguna posición del token es fija o casi fija", posicionesFijas.length, 0);

  verificar("un token bien formado pasa el filtro previo", tokenTieneFormaValida(tokens[0]));
  for (const basura of ["", "corto", "../../etc/passwd", "a".repeat(65), "con espacio aqui", "punto.y.coma;"]) {
    verificar(`la basura se descarta antes de tocar la base: ${JSON.stringify(basura)}`, !tokenTieneFormaValida(basura));
  }

  // Freno de fuerza bruta. Es un tope de PETICIONES por IP, no de fallos: la
  // versión anterior contaba fallos y dejaba fuera obras enteras detrás de una
  // IP compartida por CGNAT, sin proteger de nada que los 192 bits no
  // protegieran ya.
  const clave = `prueba-freno-${Date.now()}`;
  let admitidas = 0;
  for (let i = 0; i < 200; i++) if (permitirPeticionDeToken(clave)) admitidas++;
  verificarIgual("el freno corta el martilleo de una misma IP a las 120 por minuto", admitidas, 120);
  verificar("una vez alcanzado el tope, la siguiente petición se rechaza", !permitirPeticionDeToken(clave));
  verificar("y el freno es por IP: otra sigue entrando", permitirPeticionDeToken(`otra-${Date.now()}`));
  verificar("fuera de una petición (un script) el freno no aplica", permitirPeticionDeToken(null));

  // Y que el mecanismo sea EL QUE YA HABÍA, no uno nuevo.
  const dataCliente = sinComentarios(leer("src/lib/data-cliente.ts"));
  verificar("el token del cliente se genera con el generador compartido", /generarTokenAcceso\(\)/.test(dataCliente));
  verificar("el validador del cliente descarta la forma inválida antes de consultar", /tokenTieneFormaValida\(/.test(dataCliente));
  verificar("y aplica el freno de peticiones", /permitirPeticionDeToken\(/.test(dataCliente));

  const rutaRecibido = sinComentarios(leer("src/app/api/documentos/c/[token]/[folio]/recibido/route.ts"));
  verificar(
    "la ruta del «recibido conforme» entra por el validador de siempre, no por uno propio",
    /validarClienteToken\(/.test(rutaRecibido)
  );
  verificar(
    "la ruta no consulta la base por su cuenta saltándose el validador",
    !/prisma\./.test(rutaRecibido)
  );
  verificar(
    "el proyecto sale del token, nunca de la URL ni del cuerpo",
    /valido\.proyectoId/.test(rutaRecibido) && !/proyectoId\s*=\s*(cuerpo|searchParams|params)/.test(rutaRecibido)
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

function bloqueEstructura() {
  const puerto = sinComentarios(leer("src/lib/documentos/almacen.ts"));
  for (const prohibida of ["actualizar", "borrar", "eliminar", "upsert", "reemplazarContenido"]) {
    verificar(`el puerto no declara ninguna operación «${prohibida}»`, !puerto.includes(prohibida));
  }

  const adaptador = sinComentarios(leer("src/lib/documentos/almacen-prisma.ts"));
  const metodos = [...adaptador.matchAll(/prisma\.documentoFirmable\.(\w+)/g)].map((m) => m[1]);
  verificarIgual(
    "el adaptador solo usa lecturas, un create y las dos transiciones condicionadas",
    [...new Set(metodos)].sort(),
    ["count", "create", "findMany", "findUnique", "updateMany"]
  );
  verificar("no hay ni un delete", !/documentoFirmable\.delete/.test(adaptador));
  verificar("ni un update sin condición (`update` a secas escribe pase lo que pase)", !/documentoFirmable\.update\(/.test(adaptador));

  // ── Las dos listas se FIJAN aquí, no se heredan del módulo ───────────────
  // `CAMPOS_INMUTABLES` y `CAMPOS_ESCRIBIBLES_UNA_VEZ` se importan del módulo
  // que este script audita y no se comprobaba su CONTENIDO en ninguna parte.
  // Eso hacía que la compuerta se pudiera desarmar sin tocar una sola línea de
  // lógica: quitando «folio» de la lista de inmutables el script seguía en
  // verde (medido), y añadiendo un campo a la de escribibles se habría podido
  // escribir cualquier cosa en una transición sin que nadie protestara.
  // La lista de la verdad tiene que vivir en el ORÁCULO, no en el examinado.
  verificarIgual(
    "la lista de campos inmutables es exactamente la esperada",
    [...CAMPOS_INMUTABLES].sort(),
    ["constructora_id", "created_at", "folio", "hash", "proyecto_id", "reemplaza_a", "tipo", "version"]
  );
  verificarIgual(
    "y la de campos escribibles una sola vez, también",
    [...CAMPOS_ESCRIBIBLES_UNA_VEZ].sort(),
    ["firmado_el", "firmado_por_id", "matricula", "recibido_el", "recibido_por"]
  );
  verificar(
    "las dos listas son disjuntas: ningún campo es a la vez inmutable y escribible",
    !CAMPOS_INMUTABLES.some((c) => CAMPOS_ESCRIBIBLES_UNA_VEZ.includes(c as never))
  );

  // Control positivo del detector de escrituras prohibidas: un `data` que
  // escribe el folio TIENE que salir marcado por las dos reglas de abajo. Sin
  // esto, «0 campos inmutables tocados» podría significar «el detector no
  // encuentra nada nunca».
  {
    const DATA_ILEGAL = "data: { folio: nuevoFolio, firmado_el: ahora }";
    const tocadosFixture = CAMPOS_INMUTABLES.filter((campo) => DATA_ILEGAL.includes(campo));
    verificar(
      "control positivo: un data que reescribe el folio se detecta como inmutable tocado",
      tocadosFixture.length === 1 && tocadosFixture[0] === "folio"
    );
    const escritosFixture = [...DATA_ILEGAL.matchAll(/(\w+):/g)].map((m) => m[1]).filter((c) => c !== "data");
    verificarIgual(
      "control positivo: …y como campo fuera de los escribibles una sola vez",
      escritosFixture.filter((c) => !CAMPOS_ESCRIBIBLES_UNA_VEZ.includes(c as never)),
      ["folio"]
    );
  }

  // Las dos transiciones: la condición en el `where`, y el `data` sin ni uno de
  // los campos inmutables.
  const transiciones = [...adaptador.matchAll(/updateMany\(/g)].map((m) => bloqueDesde(adaptador, m.index ?? 0));
  verificarIgual("hay exactamente dos escrituras de transición", transiciones.length, 2);
  verificar(
    "firmar solo escribe si el documento sigue SIN firmar",
    transiciones.some((t) => /where:\s*\{\s*id,\s*firmado_el:\s*null\s*\}/.test(t))
  );
  verificar(
    "recibir solo escribe si está firmado y aún sin recibir",
    transiciones.some((t) => /where:\s*\{\s*id,\s*firmado_el:\s*\{\s*not:\s*null\s*\},\s*recibido_el:\s*null\s*\}/.test(t))
  );
  for (const transicion of transiciones) {
    const data = bloqueDesde(transicion, transicion.indexOf("data:"));
    const tocados = CAMPOS_INMUTABLES.filter((campo) => data.includes(campo));
    verificarIgual(
      `una transición no escribe ningún campo inmutable${tocados.length ? ` (toca ${tocados.join(", ")})` : ""}`,
      tocados.length,
      0
    );
    const escritos = [...data.matchAll(/(\w+):/g)].map((m) => m[1]).filter((c) => c !== "data");
    const fuera = escritos.filter((c) => !CAMPOS_ESCRIBIBLES_UNA_VEZ.includes(c as never));
    verificarIgual(
      `y solo escribe campos de firma${fuera.length ? ` (escribe ${fuera.join(", ")})` : ""}`,
      fuera.length,
      0
    );
  }

  // Y que nadie escriba en la tabla por fuera del módulo.
  const escrituras = /documentoFirmable\.(create|createMany|update|updateMany|upsert|delete|deleteMany)/;
  const intrusos = archivosBajo("src")
    .filter((f) => !f.startsWith(path.join("src", "lib", "documentos")))
    .filter((f) => escrituras.test(sinComentarios(readFileSync(path.join(RAIZ, f), "utf8"))));
  verificarIgual(
    `ningún archivo fuera del módulo escribe en documentos_firmables${intrusos.length ? `: ${intrusos.join(", ")}` : ""}`,
    intrusos.length,
    0
  );

  // La creación pasa por el guardián de privacidad, que enumera campo por campo.
  verificar(
    "crear una fila pasa por construirFilaRegistro, no por un objeto suelto",
    /construirFilaRegistro\(/.test(adaptador)
  );

  // La ruta de firma no lee la identidad del cuerpo de la petición.
  const rutaFirma = sinComentarios(leer("src/app/api/documentos/[id]/firmar/route.ts"));
  verificar("la ruta de firma exige sesión con requireUser()", /requireUser\(\)/.test(rutaFirma));
  verificar("y valida la pertenencia al tenant con el helper compartido", /assertProyectoInTenant\(/.test(rutaFirma));
  verificar(
    "la identidad de quien firma sale de la sesión, no del cuerpo de la petición",
    /usuarioId:\s*ctx\.usuario\.id/.test(rutaFirma) && !/req\.json\(\)/.test(rutaFirma)
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

function bloqueLenguaje() {
  verificarIgual("un informe del profesional se llama «Concepto técnico»", ETIQUETA_TIPO.INFORME_TECNICO, "Concepto técnico");
  verificarIgual("y su folio lleva el prefijo CT", PREFIJO_POR_TIPO.INFORME_TECNICO, "CT");
  verificar("el término correcto está declarado", TERMINO_CONCEPTO === "concepto técnico");
  verificar("hay términos prohibidos declarados", TERMINOS_PROHIBIDOS.length >= 2);
  verificar("tieneTerminoProhibido reconoce lo que no se puede prometer", tieneTerminoProhibido(`un ${TERMINOS_PROHIBIDOS[0]} de parte`) !== null);
  verificar("y no se dispara con el término correcto", tieneTerminoProhibido(`un ${TERMINO_CONCEPTO} firmado`) === null);

  verificar("el botón del cliente dice «recibido conforme»", COPY_RECIBIDO.boton.toLowerCase().includes("recibido conforme"));
  verificar("y la aclaración dice que NO es aprobación del contenido", /no es una aprobación de su contenido/i.test(COPY_RECIBIDO.aclaracion));
  verificar("la aclaración dice que es constancia de que llegó, no de que guste", /te llegó/i.test(COPY_RECIBIDO.aclaracion));
  verificar("el aviso de cierre advierte que después no se puede modificar", /ya no se puede modificar/i.test(COPY_FIRMA.advertenciaCierre));
  verificar("y que corregir emite una versión nueva", /versión nueva con folio nuevo/i.test(COPY_FIRMA.advertenciaCierre));
  verificar("el alcance legal no promete firma digital certificada", /no es firma digital certificada/i.test(COPY_FIRMA.alcance));

  const DIRECTORIOS = [
    path.join("src", "lib", "documentos"),
    path.join("src", "components", "documentos"),
    path.join("src", "app", "api", "documentos"),
    path.join("src", "app", "c"),
  ];
  const revisados: string[] = [];
  for (const dir of DIRECTORIOS) revisados.push(...archivosBajo(dir));
  revisados.push("scripts/verificar-firmas.ts");

  const sucios: string[] = [];
  for (const archivo of revisados) {
    const texto = readFileSync(path.join(RAIZ, archivo), "utf8").toLowerCase();
    const encontrado = TERMINOS_PROHIBIDOS.find((t) => texto.includes(t));
    if (encontrado) sucios.push(`${archivo} (${encontrado})`);
  }
  verificarIgual(
    `ningún texto del módulo promete una figura que no es${sucios.length ? `: ${sucios.join(", ")}` : ""}`,
    sucios.length,
    0
  );
  verificar("y se revisaron todos los archivos del módulo, no una muestra", revisados.length >= 15);
}

// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

function bloqueFechas() {
  // 02:00 UTC del 31 son las 21:00 del 30 en Colombia. Un acta firmada el
  // domingo por la noche no puede salir fechada el lunes.
  verificarIgual("una firma nocturna no se va al día siguiente", fechaEnColombia(new Date("2026-08-31T02:00:00Z")), "2026-08-30");
  verificarIgual("y a media mañana la fecha es la evidente", fechaEnColombia(new Date("2026-08-30T15:00:00Z")), "2026-08-30");
  verificarIgual("el formato es el mismo del resto del módulo", /^\d{4}-\d{2}-\d{2}$/.test(fechaEnColombia(new Date())), true);
}

/**
 * Nada de esto puede correr en el nivel superior: el runner compila a CommonJS y
 * ahí el `await` de arriba del todo no existe. Y el orden importa, porque cada
 * bloque cuenta sus verificaciones sobre el mismo contador.
 */
async function main() {
  console.log("Documentos firmables — firmas, «recibido conforme» e inmutabilidad\n");

  console.log("1. Un documento firmado NO se puede modificar");
  await bloqueInmutabilidad();
  console.log("\n2. La versión anterior queda reemplazada y SIGUE verificando");
  await bloqueVersiones();
  console.log("\n3. La huella cambia si cambia un solo byte");
  await bloqueHuella();
  console.log("\n4. La firma del profesional: quién, cuándo, y la matrícula congelada");
  await bloqueFirma();
  console.log("\n5. «Recibido conforme»: constancia de ENTREGA, nunca aprobación");
  await bloqueRecibido();
  console.log("\n6. El enlace del cliente no llega a documentos de otra obra ni de otro tenant");
  await bloqueAislamiento();
  console.log("\n7. El token del enlace: aleatorio, no adivinable, y con freno");
  await bloqueToken();
  console.log("\n8. La inmutabilidad, en el CÓDIGO: no hay forma de escribir sobre un firmado");
  await bloqueEstructura();
  console.log("\n9. El lenguaje: «concepto técnico», y «recibido conforme» es entrega");
  await bloqueLenguaje();
  console.log("\n10. Fechas: la firma dice el día que fue en Colombia");
  await bloqueFechas();

  console.log(`\n${total - fallos}/${total} verificaciones OK`);
  if (fallos > 0) {
    console.error(`${fallos} verificación(es) fallaron.`);
    process.exit(1);
  }
  console.log("Firmas e inmutabilidad de los documentos firmables verificadas sin errores.");
}

main().catch((err) => {
  console.error("verificar-firmas: fallo inesperado", err);
  process.exit(1);
});
