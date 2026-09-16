// ---------------------------------------------------------------------------
// ANEXO A — REGISTRO FOTOGRAFICO del informe de avance.
//
// == POR QUE UN ANEXO Y NO UNA SECCION MAS =================================
//
// Las secciones 1 a 7 del informe ya tienen direccion citable («Tabla 4.2-1»)
// y esa direccion vive en correos y actas. Meter el registro entre la 6 y la 7
// habria corrido la numeracion de REFERENCIAS y roto todas las citas emitidas
// hasta hoy. En los informes de interventoria reales el registro fotografico
// es SIEMPRE un anexo al final, asi que la convencion y la compatibilidad
// apuntan al mismo sitio.
//
// == QUE LO HACE ADMISIBLE, Y NO UN ALBUM ==================================
//
// Se estudiaron informes de interventoria colombianos. Lo que separa un
// registro que un interventor firma de una carpeta de fotos son cinco cosas, y
// aqui estan las cinco:
//
//   1. PIE DE CUATRO CAMPOS: actividad, ubicacion, autor y fecha, estado. El
//      mejor informe real que se encontro los escribia A MANO; aqui los genera
//      el sistema desde los registros de la obra, asi que son verificables uno
//      a uno contra la base de datos.
//   2. NUMERACION correlativa y unica por imagen. «Foto 017» es una direccion:
//      se puede citar en un acta sin adjuntar nada.
//   3. Agrupadas por UBICACION —espacio, luego fase, luego actividad— y no por
//      fecha. Quien revisa camina la obra, no el calendario.
//   4. DECLARACION DE INTEGRIDAD al abrir: quien pone la hora, quien firma el
//      autor y que no se toca la imagen. Es el parrafo que permite a un
//      interventor firmar debajo sin estar afirmando nada que no le conste.
//   5. FIRMAS al pie: quien reporto y quien reviso.
//
// == EL TOPE NO ES UNA LIMITACION, ES PARTE DEL DOCUMENTO ==================
//
// La obra de referencia tiene 3.348 fotos. Un PDF con todas ni se genera
// —memoria— ni se abre —peso— ni se lee: un registro sin tope es exactamente
// igual de inutil que no tener registro. Por eso hay dos topes, el documento
// DICE cuantas imagenes muestra de cuantas hay, y el usuario tiene la salida a
// mano: acotar el periodo, que es justo la funcion que acompaña a esta.
//
// == TRAMPAS DE @react-pdf/renderer ========================================
//
//   · `<Image>` SOLO dibuja JPEG y PNG. Con cualquier otra cosa LANZA, y una
//     excepcion aqui no deja un hueco: tumba la generacion del informe entero.
//     Por eso la ruta manda `imagen: null` en vez de una fuente dudosa, y aqui
//     el hueco se pinta con su numero puesto —una imagen que falta tiene que
//     VERSE que falta, o el registro miente por omision—.
//   · No hay `grid`. Las dos columnas se arman a mano, en filas de dos, con
//     anchos calculados desde el ancho util de la hoja.
//   · Cada bloque de foto va con `wrap={false}`: una imagen en una pagina y su
//     pie en la siguiente es un pie de foto huerfano, que en un documento que
//     se firma es peor que no tener pie.
// ---------------------------------------------------------------------------

import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  entero,
  estilosInforme as est,
  fechaDMA,
  fechaHoraColombia,
  MARGEN_LATERAL,
  tinta,
} from "./estilos-informe";

// ─── Contrato de datos ──────────────────────────────────────────────────────
// Igual que el resto del informe: todo llega decidido desde la ruta. Este
// fichero no consulta, no firma URLs y no elige que foto entra.

export interface FotoRegistro {
  /**
   * Numero correlativo dentro de ESTE documento. Lo asigna la ruta y es unico:
   * es la direccion por la que se cita una imagen.
   */
  numero: number;
  /**
   * JPEG o PNG en data-URI, ya descargado y comprobado. `null` cuando no se
   * pudo traer o su formato no es dibujable: entonces se pinta el hueco con el
   * numero puesto, que es lo unico honesto.
   */
  imagen: string | null;
  /** Lo escrito en `Evidencia.timestamp_captura`. */
  fecha: Date;
  /**
   * `true` si esa hora la puso el reloj del SERVIDOR al recibir la evidencia.
   * `false` = subida diferida desde la cola sin señal: la hora es la que
   * declaro el dispositivo. La diferencia se declara en el pie de foto.
   */
  horaDeServidor: boolean;
  autor: string;
}

