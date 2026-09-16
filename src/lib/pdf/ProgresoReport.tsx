// ---------------------------------------------------------------------------
// INFORME DE AVANCE DE OBRA — formato controlado.
//
// == QUE HABIA AQUI ANTES ===================================================
//
// Una pagina con cinco tarjetas de colores y una tabla de tres filas para una
// obra de 4.110 actividades. El dueno pregunto «¿a ti realmente te parece esto
// un informe serio?» y la respuesta era no.
//
// Y tenia un numero que MENTIA: «EN RIESGO 2.039» salia de sumar PENDIENTE +
// REPORTADA, o sea TODO lo que no estaba aprobado, pintado en naranja. Con esa
// definicion una obra que arranca manana tiene el 100% «en riesgo» — no es un
// indicador, es el complemento del avance con otro nombre y un color de
// alarma. Se ha ELIMINADO. Lo que lo sustituye es la seccion 5, que solo
// senala lo que de verdad esta detenido y dice con que regla lo decidio.
//
// == QUE LO CONVIERTE EN UN DOCUMENTO =======================================
//
// El envase (cajetin, tinta, tipografia, codigo de formato) vive en
// `estilos-informe.ts` y ahi esta el porque. Aqui va la ESTRUCTURA, que es la
// otra mitad: secciones numeradas jerarquicamente, tablas con rotulo citable
// («Tabla 3.1-1»), y control de aprobacion con firmas. Un dato de este informe
// se puede citar por su direccion exacta en un correo o en un acta.
//
// == LA REGLA QUE GOBIERNA LAS CIFRAS =======================================
//
// Ningun indicador se rellena con un cero cuando falta el dato. Si la obra no
// tiene cronograma, el avance PROGRAMADO y el SPI se declaran NO CALCULABLES y
// se explica que falta. Un cero es una afirmacion —«llevas cero programado»— y
// seria falsa. Es la misma regla que ya aplica `bitacora.ts` con la latencia
// de revision, y por eso ese modulo se reutiliza tal cual en la seccion 4.
//
// == TRAMPAS DE @react-pdf/renderer =========================================
//
//   · No es HTML: no hay cascada, ni `grid`, ni selectores. Cada nodo lleva su
//     estilo puesto.
//   · No hay `Font.register` en todo el repo → SOLO las 14 fuentes base. Una
//     `fontFamily` inventada NO da error: cae a Helvetica en silencio.
//   · `fixed` en la cabecera de una tabla SOLO la repite en las paginas que
//     esa tabla ocupa -comprobado renderizando: una tabla que va de la pagina
//     1 a la 3 pone cabecera en 1, 2 y 3, y NO en la 4-, asi que es la forma
//     correcta de que una tabla partida siga teniendo columnas con nombre.
//   · Un `Text` largo en el cajetin lo hace crecer, y como el hueco que la
//     hoja le reserva es fijo, el contenido de la pagina 2 en adelante se le
//     mete debajo. Por eso el nombre de la obra se recorta alli.
//
// El informe tiene que salir para una obra SIN cronograma, SIN fotos, SIN
// decisiones y SIN edificios. Cada tabla trae su fila de «sin datos».
//
// == LAS DOS LINEAS DE TIEMPO DEL DOCUMENTO =================================
//
// El informe mezcla dos cosas que NO se miden igual, y confundirlas seria
// mentir con cifras ciertas:
//
//   · PERIODO (lo elige el usuario: una semana, un mes, un rango a mano). Rige
//     lo que OCURRIO: decisiones firmadas, devoluciones, actividades aprobadas
//     y fotografias del anexo A.
//   · CORTE (el instante de generacion). Rige el ESTADO: avance ejecutado,
//     avance programado, SPI, fases, torres y la seccion 5. Ese avance es
//     ACUMULADO desde el inicio de la obra, no del periodo — un «49%» no es
//     «lo que se hizo en septiembre», es lo que lleva la obra entera.
//
// No se puede reconstruir el avance a una fecha pasada: `Tarea.estado` guarda
// el estado de HOY, no su historia. Por eso el corte es siempre el momento de
// generar, aunque el periodo termine antes, y el documento lo dice en la
// seccion 1 en vez de dejar que el lector lo suponga.
//
// NOTA DE ALCANCE: este informe es B2B y NO lleva dinero. Ni precios, ni
// presupuestos, ni valor ejecutado. Se declara en la seccion 7. El registro
// fotografico va como ANEXO A y no como seccion 8: meterlo en medio habria
// corrido la numeracion de REFERENCIAS y roto las citas ya emitidas.
// ---------------------------------------------------------------------------

import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { formatearDuracionHoras } from "@/lib/bitacora";
import {
  codigoDocumento,
  entero,
  estilosInforme as est,
  fechaDMA,
  fechaHoraColombia,
  fechaLarga,
  FORMATO,
  indice,
  NO_CALCULABLE,
  NO_REGISTRADO,
  porcentaje,
  texto,
} from "./estilos-informe";
import {
  recortar,
  RegistroFotografico,
  type RegistroFotograficoData,
} from "./RegistroFotografico";

// ─── Contrato de datos ──────────────────────────────────────────────────────
// Todo llega ya calculado desde la ruta. Este fichero no consulta, no suma y
// no decide: solo compone. Si un campo es `null`, el informe lo declara.

export interface IdentificacionInforme {
  /** Quien contrata la obra (`Cliente.nombre`). `null` si la obra no tiene cliente. */
  contratante: string | null;
  contratanteNit: string | null;
  /** Quien ejecuta: la constructora dueña de la cuenta. */
  ejecutor: string;
  ejecutorNit: string | null;
  obra: string;
  numeroRegistro: string | null;
  /** Dirección y conjunto, ya compuestos. */
  localizacion: string | null;
  ciudad: string | null;
  fechaInicio: Date | null;
  fechaFinEstimada: Date | null;
  diasHabilesSemana: number;
  /** Instante en que se generó: es la fecha de corte del ESTADO de la obra. */
  corte: Date;
  elaboradoPor: string;
  cargoElaborador: string;
}

/**
 * El período que el usuario eligió: rige lo que OCURRIÓ, nunca el estado.
 *
 * Las fechas viajan como `YYYY-MM-DD` —tal cual las escogió— y no como `Date`
 * a propósito. Un `Date` obliga a decidir aquí en qué zona horaria se lee, y
 * el mismo informe saldría con un día de diferencia en local (Bogotá) y en
 * producción (UTC). La ruta convierte esa cadena a instantes de la hora de
 * Colombia para consultar; el documento la imprime tal como se escogió.
 */
export interface PeriodoInforme {
  /** `null` = sin límite inferior: desde el inicio de la obra. */
  desde: string | null;
  /** `null` = sin límite superior: hasta la fecha de corte. */
  hasta: string | null;
  /**
   * Nombre del atajo que lo produjo («último mes»), o `null` si el usuario
   * escribió las dos fechas a mano.
   */
  atajo: string | null;
}

export interface EstadoAvanceInforme {
  totalActividades: number;
  aprobadas: number;
  /** Solo REPORTADA: declaradas hechas y esperando revisión. No incluye aprobadas. */
  reportadas: number;
  devueltas: number;
  pendientes: number;
  /**
   * `null` cuando la obra no tiene ni una actividad cargada.
   *
   * 0 de 0 no es «cero por ciento de avance»: es una division sin definir. Un
   * 0,0% ahi le diria al contratante que no se ha hecho nada, cuando lo que
   * pasa es que todavia no hay obra que medir.
   */
  pctEjecutado: number | null;
  pctReportado: number | null;
  /** Días hábiles del plazo. `null` si faltan las fechas de la obra. */
  diasPlazo: number | null;
  diasTranscurridos: number | null;
  pctTiempo: number | null;
  /** `null` = NO CALCULABLE: la obra no tiene línea base completa. */
  pctProgramado: number | null;
  spi: number | null;
  /** Cuántas actividades tienen ventana planeada, y cuántas fases. */
  actividadesConPlan: number;
  fasesConPlan: number;
  totalFases: number;
  /** `Proyecto.modo_cronograma`, o `null` si la obra nunca lo fijó. */
  modoCronograma: string | null;
}

export interface FilaFaseInforme {
  nombre: string;
  total: number;
  aprobadas: number;
  reportadas: number;
  devueltas: number;
  pendientes: number;
  pctAprobado: number;
  inicioPlan: Date | null;
  finPlan: Date | null;
  /** Lectura de la fase contra su ventana planeada. Sin ventana → SIN_PLAN. */
  situacionPlan: "SIN_PLAN" | "NO_INICIADA" | "EN_CURSO" | "VENCIDA" | "COMPLETA";
}

export interface FilaTorreInforme {
  nombre: string;
  unidades: number;
  total: number;
  aprobadas: number;
  reportadas: number;
  pctAprobado: number;
}

export interface FilaRevisorInforme {
  nombre: string;
  aprobadas: number;
  devueltas: number;
  total: number;
  pctDevueltas: number;
  /** Mediana de horas entre reporte y decisión. `null` = ningún caso medible. */
  horasMediana: number | null;
  medibles: number;
}

export interface FilaDevolucionInforme {
  numeroRegistro: string | null;
  actividad: string;
  ubicacion: string;
  fecha: Date;
  revisor: string;
  motivo: string | null;
}

export interface FilaGestionInforme {
  numeroRegistro: string | null;
  actividad: string;
  ubicacion: string;
  /** Días HÁBILES desde el suceso que la dejó detenida. `null` si no hay marca. */
  dias: number | null;
  responsable: string;
}

export interface CalidadInforme {
  decisiones: number;
  devoluciones: number;
  pctDevoluciones: number;
  revisores: FilaRevisorInforme[];
  devolucionesRecientes: FilaDevolucionInforme[];
  /** Sobre cuántas decisiones se buscaron los motivos de 4.2. */
  ventanaRevisada: number;
  /** `true` si el resumen chocó con el tope de filas y no cubre todo el período. */
  resumenTruncado: boolean;
  /**
   * Actividades con al menos una aprobación firmada DENTRO del período. Es la
   * producción del período, y la única cifra de este informe que se puede leer
   * como «lo que se hizo en estas fechas».
   */
  aprobadasEnPeriodo: number;
}

export interface GestionInforme {
  devueltas: FilaGestionInforme[];
  totalDevueltas: number;
  esperandoRevision: FilaGestionInforme[];
  totalEsperando: number;
  /** Actividades sin aprobar cuya ventana planeada ya venció. `null` sin cronograma. */
  vencidasPlan: number | null;
}

export interface CoberturaInforme {
  aprobadas: number;
  aprobadasConEvidencia: number;
  /** `null` si no hay ni una actividad aprobada: no hay universo que medir. */
  pct: number | null;
}

export interface InformeAvanceData {
  identificacion: IdentificacionInforme;
  periodo: PeriodoInforme;
  avance: EstadoAvanceInforme;
  fases: FilaFaseInforme[];
  torres: FilaTorreInforme[];
  calidad: CalidadInforme;
  gestion: GestionInforme;
  cobertura: CoberturaInforme;
  /** El anexo A. Siempre presente: sin fotos trae la lista vacía y lo declara. */
  registro: RegistroFotograficoData;
}

// ─── Piezas del formato ─────────────────────────────────────────────────────

/**
 * El CAJETIN. Va en TODAS las páginas: una hoja que se desprenda del juego
 * sigue diciendo quién la emitió, bajo qué formato y a qué fecha de corte.
 */
function Cajetin({
  logoDataUrl,
  obra,
  codigo,
  corte,
}: {
  logoDataUrl: string | null;
  obra: string;
  codigo: string;
  corte: Date;
}) {
  return (
    <View style={est.cajetin} fixed>
      <View style={est.cajetinEmisor}>
        {logoDataUrl ? <Image src={logoDataUrl} style={est.cajetinLogo} /> : null}
        <View>
          <Text style={est.cajetinMarca}>{FORMATO.emisor}</Text>
          <Text style={est.cajetinMarcaPie}>CONTROL DE OBRA</Text>
        </View>
      </View>
      <View style={est.cajetinCentro}>
        <Text style={est.cajetinTitulo}>{FORMATO.titulo}</Text>
        <Text style={est.cajetinObra}>Obra: {recortar(obra, 54)}</Text>
      </View>
      <View style={est.cajetinMeta}>
        <View style={est.cajetinMetaFila}>
          <Text style={est.cajetinMetaClave}>Formato</Text>
          <Text style={est.cajetinMetaValor}>{FORMATO.codigo}</Text>
        </View>
        <View style={est.cajetinMetaFila}>
          <Text style={est.cajetinMetaClave}>Versión</Text>
          <Text style={est.cajetinMetaValor}>{FORMATO.version}</Text>
        </View>
        <View style={est.cajetinMetaFila}>
          <Text style={est.cajetinMetaClave}>Corte</Text>
          <Text style={est.cajetinMetaValor}>{fechaDMA(corte)}</Text>
        </View>
        <View style={est.cajetinMetaFilaUltima}>
          <Text style={est.cajetinMetaClave}>Documento</Text>
          <Text style={est.cajetinMetaValor}>{codigo}</Text>
        </View>
      </View>
    </View>
  );
}