export interface ActividadRegistro {
  numeroRegistro: string | null;
  nombre: string;
  fase: string;
  /** Orden de la fase en la obra: gobierna el orden dentro de la ubicacion. */
  ordenFase: number;
  /** Ubicacion completa, ya compuesta: «Torre 2 · P3 · Apto 302 · Baño». */
  ubicacion: string;
  estado: "PENDIENTE" | "REPORTADA" | "APROBADA" | "NO_APROBADA";
  /** Ultima decision firmada sobre la actividad. `null` si nadie firmo aun. */
  decision: { estado: "APROBADA" | "NO_APROBADA"; fecha: Date; firmante: string } | null;
  /** Fotos de esta actividad DENTRO del periodo, incluidas las que no entraron. */
  fotosEnPeriodo: number;
  /** Las que si entraron, en orden de captura ascendente. */
  fotos: FotoRegistro[];
}

export interface GrupoUbicacion {
  ubicacion: string;
  actividades: ActividadRegistro[];
}

export interface RegistroFotograficoData {
  grupos: GrupoUbicacion[];
  /** Imagenes con numero asignado en este anexo. */
  mostradas: number;
  /** Fotografias registradas en el periodo, entren o no. */
  totalEnPeriodo: number;
  /** Videos del periodo. No se incrustan en un PDF; se declaran. */
  videosEnPeriodo: number;
  /** De las mostradas, cuantas salieron como hueco. */
  noIncrustadas: number;
  topePorActividad: number;
  topeDocumento: number;
  /** Nombre y cargo de quien pidio el informe: firma la compilacion. */
  compiladoPor: string;
  cargoCompilador: string;
  /** Fecha de corte del informe, para la fila de compilacion. */
  corte: Date;
}

// ─── Geometria ──────────────────────────────────────────────────────────────
//
// Carta vertical son 612pt de ancho. Quitados los dos margenes quedan 516pt de
// area util, que es el mismo ancho que ocupan las tablas del informe: las dos
// columnas de fotos tienen que alinearse con ellas o el anexo parece pegado de
// otro documento.

const ANCHO_HOJA = 612;
const ANCHO_UTIL = ANCHO_HOJA - 2 * MARGEN_LATERAL; // 516
const GOTERA = 14;
const ANCHO_BLOQUE = (ANCHO_UTIL - GOTERA) / 2; // 251
/**
 * Alto del marco, no de la imagen. Las fotos de obra llegan en horizontal y en
 * vertical mezcladas; con un alto fijo y `objectFit: contain` las dos caben sin
 * deformarse y todas las filas miden lo mismo, que es lo que permite calcular
 * cuantas entran por pagina. 168pt deja dos filas completas por hoja.
 */
const ALTO_MARCO = 168;

const s = StyleSheet.create({
  anexo: {
    marginTop: 0,
  },
  tituloAnexo: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: tinta.texto,
    letterSpacing: 0.4,
    borderBottomWidth: 0.8,
    borderBottomColor: tinta.linea,
    paddingBottom: 3,
    marginBottom: 6,
  },

  // ── Encabezado de una ubicacion ─────────────────────────────────────────
  // Barra gris con el mismo tono que la cabecera de las tablas: el anexo y el
  // cuerpo del informe comparten jerarquia visual.
  ubicacion: {
    backgroundColor: tinta.fondoCab,
    borderWidth: 0.8,
    borderColor: tinta.linea,
    paddingHorizontal: 6,
    paddingVertical: 3.5,
    marginTop: 10,
    marginBottom: 5,
  },
  ubicacionTexto: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.4,
    color: tinta.texto,
  },

  // ── Encabezado de una actividad dentro de la ubicacion ──────────────────
  actividad: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: tinta.suave,
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  actividadNota: {
    fontSize: 6.5,
    color: tinta.tenue,
    marginBottom: 3,
  },

  // ── Rejilla ─────────────────────────────────────────────────────────────
  fila: {
    flexDirection: "row",
    marginBottom: GOTERA,
  },
  bloque: {
    width: ANCHO_BLOQUE,
    borderWidth: 0.8,
    borderColor: tinta.linea,
  },
  bloqueSegundo: {
    width: ANCHO_BLOQUE,
    borderWidth: 0.8,
    borderColor: tinta.linea,
    marginLeft: GOTERA,
  },
  marco: {
    height: ALTO_MARCO,
    backgroundColor: tinta.fondoClave,
    borderBottomWidth: 0.8,
    borderBottomColor: tinta.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  imagen: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  hueco: {
    fontSize: 7,
    color: tinta.tenue,
    textAlign: "center",
    paddingHorizontal: 10,
    lineHeight: 1.35,
  },

  // ── Pie de cuatro campos ────────────────────────────────────────────────
  pie: {
    paddingHorizontal: 5,
    paddingTop: 3.5,
    paddingBottom: 4,
  },
  pieNumero: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    color: tinta.texto,
    marginBottom: 2,
  },
  pieFila: {
    flexDirection: "row",
    marginTop: 1,
  },
  pieClave: {
    width: 40,
    fontSize: 5.8,
    fontFamily: "Helvetica-Bold",
    color: tinta.tenue,
    letterSpacing: 0.2,
    lineHeight: 1.3,
  },
  pieValor: {
    flex: 1,
    fontSize: 5.8,
    color: tinta.texto,
    lineHeight: 1.3,
  },
});

// ─── Utilidades de presentacion ─────────────────────────────────────────────

/**
 * Recorta a lo ancho de la columna y avisa con puntos suspensivos.
 *
 * Vive aqui y no en `ProgresoReport` porque la dependencia va en ese sentido
 * —el informe importa este anexo, no al reves— y tenerla duplicada en los dos
 * ficheros es como se acaba con dos recortes distintos en el mismo documento.
 */
export function recortar(valor: string, maximo: number): string {
  const limpio = valor.trim();
  if (limpio.length <= maximo) return limpio;
  return `${limpio.slice(0, maximo - 1).trimEnd()}…`;
}

/** «Foto 007». Tres cifras para que la lista quede alineada hasta la 999. */
function etiquetaFoto(numero: number): string {
  return `FOTO ${String(numero).padStart(3, "0")}`;
}

/**
 * El cuarto campo del pie: en que estado quedo la actividad y QUIEN lo firmo.
 *
 * El estado de la actividad y su ultima decision pueden no coincidir —una
 * devuelta que se vuelve a reportar sigue teniendo como ultima decision una
 * devolucion—, y en ese caso se dice lo uno y lo otro en vez de elegir. Un pie
 * que dijera «Devuelta» sobre una actividad que ya se rehizo estaria describiendo
 * un pasado como si fuera el presente.
 */
function textoEstado(a: ActividadRegistro): string {
  const firma = a.decision
    ? `${a.decision.firmante} · ${fechaHoraColombia(a.decision.fecha)}`
    : null;

  if (a.estado === "APROBADA") {
    return a.decision && a.decision.estado === "APROBADA"
      ? `Aprobada por ${firma}`
      : "Aprobada · sin decisión firmada en el expediente";
  }
  if (a.estado === "NO_APROBADA") {
    return a.decision && a.decision.estado === "NO_APROBADA"
      ? `Devuelta por ${firma}`
      : "Devuelta · sin decisión firmada en el expediente";
  }
  if (a.estado === "REPORTADA") {
    if (!a.decision) return "Reportada · esperando revisión. No suma avance.";
    return `Reportada de nuevo · esperando revisión. Última decisión: ${
      a.decision.estado === "APROBADA" ? "aprobada" : "devuelta"
    } el ${fechaDMA(a.decision.fecha)}.`;
  }
  return "Pendiente · sin reportar. No suma avance.";
}

/** Parte una lista en filas de dos: en react-pdf la rejilla se arma a mano. */
function enParejas<T>(xs: T[]): T[][] {
  const filas: T[][] = [];
  for (let i = 0; i < xs.length; i += 2) filas.push(xs.slice(i, i + 2));
  return filas;
}

// ─── Piezas ─────────────────────────────────────────────────────────────────

function CampoPie({ clave, valor }: { clave: string; valor: string }) {
  return (
    <View style={s.pieFila}>
      <Text style={s.pieClave}>{clave}</Text>
      <Text style={s.pieValor}>{valor}</Text>
    </View>
  );
}

/**
 * Una foto con su pie de cuatro campos.
 *
 * `wrap={false}`: imagen y pie viajan juntos a la pagina siguiente o no viajan.
 */