/** Pie con el código del documento y «Pág. X de N» en cada hoja. */
function PieFijo({ codigo }: { codigo: string }) {
  return (
    <View style={est.pie} fixed>
      <Text style={est.pieTexto}>{codigo}</Text>
      <Text style={est.pieTexto}>{FORMATO.emisorPie}</Text>
      <Text
        style={est.pieTexto}
        render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

/** Título de sección numerado. `minPresenceAhead` evita que quede huérfano. */
function Seccion({
  numero,
  titulo,
  primera,
  children,
}: {
  numero: string;
  titulo: string;
  primera?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={primera ? est.seccionPrimera : est.seccion}>
      <Text style={est.tituloSeccion} minPresenceAhead={92}>
        {numero}. {titulo}
      </Text>
      {children}
    </View>
  );
}

function Subseccion({ numero, titulo }: { numero: string; titulo: string }) {
  return (
    <Text style={est.tituloSubseccion} minPresenceAhead={72}>
      {numero} {titulo}
    </Text>
  );
}

/** Rótulo citable de una tabla: «Tabla 3.1-1 — Avance por torre». */
function Rotulo({ codigo, titulo }: { codigo: string; titulo: string }) {
  return (
    <Text style={est.rotulo} minPresenceAhead={40}>
      Tabla {codigo} — {titulo}
    </Text>
  );
}

function FilaFicha({ clave, valor, ultima }: { clave: string; valor: string; ultima?: boolean }) {
  return (
    <View style={ultima ? est.fichaFilaUltima : est.fichaFila}>
      <Text style={est.fichaClave}>{clave}</Text>
      <Text style={est.fichaValor}>{valor}</Text>
    </View>
  );
}

/** La fila que aparece cuando una tabla no tiene ni un dato que enseñar. */
function SinDatos({ mensaje }: { mensaje: string }) {
  return (
    <View style={est.tablaFilaUltima}>
      <Text style={[est.celdaVacia, { flex: 1 }]}>{mensaje}</Text>
    </View>
  );
}

/**
 * Celda en blanco para firmar a mano. El ancho se pasa igual que en la
 * cabecera de su tabla —`flex` o porcentaje— o las columnas no cuadran: en
 * react-pdf no hay `colspan` ni nada que las alinee por ti.
 */
function CeldaFirma({ ancho }: { ancho: string | { flex: number } }) {
  return (
    <View
      style={[
        { paddingHorizontal: 5, paddingVertical: 3.5 },
        typeof ancho === "string" ? { width: ancho } : ancho,
      ]}
    >
      <View style={est.lineaFirma} />
    </View>
  );
}

/** Barra de avance monocroma, limitada a [0, 100] para que no se salga del ancho. */
function Barra({ pct }: { pct: number }) {
  const ancho = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <View style={est.barra}>
      <View style={[est.barraRelleno, { width: `${ancho}%` }]} />
    </View>
  );
}

/**
 * Cuerpo de tabla. `wrap` se apaga en las tablas cortas para que cabecera y
 * filas viajen juntas a la página siguiente; en las largas se deja partir,
 * porque un bloque más alto que la hoja con `wrap={false}` se corta y pierde
 * filas sin avisar.
 */
const TOPE_TABLA_INDIVISIBLE = 16;

/**
 * ¿Puede esta tabla partirse de página y, por tanto, necesita que su cabecera
 * se repita? Las dos preguntas tienen la MISMA respuesta, así que se contestan
 * en un solo sitio: si la condición se escribiera dos veces, un día una tabla
 * partiría sin nombres de columna y nadie lo vería hasta imprimirla.
 */
function partePagina(filas: number): boolean {
  return filas > TOPE_TABLA_INDIVISIBLE;
}

function Tabla({ filas, children }: { filas: number; children: React.ReactNode }) {
  return (
    <View style={est.tabla} wrap={partePagina(filas)}>
      {children}
    </View>
  );
}

// ─── Textos del dominio ─────────────────────────────────────────────────────

const SITUACION_PLAN: Record<FilaFaseInforme["situacionPlan"], string> = {
  SIN_PLAN: "Sin plan",
  NO_INICIADA: "No iniciada",
  EN_CURSO: "En curso",
  VENCIDA: "Vencida",
  COMPLETA: "Completa",
};

const MODO_CRONOGRAMA: Record<string, string> = {
  AUTOMATICO: "automático: el sistema repartió fases y actividades",
  FASES: "por fases: el usuario fijó la ventana de cada fase",
  MANUAL: "manual: el usuario fijó fases y actividades",
};

/** Días hábiles con su unidad, o raya si no hay con qué contarlos. */
function dias(n: number | null): string {
  return n === null ? "—" : entero(n);
}

/**
 * `YYYY-MM-DD` → «14 de septiembre de 2026».
 *
 * Se ancla a mediodía UTC y no a medianoche: `fechaLarga` lee en UTC, y con
 * medianoche cualquier desplazamiento de un milisegundo hacia atrás —el que
 * introduce un `Date` mal construido— cambia el día impreso. Al mediodía
 * sobran doce horas de margen en las dos direcciones.
 */
function fechaISOLarga(iso: string): string {
  return fechaLarga(new Date(`${iso}T12:00:00Z`));
}

/**
 * La frase que encabeza el informe: «15 de agosto a 14 de septiembre de 2026».
 *
 * Sin período elegido NO se escribe una fecha inventada: se dice que el
 * documento cubre la historia completa, que es lo que de verdad cubre.
 */
function textoPeriodo(p: PeriodoInforme): string {
  const atajo = p.atajo ? ` (${p.atajo})` : "";
  if (p.desde && p.hasta) {
    // Dentro del mismo año el año se escribe UNA vez, al final: «15 de agosto a
    // 14 de septiembre de 2026». Repetirlo no añade precisión, solo ruido en la
    // línea que más se lee del informe.
    const mismoAnio = p.desde.slice(0, 4) === p.hasta.slice(0, 4);
    const inicio = mismoAnio
      ? fechaISOLarga(p.desde).replace(/ de \d{4}$/, "")
      : fechaISOLarga(p.desde);
    return `${inicio} a ${fechaISOLarga(p.hasta)}${atajo}`;
  }
  if (p.desde) return `Desde el ${fechaISOLarga(p.desde)} hasta la fecha de corte${atajo}`;
  if (p.hasta) return `Desde el inicio de la obra hasta el ${fechaISOLarga(p.hasta)}${atajo}`;
  return "Historia completa de la obra, desde su inicio hasta la fecha de corte";
}

// ─── El informe ─────────────────────────────────────────────────────────────

export function ProgresoReport({
  data,
  logoDataUrl = null,
}: {
  data: InformeAvanceData;
  logoDataUrl?: string | null;
}) {
  const {
    identificacion: id,
    periodo,
    avance,
    fases,
    torres,
    calidad,
    gestion,
    cobertura,
    registro,
  } = data;
  const codigo = codigoDocumento(id.numeroRegistro, id.obra, id.corte);
  const hayCronograma = avance.pctProgramado !== null;
  /** Un período acotado obliga a distinguir «lo ocurrido» de «lo acumulado». */
  const hayPeriodo = periodo.desde !== null || periodo.hasta !== null;

  return (
    <Document
      title={`${FORMATO.titulo} — ${id.obra}`}
      subject={`Corte ${fechaDMA(id.corte)} · documento ${codigo}`}
      author={id.ejecutor}
      creator="Seiricon"
    >
      <Page size="LETTER" orientation="portrait" style={est.pagina}>
        <Cajetin logoDataUrl={logoDataUrl} obra={id.obra} codigo={codigo} corte={id.corte} />
        <PieFijo codigo={codigo} />

        {/* ── 1. IDENTIFICACION ─────────────────────────────────────────── */}
        <Seccion numero="1" titulo="IDENTIFICACIÓN" primera>
          <View style={est.ficha} wrap={false}>
            <FilaFicha
              clave="Contratante"
              valor={
                id.contratante
                  ? `${id.contratante}${id.contratanteNit ? ` · NIT ${id.contratanteNit}` : ""}`
                  : NO_REGISTRADO
              }
            />
            <FilaFicha
              clave="Ejecutor"
              valor={`${id.ejecutor}${id.ejecutorNit ? ` · NIT ${id.ejecutorNit}` : ""}`}
            />
            <FilaFicha clave="Obra" valor={id.obra} />
            <FilaFicha clave="Registro de la obra" valor={texto(id.numeroRegistro)} />
            <FilaFicha clave="Localización" valor={texto(id.localizacion)} />
            <FilaFicha clave="Ciudad" valor={texto(id.ciudad)} />
            <FilaFicha
              clave="Plazo"
              valor={
                id.fechaInicio || id.fechaFinEstimada
                  ? `${fechaDMA(id.fechaInicio)} a ${fechaDMA(id.fechaFinEstimada)}${
                      avance.diasPlazo !== null
                        ? ` · ${entero(avance.diasPlazo)} días hábiles`
                        : ""
                    }`
                  : NO_REGISTRADO
              }
            />
            <FilaFicha
              clave="Jornada"
              valor={`${entero(
                id.diasHabilesSemana,
              )} días laborables por semana, descontando los festivos nacionales`}
            />
            <FilaFicha clave="Período del informe" valor={textoPeriodo(periodo)} />
            <FilaFicha clave="Fecha de corte" valor={fechaHoraColombia(id.corte)} />
            <FilaFicha clave="Documento" valor={codigo} ultima />
          </View>

          {/* La distincion entre las dos lineas de tiempo va en la PRIMERA
              pagina, junto a las fechas, y no en las definiciones del final:
              quien solo lee la portada tiene que saber ya que el 49% no es lo
              del mes, y quien firma no puede alegar que estaba en letra chica. */}
          <View style={est.nota} wrap={false}>
            <Text style={est.notaTitulo}>QUÉ MIDE EL PERÍODO Y QUÉ MIDE LA FECHA DE CORTE</Text>
            <Text style={est.notaTexto}>
              El período rige lo que OCURRIÓ dentro de él: las decisiones firmadas y las
              devoluciones de la sección 4, y el registro fotográfico del anexo A. El estado de
              avance —secciones 2, 3 y 5— es ACUMULADO desde el inicio de la obra hasta la fecha de
              corte, no del período: un avance ejecutado del 49% dice cuánto lleva la obra entera,
              nunca cuánto se hizo en estas fechas.{" "}
              {hayPeriodo
                ? "La fecha de corte es el instante en que se generó este documento, que puede ser posterior al cierre del período: el estado de la obra no se puede reconstruir hacia atrás, porque el sistema guarda el estado actual de cada actividad y no su historia. Lo que sí se puede afirmar del período está en la sección 4."
                : "No se acotó ningún período, así que el informe cubre la historia completa de la obra."}
            </Text>
          </View>

          <Subseccion numero="1.1" titulo="Control de aprobación" />
          <Rotulo codigo="1.1-1" titulo="Elaboración, revisión y aprobación del informe" />
          <View style={est.tabla} wrap={false}>
            <View style={est.tablaCab}>
              <Text style={[est.tablaCabTexto, { width: "20%" }]}>Actuación</Text>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Nombre</Text>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Cargo</Text>
              <Text style={[est.tablaCabTexto, { width: "17%" }]}>Fecha</Text>
              <Text style={[est.tablaCabTexto, { width: "20%" }]}>Firma</Text>
            </View>
            {/* La ELABORACION es la unica fila que el sistema puede llenar: la
                pidio quien pidio el informe, y eso consta. Revision y
                aprobacion van en blanco a proposito — rellenarlas con el mismo
                usuario convertiria el control en un sello automatico, que es
                exactamente lo que un control de aprobacion existe para evitar. */}
            <View style={est.tablaFila}>
              <Text style={[est.celdaFuerte, { width: "20%" }]}>Elaboración</Text>
              <Text style={[est.celda, { flex: 1 }]}>{id.elaboradoPor}</Text>
              <Text style={[est.celda, { flex: 1 }]}>{id.cargoElaborador}</Text>
              <Text style={[est.celda, { width: "17%" }]}>{fechaDMA(id.corte)}</Text>
              <Text style={[est.celda, { width: "20%" }]}>Generado por Seiricon</Text>
            </View>
            <View style={est.tablaFila}>
              <Text style={[est.celdaFuerte, { width: "20%" }]}>Revisión</Text>
              <CeldaFirma ancho={{ flex: 1 }} />
              <CeldaFirma ancho={{ flex: 1 }} />
              <CeldaFirma ancho="17%" />
              <CeldaFirma ancho="20%" />
            </View>
            <View style={est.tablaFilaUltima}>
              <Text style={[est.celdaFuerte, { width: "20%" }]}>Aprobación</Text>
              <CeldaFirma ancho={{ flex: 1 }} />
              <CeldaFirma ancho={{ flex: 1 }} />
              <CeldaFirma ancho="17%" />
              <CeldaFirma ancho="20%" />
            </View>
          </View>
          <Text style={est.rotuloNota}>
            La fila de elaboración la genera el sistema con los registros de la obra a la fecha de
            corte. Revisión y aprobación son actuaciones humanas y se firman sobre el documento
            impreso.
          </Text>
        </Seccion>

        {/* ── 2. ESTADO DEL AVANCE ──────────────────────────────────────── */}
        <Seccion numero="2" titulo="ESTADO DEL AVANCE">
          <View style={est.trio} wrap={false}>
            <View style={est.trioCelda}>
              <Text style={est.trioClave}>TIEMPO TRANSCURRIDO</Text>
              {avance.pctTiempo === null ? (
                <Text style={est.trioValorNulo}>{NO_CALCULABLE}</Text>
              ) : (
                <>
                  <Text style={est.trioValor}>{porcentaje(avance.pctTiempo)}</Text>
                  <Barra pct={avance.pctTiempo} />
                </>
              )}
              <Text style={est.trioDetalle}>
                {avance.diasTranscurridos === null
                  ? "La obra no tiene fecha de inicio registrada."
                  : `${dias(avance.diasTranscurridos)} días hábiles de ${dias(
                      avance.diasPlazo,
                    )} de plazo.`}
              </Text>
            </View>

            <View style={est.trioCelda}>
              <Text style={est.trioClave}>AVANCE EJECUTADO</Text>
              {avance.pctEjecutado === null ? (
                <Text style={est.trioValorNulo}>{NO_CALCULABLE}</Text>
              ) : (
                <>
                  <Text style={est.trioValor}>{porcentaje(avance.pctEjecutado)}</Text>
                  <Barra pct={avance.pctEjecutado} />
                </>
              )}
              <Text style={est.trioDetalle}>
                {avance.totalActividades === 0
                  ? "La obra todavía no tiene actividades cargadas: no hay universo que medir."
                  : `${entero(avance.aprobadas)} de ${entero(
                      avance.totalActividades,
                    )} actividades aprobadas. Reportado sin revisar: ${porcentaje(
                      avance.pctReportado,
                    )}.`}
              </Text>
            </View>

            <View style={est.trioCeldaUltima}>
              <Text style={est.trioClave}>AVANCE PROGRAMADO</Text>
              {avance.pctProgramado === null ? (
                <Text style={est.trioValorNulo}>{NO_CALCULABLE}</Text>
              ) : (
                <>
                  <Text style={est.trioValor}>{porcentaje(avance.pctProgramado)}</Text>
                  <Barra pct={avance.pctProgramado} />
                </>
              )}
              <Text style={est.trioDetalle}>
                {avance.pctProgramado === null
                  ? "Sin línea base de cronograma. Ver la declaración de abajo."
                  : `SPI (ejecutado ÷ programado): ${indice(avance.spi)}.`}
              </Text>
            </View>
          </View>

          {hayCronograma ? (
            <View style={est.nota} wrap={false}>
              <Text style={est.notaTitulo}>LÍNEA BASE DEL CRONOGRAMA</Text>
              <Text style={est.notaTexto}>
                El avance programado se mide contra las ventanas de fechas planeadas de la obra
                {avance.modoCronograma
                  ? ` (cronograma ${
                      MODO_CRONOGRAMA[avance.modoCronograma] ?? avance.modoCronograma
                    })`
                  : ""}
                . A la fecha de corte, cada actividad aporta la fracción de su ventana ya
                transcurrida, contada en días hábiles: 0% antes de su inicio planeado y 100% pasado
                su fin planeado. La línea base cubre {entero(avance.actividadesConPlan)} de{" "}
                {entero(avance.totalActividades)} actividades, en {entero(avance.fasesConPlan)} de{" "}
                {entero(avance.totalFases)} fases. El SPI es el cociente entre ejecutado y
                programado: por debajo de 1,00 la obra va detrás del plan.
              </Text>
            </View>
          ) : (
            <View style={est.nota} wrap={false}>
              <Text style={est.notaTitulo}>
                AVANCE PROGRAMADO Y SPI: {NO_CALCULABLE.toUpperCase()}
              </Text>
              <Text style={est.notaTexto}>
                Los dos exigen una línea base: una ventana de fechas planeada para cada actividad.
                Esta obra tiene {entero(avance.fasesConPlan)} de {entero(avance.totalFases)} fases
                con ventana, y {entero(avance.actividadesConPlan)} de{" "}
                {entero(avance.totalActividades)} actividades con plan. Calcular el programado sobre
                una parte de la obra y compararlo contra un ejecutado medido sobre toda no daría una
                desviación: daría el hueco del plan disfrazado de retraso. Los días estimados de
                cada fase tampoco sirven de línea base: una duración dice cuánto dura una fase, no
                cuándo ocurre, y en una obra de varias torres las fases se solapan —la torre 1 en
                pintura mientras la torre 3 sigue en mampostería—, así que encadenar duraciones
                produce un calendario falso. Por eso aquí se declara no calculable en lugar de
                publicar un cero. Para habilitarlo, fije las fechas planeadas de las fases de la
                obra.
              </Text>
            </View>
          )}

          <Subseccion numero="2.1" titulo="Distribución de actividades y reglas de crédito" />
          <Rotulo codigo="2.1-1" titulo="Crédito al avance según el estado de la actividad" />
          <View style={est.tabla} wrap={false}>
            <View style={est.tablaCab}>
              <Text style={[est.tablaCabTexto, { width: "16%" }]}>Estado</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "13%" }]}>Actividades</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "12%" }]}>% del total</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "11%" }]}>Crédito</Text>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Qué significa</Text>
            </View>
            <FilaCredito
              estado="Aprobada"
              n={avance.aprobadas}
              total={avance.totalActividades}
              credito="100%"
              significado="Ejecutada, revisada y aceptada por quien firma. Es la única que suma avance."
            />
            <FilaCredito
              estado="Reportada"
              n={avance.reportadas}
              total={avance.totalActividades}
              credito="0%"
              significado="El ejecutor la declara hecha; nadie la ha revisado. Se informa aparte como avance reportado."
            />
            <FilaCredito
              estado="Devuelta"
              n={avance.devueltas}
              total={avance.totalActividades}
              credito="0%"
              significado="Revisada y rechazada con motivo. Vuelve al ejecutor. Ver secciones 4 y 5."
            />
            <FilaCredito
              estado="Pendiente"
              n={avance.pendientes}
              total={avance.totalActividades}
              credito="0%"
              significado="Sin reportar. No implica retraso por sí sola."
            />
            <View style={est.tablaFilaTotal}>
              <Text style={[est.celdaFuerte, { width: "16%" }]}>Total</Text>
              <Text style={[est.celdaFuerte, est.celdaDer, { width: "13%" }]}>
                {entero(avance.totalActividades)}
              </Text>
              <Text style={[est.celdaFuerte, est.celdaDer, { width: "12%" }]}>
                {avance.totalActividades > 0 ? "100,0%" : "—"}
              </Text>
              <Text style={[est.celdaFuerte, est.celdaDer, { width: "11%" }]}>
                {porcentaje(avance.pctEjecutado, "—")}
              </Text>
              <Text style={[est.celda, { flex: 1 }]}>Avance ejecutado de la obra.</Text>
            </View>
          </View>
          <Text style={est.rotuloNota}>
            Todas las actividades pesan igual: el avance ejecutado es la fracción de actividades
            aprobadas sobre el total, sin ponderar por cantidad de obra ni por valor contractual.
            Este informe no publica un indicador de «actividades en riesgo» calculado como todo lo
            que no está aprobado: ese número es el complemento del avance con otro nombre, y haría
            que una obra recién iniciada apareciera con el 100% en riesgo. Lo que de verdad está
            detenido se identifica en la sección 5, con su regla escrita.
          </Text>
        </Seccion>

        {/* ── 3. AVANCE POR FASE ────────────────────────────────────────── */}
        <Seccion numero="3" titulo="AVANCE POR FASE">
          <Rotulo codigo="3-1" titulo="Estado de cada fase a la fecha de corte" />
          <Tabla filas={fases.length}>
            <View style={est.tablaCab} fixed={partePagina(fases.length)}>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Fase</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "8%" }]}>Activ.</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "8%" }]}>Aprob.</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "8%" }]}>Report.</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "8%" }]}>Devuel.</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "10%" }]}>Avance</Text>
              <Text style={[est.tablaCabTexto, { width: "20%" }]}>Ventana planeada</Text>
              <Text style={[est.tablaCabTexto, { width: "11%" }]}>Situación</Text>
            </View>
            {fases.length === 0 ? (
              <SinDatos mensaje="La obra no tiene fases registradas." />
            ) : (
              fases.map((f, i) => (
                <View
                  key={`${f.nombre}-${i}`}
                  style={i === fases.length - 1 ? est.tablaFilaUltima : est.tablaFila}
                >
                  <Text style={[est.celda, { flex: 1 }]}>{f.nombre}</Text>
                  <Text style={[est.celda, est.celdaDer, { width: "8%" }]}>{entero(f.total)}</Text>
                  <Text style={[est.celda, est.celdaDer, { width: "8%" }]}>
                    {entero(f.aprobadas)}
                  </Text>
                  <Text style={[est.celda, est.celdaDer, { width: "8%" }]}>
                    {entero(f.reportadas)}
                  </Text>
                  <Text style={[est.celda, est.celdaDer, { width: "8%" }]}>
                    {entero(f.devueltas)}
                  </Text>
                  <Text style={[est.celdaFuerte, est.celdaDer, { width: "10%" }]}>
                    {porcentaje(f.pctAprobado)}
                  </Text>
                  <Text style={[est.celda, { width: "20%" }]}>
                    {f.inicioPlan && f.finPlan
                      ? `${fechaDMA(f.inicioPlan)}–${fechaDMA(f.finPlan)}`
                      : "—"}
                  </Text>
                  <Text style={[est.celda, { width: "11%" }]}>
                    {SITUACION_PLAN[f.situacionPlan]}
                  </Text>
                </View>
              ))
            )}
          </Tabla>
          <Text style={est.rotuloNota}>
            «Avance» es el porcentaje de actividades aprobadas de la fase. Cuando la obra tiene
            varios frentes abiertos, ese promedio no describe a ninguna torre en particular: el
            reparto real está en la tabla 3.1-1.
          </Text>

          <Subseccion numero="3.1" titulo="Avance por torre" />
          <Rotulo codigo="3.1-1" titulo="Reparto del avance entre las torres de la obra" />
          <Tabla filas={torres.length}>
            <View style={est.tablaCab} fixed={partePagina(torres.length)}>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Torre</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "13%" }]}>Unidades</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "15%" }]}>Actividades</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "15%" }]}>Aprobadas</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "15%" }]}>Reportadas</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "13%" }]}>Avance</Text>
            </View>
            {torres.length === 0 ? (
              <SinDatos mensaje="La obra no tiene torres ni edificios registrados." />
            ) : (
              torres.map((t, i) => (
                <View
                  key={`${t.nombre}-${i}`}
                  style={i === torres.length - 1 ? est.tablaFilaUltima : est.tablaFila}
                >
                  <Text style={[est.celda, { flex: 1 }]}>{t.nombre}</Text>
                  <Text style={[est.celda, est.celdaDer, { width: "13%" }]}>
                    {entero(t.unidades)}
                  </Text>
                  <Text style={[est.celda, est.celdaDer, { width: "15%" }]}>{entero(t.total)}</Text>
                  <Text style={[est.celda, est.celdaDer, { width: "15%" }]}>
                    {entero(t.aprobadas)}
                  </Text>
                  <Text style={[est.celda, est.celdaDer, { width: "15%" }]}>
                    {entero(t.reportadas)}
                  </Text>
                  <Text style={[est.celdaFuerte, est.celdaDer, { width: "13%" }]}>
                    {porcentaje(t.pctAprobado)}
                  </Text>
                </View>
              ))
            )}
          </Tabla>
        </Seccion>

        {/* ── 4. CONTROL DE CALIDAD ─────────────────────────────────────── */}
        <Seccion numero="4" titulo="CONTROL DE CALIDAD DE LA EJECUCIÓN">
          {/* La UNICA seccion que habla del periodo y no del acumulado. Los
              verbos van en pasado y con las fechas delante a proposito: es lo
              que la separa de las secciones 2, 3 y 5. */}
          <Text style={est.parrafo}>
            Ninguna actividad suma avance hasta que alguien la revisa y la firma. Esta sección dice
            quién lo hizo, cuánto tardó y qué devolvió{" "}
            {hayPeriodo ? "DENTRO DEL PERÍODO INFORMADO" : "en la historia de la obra"}. Constan{" "}
            {entero(calidad.decisiones)} decisiones firmadas, de las cuales{" "}
            {entero(calidad.devoluciones)} fueron devoluciones (
            {porcentaje(calidad.pctDevoluciones)}). En ese mismo lapso quedaron aprobadas{" "}
            {entero(calidad.aprobadasEnPeriodo)} actividades: esa es la producción del período, y es
            la única cifra de este informe que se puede leer como «lo que se hizo en estas fechas».
          </Text>

          <Subseccion numero="4.1" titulo="Decisiones por revisor" />
          <Rotulo
            codigo="4.1-1"
            titulo={`Aprobaciones, devoluciones y tiempo de revisión ${
              hayPeriodo ? "en el período" : "en la obra"
            }`}
          />
          <Tabla filas={calidad.revisores.length}>
            <View style={est.tablaCab} fixed={partePagina(calidad.revisores.length)}>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Revisor</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "13%" }]}>Aprobadas</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "13%" }]}>Devueltas</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "13%" }]}>% devuelto</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "16%" }]}>
                Tarda (mediana)
              </Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "13%" }]}>Medido sobre</Text>
            </View>
            {calidad.revisores.length === 0 ? (
              <SinDatos mensaje="No hay decisiones registradas en esta obra." />
            ) : (
              calidad.revisores.map((r, i) => (
                <View
                  key={`${r.nombre}-${i}`}
                  style={i === calidad.revisores.length - 1 ? est.tablaFilaUltima : est.tablaFila}
                >
                  <Text style={[est.celda, { flex: 1 }]}>{r.nombre}</Text>
                  <Text style={[est.celda, est.celdaDer, { width: "13%" }]}>
                    {entero(r.aprobadas)}
                  </Text>
                  <Text style={[est.celda, est.celdaDer, { width: "13%" }]}>
                    {entero(r.devueltas)}
                  </Text>
                  <Text style={[est.celda, est.celdaDer, { width: "13%" }]}>
                    {r.total > 0 ? porcentaje(r.pctDevueltas) : "—"}
                  </Text>
                  <Text style={[est.celda, est.celdaDer, { width: "16%" }]}>
                    {formatearDuracionHoras(r.horasMediana)}
                  </Text>
                  <Text style={[est.celda, est.celdaDer, { width: "13%" }]}>
                    {entero(r.medibles)}
                  </Text>
                </View>
              ))
            )}
          </Tabla>
          <Text style={est.rotuloNota}>
            La tabla incluye a quien PUEDE aprobar en esta obra aunque no haya firmado nada: una
            fila en cero es un hallazgo, y una tabla construida solo con quien firmó dejaría fuera
            justo a quien se busca. El tiempo de revisión se mide únicamente sobre la PRIMERA
            decisión de cada actividad —la columna «medido sobre» dice sobre cuántas—, porque la
            marca de reporte se congela en el primer envío: usarla en un reintento cargaría al
            revisor el tiempo que el ejecutor tardó en rehacer el trabajo.
            {calidad.resumenTruncado
              ? " Aviso: el período supera el tope de decisiones del resumen y esta tabla no lo cubre entero; acote el rango de fechas para leerlo completo."
              : ""}
          </Text>

          <Subseccion numero="4.2" titulo="Devoluciones recientes y su motivo" />
          <Rotulo
            codigo="4.2-1"
            titulo={`Devoluciones halladas entre las ${entero(
              calidad.ventanaRevisada,
            )} decisiones más recientes ${hayPeriodo ? "del período" : "de la obra"}`}
          />
          <Tabla filas={calidad.devolucionesRecientes.length}>
            <View style={est.tablaCab} fixed={partePagina(calidad.devolucionesRecientes.length)}>
              <Text style={[est.tablaCabTexto, { width: "15%" }]}>Fecha</Text>
              <Text style={[est.tablaCabTexto, { width: "25%" }]}>Actividad</Text>
              <Text style={[est.tablaCabTexto, { width: "18%" }]}>Ubicación</Text>
              <Text style={[est.tablaCabTexto, { width: "16%" }]}>Devolvió</Text>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Motivo</Text>
            </View>
            {calidad.devolucionesRecientes.length === 0 ? (
              <SinDatos mensaje="No se registran devoluciones en la ventana revisada." />
            ) : (
              calidad.devolucionesRecientes.map((d, i) => (
                <View
                  key={`${d.numeroRegistro ?? d.actividad}-${i}`}
                  style={
                    i === calidad.devolucionesRecientes.length - 1
                      ? est.tablaFilaUltima
                      : est.tablaFila
                  }
                >
                  <Text style={[est.celda, { width: "15%" }]}>{fechaHoraColombia(d.fecha)}</Text>
                  <Text style={[est.celda, { width: "25%" }]}>
                    {d.numeroRegistro ? `${d.numeroRegistro} · ` : ""}
                    {recortar(d.actividad, 44)}
                  </Text>
                  <Text style={[est.celda, { width: "18%" }]}>{d.ubicacion}</Text>
                  <Text style={[est.celda, { width: "16%" }]}>{d.revisor}</Text>
                  <Text style={[est.celda, { flex: 1 }]}>
                    {d.motivo ?? "Devuelta sin motivo escrito"}
                  </Text>
                </View>
              ))
            )}
          </Tabla>
          <Text style={est.rotuloNota}>
            «Devuelta sin motivo escrito» no es un fallo de este informe: es una devolución que se
            firmó sin decir por qué, y consta como tal.
          </Text>
        </Seccion>

        {/* ── 5. GESTION ────────────────────────────────────────────────── */}
        <Seccion numero="5" titulo="ACTIVIDADES QUE REQUIEREN GESTIÓN">
          <Text style={est.parrafo}>
            Solo entra aquí lo que está DETENIDO por una causa identificable, con la regla escrita
            al lado. Una actividad pendiente de ejecutar no está detenida: está por hacer.
          </Text>

          <Subseccion numero="5.1" titulo="Devueltas y aún sin rehacer" />
          <Rotulo
            codigo="5.1-1"
            titulo={`${entero(gestion.devueltas.length)} de ${entero(
              gestion.totalDevueltas,
            )} devoluciones abiertas, las de mayor antigüedad`}
          />
          <Tabla filas={gestion.devueltas.length}>
            <View style={est.tablaCab} fixed={partePagina(gestion.devueltas.length)}>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Actividad</Text>
              <Text style={[est.tablaCabTexto, { width: "22%" }]}>Ubicación</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "14%" }]}>Días hábiles</Text>
              <Text style={[est.tablaCabTexto, { width: "24%" }]}>Responsable</Text>
            </View>
            {gestion.devueltas.length === 0 ? (
              <SinDatos mensaje="No hay actividades devueltas pendientes de rehacer." />
            ) : (
              gestion.devueltas.map((g, i) => (
                <FilaGestion
                  key={`${g.numeroRegistro ?? g.actividad}-${i}`}
                  fila={g}
                  ultima={i === gestion.devueltas.length - 1}
                />
              ))
            )}
          </Tabla>
          <Text style={est.rotuloNota}>
            Regla: actividad en estado «devuelta» a la fecha de corte. Los días se cuentan en días
            hábiles desde la última devolución firmada. Responsable: a quien está asignada la
            actividad.
          </Text>

          <Subseccion numero="5.2" titulo="Reportadas y aún sin revisar" />
          <Rotulo
            codigo="5.2-1"
            titulo={`${entero(gestion.esperandoRevision.length)} de ${entero(
              gestion.totalEsperando,
            )} actividades esperando revisión, las de mayor espera`}
          />
          <Tabla filas={gestion.esperandoRevision.length}>
            <View style={est.tablaCab} fixed={partePagina(gestion.esperandoRevision.length)}>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Actividad</Text>
              <Text style={[est.tablaCabTexto, { width: "22%" }]}>Ubicación</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "14%" }]}>Días hábiles</Text>
              <Text style={[est.tablaCabTexto, { width: "24%" }]}>Responsable</Text>
            </View>
            {gestion.esperandoRevision.length === 0 ? (
              <SinDatos mensaje="No hay actividades esperando revisión." />
            ) : (
              gestion.esperandoRevision.map((g, i) => (
                <FilaGestion
                  key={`${g.numeroRegistro ?? g.actividad}-${i}`}
                  fila={g}
                  ultima={i === gestion.esperandoRevision.length - 1}
                />
              ))
            )}
          </Tabla>
          <Text style={est.rotuloNota}>
            Regla: actividad en estado «reportada» a la fecha de corte. Los días se cuentan desde la
            marca del primer reporte. Este trabajo está hecho y no suma avance hasta que alguien lo
            firme: es la cola de la que habla la sección 4.
          </Text>

          {gestion.vencidasPlan !== null ? (
            <>
              <Subseccion numero="5.3" titulo="Vencidas respecto al plan" />
              <View style={est.nota} wrap={false}>
                <Text style={est.notaTexto}>
                  {entero(gestion.vencidasPlan)} actividades tienen su fecha de fin planeada
                  anterior a la fecha de corte y no están aprobadas. Es el único sentido en el que
                  este informe usa la palabra «vencida»: contra una línea base, nunca contra la
                  simple ausencia de aprobación.
                </Text>
              </View>
            </>
          ) : null}
        </Seccion>

        {/* ── 6. COBERTURA DOCUMENTAL ───────────────────────────────────── */}
        <Seccion numero="6" titulo="COBERTURA DOCUMENTAL">
          <Rotulo codigo="6-1" titulo="Respaldo fotográfico de lo aprobado" />
          <View style={est.tabla} wrap={false}>
            <View style={est.tablaCab}>
              <Text style={[est.tablaCabTexto, { flex: 1 }]}>Concepto</Text>
              <Text style={[est.tablaCabTexto, est.celdaDer, { width: "20%" }]}>Actividades</Text>
            </View>
            <View style={est.tablaFila}>
              <Text style={[est.celda, { flex: 1 }]}>Aprobadas a la fecha de corte</Text>
              <Text style={[est.celda, est.celdaDer, { width: "20%" }]}>
                {entero(cobertura.aprobadas)}
              </Text>
            </View>
            <View style={est.tablaFila}>
              <Text style={[est.celda, { flex: 1 }]}>
                Aprobadas con al menos una evidencia (foto o video)
              </Text>
              <Text style={[est.celda, est.celdaDer, { width: "20%" }]}>
                {entero(cobertura.aprobadasConEvidencia)}
              </Text>
            </View>
            <View style={est.tablaFilaTotal}>
              <Text style={[est.celdaFuerte, { flex: 1 }]}>Cobertura documental</Text>
              <Text style={[est.celdaFuerte, est.celdaDer, { width: "20%" }]}>
                {porcentaje(cobertura.pct, "—")}
              </Text>
            </View>
          </View>
          <Text style={est.rotuloNota}>
            {cobertura.aprobadas === 0
              ? "Todavía no hay actividades aprobadas, así que no hay universo sobre el que medir cobertura."
              : "Mide qué parte del avance aprobado tiene respaldo gráfico en el expediente. Una aprobación sin evidencia es válida en el sistema, pero no se puede auditar después."}{" "}
            Esta tabla cuenta el ACUMULADO de la obra a la fecha de corte; las fotografías del
            período, con su pie verificable, están en el anexo A.
          </Text>
        </Seccion>

        {/* ── 7. REFERENCIAS ────────────────────────────────────────────── */}
        <Seccion numero="7" titulo="REFERENCIAS DEL FORMATO">
          <View style={est.ficha} wrap={false}>
            <FilaFicha clave="Código de formato" valor={FORMATO.codigo} />
            <FilaFicha clave="Versión del formato" valor={FORMATO.version} />
            <FilaFicha clave="Código del documento" valor={codigo} />
            <FilaFicha clave="Emitido" valor={fechaHoraColombia(id.corte)} />
            <FilaFicha clave="Período del informe" valor={textoPeriodo(periodo)} />
            <FilaFicha
              clave="Fuente de los datos"
              valor="Registros de la obra en Seiricon: actividades, aprobaciones y evidencias, a la fecha de corte."
            />
            <FilaFicha
              clave="Anexos"
              valor={`Anexo A — Registro fotográfico: ${entero(
                registro.mostradas,
              )} imágenes con pie de cuatro campos y declaración de integridad.`}
            />
            <FilaFicha
              clave="Alcance"
              valor="Informe técnico de avance. No contiene información económica: ni precios, ni presupuestos, ni valor ejecutado."
              ultima
            />
          </View>

          <Subseccion numero="7.1" titulo="Definiciones empleadas" />
          <View style={est.ficha} wrap={false}>
            <FilaFicha
              clave="Período del informe"
              valor="Rango de fechas elegido por quien pide el informe. Acota lo que OCURRIÓ: decisiones, devoluciones y fotografías. No acota el estado de avance."
            />
            <FilaFicha
              clave="Fecha de corte"
              valor="Instante en que se generó el documento. El avance de las secciones 2, 3 y 5 está medido a esa fecha y es acumulado desde el inicio de la obra."
            />
            <FilaFicha
              clave="Avance ejecutado"
              valor="Actividades aprobadas ÷ actividades totales. Todas pesan igual."
            />
            <FilaFicha
              clave="Avance reportado"
              valor="Actividades aprobadas o reportadas ÷ totales. Incluye trabajo declarado y sin revisar; no es avance."
            />
            <FilaFicha
              clave="Avance programado"
              valor="Fracción de la ventana planeada de cada actividad ya transcurrida a la fecha de corte, en días hábiles. Exige línea base."
            />
            <FilaFicha
              clave="SPI"
              valor="Avance ejecutado ÷ avance programado. Menor que 1,00: la obra va detrás del plan."
            />
            <FilaFicha
              clave="Día hábil"
              valor={`Día que no cae en el descanso semanal de la obra (${entero(
                id.diasHabilesSemana,
              )} días laborables por semana) ni es festivo nacional colombiano.`}
            />
            <FilaFicha
              clave="Tiempo de revisión"
              valor="Horas entre la marca del primer reporte de una actividad y la primera decisión firmada sobre ella."
            />
            <FilaFicha
              clave="No calculable"
              valor="No hay dato suficiente para afirmar la cifra. Nunca se sustituye por cero."
              ultima
            />
          </View>

          <Text style={est.parrafoTenue}>
            Documento generado automáticamente el {fechaLarga(id.corte)} a partir de los registros
            de la obra. El código del documento identifica de forma única esta emisión: la misma
            obra a otra fecha de corte produce otro código. Cualquier cifra de este informe puede
            citarse por su sección y su tabla, y cualquier imagen por su número de foto.
          </Text>
        </Seccion>

        {/* ── ANEXO A ───────────────────────────────────────────────────────
            Va DENTRO de esta misma `<Page>` y no en una segunda: el cajetin y
            el pie son `fixed` de la pagina, asi que abrir otra obligaria a
            repetirlos y a mantener dos copias. El salto a hoja nueva lo da
            `break` en el contenedor del anexo. */}
        <RegistroFotografico data={registro} />
      </Page>
    </Document>
  );
}