function BloqueFoto({
  foto,
  actividad,
  segundo,
}: {
  foto: FotoRegistro;
  actividad: ActividadRegistro;
  segundo: boolean;
}) {
  return (
    <View style={segundo ? s.bloqueSegundo : s.bloque} wrap={false}>
      <View style={s.marco}>
        {foto.imagen ? (
          <Image src={foto.imagen} style={s.imagen} />
        ) : (
          <Text style={s.hueco}>
            Imagen no incrustada{"\n"}El archivo no estaba disponible o su formato no es
            imprimible. El registro conserva su número.
          </Text>
        )}
      </View>
      <View style={s.pie}>
        <Text style={s.pieNumero}>{etiquetaFoto(foto.numero)}</Text>
        <CampoPie
          clave="Actividad"
          valor={`${actividad.numeroRegistro ? `${actividad.numeroRegistro} · ` : ""}${recortar(
            actividad.nombre,
            42,
          )} · Fase: ${recortar(actividad.fase, 22)}`}
        />
        <CampoPie clave="Ubicación" valor={recortar(actividad.ubicacion, 62)} />
        <CampoPie
          clave="Autor"
          valor={`${recortar(foto.autor, 34)} · ${fechaHoraColombia(foto.fecha)} · ${
            foto.horaDeServidor ? "hora del servidor" : "hora declarada (subida diferida)"
          }`}
        />
        <CampoPie clave="Estado" valor={textoEstado(actividad)} />
      </View>
    </View>
  );
}

function Fila({
  pareja,
  actividad,
}: {
  pareja: FotoRegistro[];
  actividad: ActividadRegistro;
}) {
  return (
    <View style={s.fila}>
      {pareja.map((foto, j) => (
        <BloqueFoto key={foto.numero} foto={foto} actividad={actividad} segundo={j === 1} />
      ))}
    </View>
  );
}

/**
 * Cuanto espacio tiene que quedar DEBAJO de un rotulo para que valga la pena
 * escribirlo en esta hoja: su nota y la primera fila de fotos.
 *
 * ── POR QUE `minPresenceAhead` Y NO UN BLOQUE `wrap={false}` ───────────────
 *
 * Lo natural seria meter rotulo y primera fila en un solo `<View wrap={false}>`
 * para que viajen juntos. Se probo, se renderizo y SALIO MAL: cuando ese
 * bloque de ~270pt no cabia en lo que quedaba de hoja, react-pdf no lo empujo
 * a la pagina siguiente — lo COMPRIMIO. El informe de prueba paso de 11 a 9
 * paginas y tres fotos acabaron dibujadas unas encima de otras, con los pies
 * superpuestos e ilegibles. Un `wrap={false}` grande no es una promesa de que
 * el bloque se mueve entero: es una promesa de que no se parte, y el motor la
 * cumple aplastandolo.
 *
 * `minPresenceAhead` si funciona, PERO con una condicion que se aprendio
 * renderizando: el motor solo adelanta el salto si el nodo tiene hermanos
 * ANTERIORES dentro de su propio contenedor —`breakingImprovesPresence`, que
 * razona «si ya esta arriba del todo, saltar no lo mejora»—. Un rotulo que sea
 * el PRIMER hijo de un `<View>` propio nunca salta, por mucho hueco que pida:
 * asi es como la barra «TORRE 2 · P3 · APTO 302» se quedo sola al pie de la
 * pagina 6 con sus fotos en la 7.
 *
 * Por eso el registro se emite PLANO —barra, rotulo, nota y filas como
 * hermanos directos del anexo— en vez de anidado por grupo y actividad. Los
 * unicos `wrap={false}` que quedan son los de UNA foto (223pt), que es el
 * tamaño con el que esto ya funcionaba.
 */
const ESPACIO_TRAS_ROTULO = ALTO_MARCO + 105;
/** Igual, mas el alto de la barra de ubicacion y su aire. */
const ESPACIO_TRAS_UBICACION = ESPACIO_TRAS_ROTULO + 35;

/** «Fotos 012–014» o «Foto 012»: el rango citable de una actividad. */
function rangoDeFotos(a: ActividadRegistro): string {
  const primera = a.fotos[0]?.numero;
  const ultima = a.fotos[a.fotos.length - 1]?.numero;
  if (primera === undefined) return "";
  return primera === ultima
    ? `Foto ${String(primera).padStart(3, "0")}`
    : `Fotos ${String(primera).padStart(3, "0")}–${String(ultima).padStart(3, "0")}`;
}

/**
 * El registro entero como una lista PLANA de nodos hermanos.
 *
 * No es una preferencia de estilo: es lo que hace que `minPresenceAhead`
 * funcione (ver arriba). La jerarquia ubicacion → actividad → fotos sigue
 * existiendo, pero la expresan la barra gris y los rotulos, no el anidamiento.
 */
function nodosDelRegistro(grupos: GrupoUbicacion[]): React.ReactNode[] {
  const nodos: React.ReactNode[] = [];

  grupos.forEach((grupo, g) => {
    nodos.push(
      <View
        key={`u-${g}`}
        style={s.ubicacion}
        minPresenceAhead={ESPACIO_TRAS_UBICACION}
        wrap={false}
      >
        <Text style={s.ubicacionTexto}>{recortar(grupo.ubicacion.toUpperCase(), 92)}</Text>
      </View>,
    );

    grupo.actividades.forEach((a, i) => {
      const hayNota = a.fotosEnPeriodo > a.fotos.length;
      nodos.push(
        <Text
          key={`r-${g}-${i}`}
          style={s.actividad}
          // Sin nota debajo, el rotulo necesita reservar un poco menos: la
          // primera fila de fotos empieza doce puntos antes.
          minPresenceAhead={hayNota ? ESPACIO_TRAS_ROTULO : ESPACIO_TRAS_ROTULO - 12}
        >
          {rangoDeFotos(a)} · {a.numeroRegistro ? `${a.numeroRegistro} · ` : ""}
          {recortar(a.nombre, 62)}
        </Text>,
      );
      if (hayNota) {
        nodos.push(
          <Text
            key={`n-${g}-${i}`}
            style={s.actividadNota}
            minPresenceAhead={ESPACIO_TRAS_ROTULO - 24}
          >
            Se muestran {entero(a.fotos.length)} de {entero(a.fotosEnPeriodo)} fotografías de esta
            actividad en el período; el resto queda en el expediente digital.
          </Text>,
        );
      }
      enParejas(a.fotos).forEach((pareja, j) => {
        nodos.push(<Fila key={`f-${g}-${i}-${j}`} pareja={pareja} actividad={a} />);
      });
    });
  });

  return nodos;
}

// ─── El anexo ───────────────────────────────────────────────────────────────

/**
 * Se renderiza DENTRO de la `<Page>` del informe, no como pagina aparte: asi
 * hereda el cajetin y el pie fijos sin repetirlos. `break` en el contenedor lo
 * empuja a hoja nueva, que es lo que un anexo necesita.
 */