// ─── Filas compuestas ───────────────────────────────────────────────────────

/** Una fila de la tabla 2.1-1: cuenta, reparte y define, todo en la misma línea. */
function FilaCredito({
  estado,
  n,
  total,
  credito,
  significado,
}: {
  estado: string;
  n: number;
  total: number;
  credito: string;
  significado: string;
}) {
  return (
    <View style={est.tablaFila}>
      <Text style={[est.celdaFuerte, { width: "16%" }]}>{estado}</Text>
      <Text style={[est.celda, est.celdaDer, { width: "13%" }]}>{entero(n)}</Text>
      <Text style={[est.celda, est.celdaDer, { width: "12%" }]}>
        {total > 0 ? porcentaje((n / total) * 100) : "—"}
      </Text>
      <Text style={[est.celda, est.celdaDer, { width: "11%" }]}>{credito}</Text>
      <Text style={[est.celda, { flex: 1 }]}>{significado}</Text>
    </View>
  );
}

/** Fila de las tablas 5.1-1 y 5.2-1: misma forma, dos causas distintas. */
function FilaGestion({ fila, ultima }: { fila: FilaGestionInforme; ultima: boolean }) {
  return (
    <View style={ultima ? est.tablaFilaUltima : est.tablaFila}>
      <Text style={[est.celda, { flex: 1 }]}>
        {fila.numeroRegistro ? `${fila.numeroRegistro} · ` : ""}
        {recortar(fila.actividad, 50)}
      </Text>
      <Text style={[est.celda, { width: "22%" }]}>{fila.ubicacion}</Text>
      <Text style={[est.celda, est.celdaDer, { width: "14%" }]}>
        {fila.dias === null ? "—" : entero(fila.dias)}
      </Text>
      <Text style={[est.celda, { width: "24%" }]}>{fila.responsable}</Text>
    </View>
  );
}