export function RegistroFotografico({ data }: { data: RegistroFotograficoData }) {
  const hayFotos = data.mostradas > 0;

  return (
    <View style={s.anexo} break>
      <Text style={s.tituloAnexo}>ANEXO A — REGISTRO FOTOGRÁFICO</Text>

      {/* ── A.1 Declaracion de integridad ───────────────────────────────── */}
      <Text style={est.tituloSubseccion}>A.1 Declaración de integridad</Text>
      <View style={est.nota}>
        <Text style={est.notaTitulo}>CÓMO SE CONSTRUYÓ ESTE REGISTRO</Text>
        <Text style={est.notaTexto}>
          Las imágenes se tomaron del expediente digital de la obra en el momento de generar este
          documento y se incrustan tal como fueron cargadas: no se retocan, no se recortan y no se
          reencuadran. La fecha y la hora de cada pie es la que el reloj del SERVIDOR escribió al
          recibir la evidencia; la hora del dispositivo se envía únicamente para contrastarla y no
          se guarda. La excepción es la evidencia capturada sin señal y subida después desde la cola
          fuera de línea: en ese caso la hora es la declarada por el dispositivo, y el pie lo dice
          con «hora declarada (subida diferida)». Esa distinción se establece comparando la marca de
          captura con la de ingreso del registro. El autor es el usuario autenticado —o el maestro
          de obra identificado por su token personal de acceso— que realizó la carga: en este
          sistema no existe la carga anónima. El estado de cada actividad y el nombre de quien lo
          firmó provienen de la tabla de aprobaciones de la obra, no de un texto escrito al pie de
          la foto. La numeración es correlativa y única dentro de este documento, identificado por
          su código en el cajetín: «Foto 017» de este informe cita una imagen concreta.
        </Text>
      </View>

      {/* ── A.2 El registro ──────────────────────────────────────────────── */}
      <Text style={est.tituloSubseccion}>A.2 Registro por ubicación</Text>
      <Text style={est.parrafo}>
        {hayFotos
          ? `Se incluyen ${entero(data.mostradas)} de ${entero(
              data.totalEnPeriodo,
            )} fotografías registradas en el período. Las imágenes se agrupan por ubicación —espacio, fase y actividad—, no por fecha: quien revisa recorre la obra, no el calendario.`
          : `No se registraron fotografías en el período informado. El expediente conserva las evidencias de otros períodos; para verlas, amplíe o desplace el rango de fechas del informe.`}
      </Text>
      {hayFotos ? (
        <Text style={est.rotuloNota}>
          Topes del documento: hasta {entero(data.topePorActividad)} imágenes por actividad y{" "}
          {entero(data.topeDocumento)} en total. No son un límite del expediente sino del papel: un
          PDF sin tope no se genera, no se abre y no se lee. Cuando el período supera el tope se
          conservan las fotografías MÁS RECIENTES; para ver las demás, acote el período.
          {data.videosEnPeriodo > 0
            ? ` En el período constan además ${entero(
                data.videosEnPeriodo,
              )} evidencias en video, que no se incrustan en un documento impreso y permanecen en el expediente digital.`
            : ""}
          {data.noIncrustadas > 0
            ? ` ${entero(
                data.noIncrustadas,
              )} imágenes seleccionadas no pudieron incrustarse —archivo no disponible o formato no imprimible— y figuran como hueco con su número puesto: una imagen que falta tiene que verse que falta.`
            : ""}
        </Text>
      ) : null}

      {nodosDelRegistro(data.grupos)}

      {/* ── A.3 Constancia ───────────────────────────────────────────────── */}
      <Text style={est.tituloSubseccion}>A.3 Constancia del registro</Text>
      <Text style={est.rotulo}>Tabla A.3-1 — Compilación, reporte y revisión del registro</Text>
      <View style={est.tabla} wrap={false}>
        <View style={est.tablaCab}>
          <Text style={[est.tablaCabTexto, { width: "26%" }]}>Actuación</Text>
          <Text style={[est.tablaCabTexto, { flex: 1 }]}>Nombre</Text>
          <Text style={[est.tablaCabTexto, { flex: 1 }]}>Cargo</Text>
          <Text style={[est.tablaCabTexto, { width: "15%" }]}>Fecha</Text>
          <Text style={[est.tablaCabTexto, { width: "18%" }]}>Firma</Text>
        </View>
        {/* La COMPILACION es lo unico que el sistema puede firmar: quien pidio
            el informe y cuando. Reporte y revision son actuaciones humanas y
            van en blanco — rellenarlas automaticamente convertiria la
            constancia en un sello, que es lo contrario de una constancia. */}
        <View style={est.tablaFila}>
          <Text style={[est.celdaFuerte, { width: "26%" }]}>Compiló el registro</Text>
          <Text style={[est.celda, { flex: 1 }]}>{data.compiladoPor}</Text>
          <Text style={[est.celda, { flex: 1 }]}>{data.cargoCompilador}</Text>
          <Text style={[est.celda, { width: "15%" }]}>{fechaDMA(data.corte)}</Text>
          <Text style={[est.celda, { width: "18%" }]}>Generado por Seiricon</Text>
        </View>
        <View style={est.tablaFila}>
          <Text style={[est.celdaFuerte, { width: "26%" }]}>Reportó (ejecutor)</Text>
          <LineaFirma ancho={{ flex: 1 }} />
          <LineaFirma ancho={{ flex: 1 }} />
          <LineaFirma ancho="15%" />
          <LineaFirma ancho="18%" />
        </View>
        <View style={est.tablaFilaUltima}>
          <Text style={[est.celdaFuerte, { width: "26%" }]}>Revisó y aprobó</Text>
          <LineaFirma ancho={{ flex: 1 }} />
          <LineaFirma ancho={{ flex: 1 }} />
          <LineaFirma ancho="15%" />
          <LineaFirma ancho="18%" />
        </View>
      </View>
      <Text style={est.rotuloNota}>
        Quien firma como «reportó» declara que las actividades documentadas fueron ejecutadas por su
        equipo en las ubicaciones y fechas que consta en cada pie. Quien firma como «revisó y
        aprobó» declara haberlas verificado en obra. Ninguna de las dos firmas la puede poner el
        sistema.
      </Text>
    </View>
  );
}

/**
 * Celda en blanco para firmar a mano. El ancho se pasa igual que en la cabecera
 * de la tabla —`flex` o porcentaje— porque en react-pdf no hay `colspan` ni
 * nada que alinee las columnas por ti.
 */
function LineaFirma({ ancho }: { ancho: string | { flex: number } }) {
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
