import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfColors, pdfStyles } from "./styles";
import type {
  FotoActa,
  PayloadActaInicial,
} from "@/components/productos-tecnicos/logica/acta-estado-inicial";
import {
  ACLARACION_RECIBIDO,
  DECLARACION_PROFESIONAL,
  ETIQUETAS_ACTA,
  PIE_ALCANCE,
  SUBTITULO_ACTA,
  TEXTO_VERIFICACION,
  TITULO_ACTA,
  TITULO_ALCANCE,
  TITULO_METODOLOGIA,
  TITULO_NO_INCLUYE,
  TITULO_RECIBIDO,
  etiquetaFoto,
} from "@/components/productos-tecnicos/logica/copys-acta-inicial";

/**
 * Acta de estado inicial — línea Arquitecto.
 *
 * Patrón tomado de `ActaJuntosReport.tsx`: react-pdf, tipografías Helvetica
 * incorporadas (react-pdf NO soporta WOFF2, así que no se registra ninguna
 * fuente), imágenes con `objectFit: "contain"` para que la evidencia no se
 * recorte, y pie fijo con el sello de verificación en TODAS las páginas.
 *
 * TODA la prosa se importa de `copys-acta-inicial.ts`. No hay ni una frase
 * escrita a mano en este archivo, y es a propósito: la compuerta de lenguaje
 * —ni «peritaje», ni «dictamen pericial», ni afirmar que el inmueble sea seguro
 * o habitable— se comprueba sobre aquel módulo, y solo puede responder por el
 * documento entero si el documento entero sale de allí.
 *
 * Lo que se imprime es EXACTAMENTE el `payload` que entró en la huella SHA-256
 * del folio, más tres cosas que no podían estar dentro porque ocurren después de
 * emitir: la imagen de la firma, el momento en que se firmó y el propio sello
 * folio + huella. Las tres se comprueban por su lado —la firma y su fecha en
 * `/api/documentos/verificar`, el sello contra el registro— así que ninguna
 * necesita entrar en el hash para ser verificable.
 */

const s = StyleSheet.create({
  logo: { width: 34, height: 34, marginRight: 10 },
  headerIzq: { flexDirection: "row", alignItems: "center" },

  aviso: {
    padding: 10,
    backgroundColor: pdfColors.bgMuted,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: pdfColors.border,
    marginBottom: 16,
  },
  avisoTexto: { fontSize: 8.5, color: pdfColors.text, lineHeight: 1.45 },

  filaDato: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    paddingVertical: 4,
    gap: 8,
  },
  etiquetaDato: { width: 150, fontSize: 9, color: pdfColors.textMuted },
  valorDato: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold", color: pdfColors.text },

  bloqueLista: { marginTop: 6 },
  tituloLista: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
    marginBottom: 4,
    marginTop: 8,
  },
  itemLista: { flexDirection: "row", gap: 6, marginBottom: 3 },
  vinieta: { fontSize: 9, color: pdfColors.textMuted },
  textoLista: { flex: 1, fontSize: 9, color: pdfColors.text, lineHeight: 1.45 },

  espacioCabecera: {
    marginTop: 6,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
  },
  espacioTitulo: { fontSize: 11, fontFamily: "Helvetica-Bold", color: pdfColors.text },
  espacioUbicacion: { fontSize: 8.5, color: pdfColors.textMuted, marginTop: 2 },

  fotoFila: { flexDirection: "row", gap: 12, marginBottom: 12 },
  fotoBloque: { width: 250 },
  foto: {
    width: 250,
    height: 188,
    borderRadius: 4,
    objectFit: "contain",
    backgroundColor: pdfColors.bgMuted,
    borderWidth: 1,
    borderColor: pdfColors.border,
  },
  fotoNumero: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
    marginTop: 4,
  },
  fotoDetalle: { fontSize: 7.5, color: pdfColors.textMuted, lineHeight: 1.35, marginTop: 1 },

  declaracion: { fontSize: 9, color: pdfColors.text, lineHeight: 1.5, marginBottom: 10 },

  firmaCaja: { flexDirection: "row", gap: 24, marginTop: 18 },
  firmaColumna: { flex: 1 },
  firmaImagen: { height: 46, width: 150, objectFit: "contain", marginBottom: 2 },
  firmaEspacio: { height: 46 },
  firmaLinea: { borderTopWidth: 1, borderTopColor: pdfColors.text, paddingTop: 4 },
  firmaEtiqueta: { fontSize: 8, color: pdfColors.textMuted },
  firmaNombre: { fontSize: 9, fontFamily: "Helvetica-Bold", color: pdfColors.text, marginTop: 1 },
  firmaDetalle: { fontSize: 8, color: pdfColors.textMuted, marginTop: 1 },
  campoEtiqueta: { fontSize: 8, color: pdfColors.textMuted, marginTop: 12 },
  campoVacio: {
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    height: 14,
    marginTop: 2,
  },

  aclaracion: {
    fontSize: 7.5,
    color: pdfColors.textMuted,
    lineHeight: 1.4,
    marginTop: 10,
  },

  pieFijo: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 6,
  },
  pieAlcance: { fontSize: 7, color: pdfColors.textMuted, lineHeight: 1.3 },
  pieFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
});

/**
 * Dos fotos por fila. El ancho útil de una A4 con márgenes de 40 pt son 515;
 * dos bloques de 250 con 12 de separación caben justos y dejan la imagen lo
 * bastante grande para que una fisura se vea impresa.
 */
const FOTOS_POR_FILA = 2;

/** Parte la lista de fotos en filas del ancho de la cuadrícula. */
function enFilas<T>(items: readonly T[], porFila: number): T[][] {
  const filas: T[][] = [];
  for (let i = 0; i < items.length; i += porFila) filas.push(items.slice(i, i + porFila));
  return filas;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const MOMENTO = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function fechaLarga(iso: string): string {
  return FECHA_LARGA.format(new Date(iso));
}

function momento(iso: string): string {
  return MOMENTO.format(new Date(iso));
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={s.filaDato}>
      <Text style={s.etiquetaDato}>{etiqueta}</Text>
      <Text style={s.valorDato}>{valor}</Text>
    </View>
  );
}

function Lista({ titulo, items }: { titulo: string; items: readonly string[] }) {
  return (
    <View style={s.bloqueLista}>
      <Text style={s.tituloLista}>{titulo}</Text>
      {items.map((texto, i) => (
        <View key={i} style={s.itemLista}>
          <Text style={s.vinieta}>—</Text>
          <Text style={s.textoLista}>{texto}</Text>
        </View>
      ))}
    </View>
  );
}

/** Una fila de la cuadrícula: hasta dos fotos con su leyenda completa. */
function FilaDeFotos({
  fotos,
  imagenes,
}: {
  fotos: readonly FotoActa[];
  imagenes: Readonly<Record<string, string>>;
}) {
  return (
    <View style={s.fotoFila}>
      {fotos.map((foto) => (
        <View key={foto.productoId} style={s.fotoBloque}>
          {imagenes[foto.productoId] && <Image src={imagenes[foto.productoId]} style={s.foto} />}
          <Text style={s.fotoNumero}>{etiquetaFoto(foto.numero)}</Text>
          <Text style={s.fotoDetalle}>
            {ETIQUETAS_ACTA.ubicacionEnInmueble}: {foto.ubicacion}
          </Text>
          <Text style={s.fotoDetalle}>
            {ETIQUETAS_ACTA.tomadaEl} {momento(foto.capturadaEn)} · {ETIQUETAS_ACTA.coordenadas}:{" "}
            {foto.lat.toFixed(6)}, {foto.lng.toFixed(6)}
          </Text>
          <Text style={s.fotoDetalle}>
            {ETIQUETAS_ACTA.observacion}: {foto.nota ?? ETIQUETAS_ACTA.sinNota}
          </Text>
        </View>
      ))}
    </View>
  );
}

export interface ActaEstadoInicialReportProps {
  payload: PayloadActaInicial;
  folio: string;
  /** Los 12 hex del pie. Salen del registro, no se recalculan aquí. */
  huellaCorta: string;
  /** Data-URI del logo. `null` cae al wordmark de texto (nunca falla por el logo). */
  logoDataUrl: string | null;
  /** `productoId` → data-URI de la foto. Una foto que falte se imprime como hueco. */
  imagenes: Readonly<Record<string, string>>;
  /** Firma escaneada del profesional, si la tiene configurada. */
  firmaDataUrl: string | null;
  /** Momento legible de la firma. `null` mientras el acta esté sin firmar. */
  firmadoMomento: string | null;
}

export function ActaEstadoInicialReport({
  payload,
  folio,
  huellaCorta,
  logoDataUrl,
  imagenes,
  firmaDataUrl,
  firmadoMomento,
}: ActaEstadoInicialReportProps) {
  return (
    <Document title={`${TITULO_ACTA} — ${folio}`} author="Seiricon" creator="Seiricon">
      <Page size="A4" style={[pdfStyles.page, { paddingBottom: 64 }]}>
        <View style={pdfStyles.header}>
          <View style={s.headerIzq}>
            {logoDataUrl && <Image src={logoDataUrl} style={s.logo} />}
            <View>
              <Text style={pdfStyles.brand}>SEIRICON</Text>
              <Text style={pdfStyles.tagline}>{SUBTITULO_ACTA}</Text>
            </View>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.reportTitle}>{TITULO_ACTA}</Text>
            <Text style={pdfStyles.reportDate}>
              {ETIQUETAS_ACTA.emitida} {fechaLarga(payload.emitidaEn)}
            </Text>
            <Text style={pdfStyles.reportDate}>
              {ETIQUETAS_ACTA.folio} {folio}
            </Text>
          </View>
        </View>

        <View style={s.aviso}>
          <Text style={s.avisoTexto}>{payload.metodologia.naturaleza}</Text>
        </View>

        {/* ── Identificación del inmueble ───────────────────────────────────
            Sale de `lineasInmuebleParaDocumento()`: el mismo bloque, en el
            mismo orden, que imprimen los demás documentos del profesional.
            La matrícula inmobiliaria va aquí y es obligatoria para emitir. */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>{ETIQUETAS_ACTA.identificacion}</Text>
          {payload.inmueble.map((linea, i) => (
            <Dato key={i} etiqueta={linea.etiqueta} valor={linea.valor} />
          ))}
          <Dato etiqueta={ETIQUETAS_ACTA.obra} valor={payload.obra.nombre} />
          <Dato etiqueta={ETIQUETAS_ACTA.profesional} valor={payload.profesional.nombre} />
          {payload.profesional.matricula && (
            <Dato
              etiqueta={ETIQUETAS_ACTA.matriculaProfesional}
              valor={payload.profesional.matricula}
            />
          )}
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>{ETIQUETAS_ACTA.resumen}</Text>
          <Dato etiqueta={ETIQUETAS_ACTA.espacios} valor={String(payload.totalEspacios)} />
          <Dato etiqueta={ETIQUETAS_ACTA.fotos} valor={String(payload.totalFotos)} />
          <Dato etiqueta={ETIQUETAS_ACTA.primeraCaptura} valor={momento(payload.primeraCaptura)} />
          <Dato etiqueta={ETIQUETAS_ACTA.ultimaCaptura} valor={momento(payload.ultimaCaptura)} />
        </View>

        {/* ── Metodología ───────────────────────────────────────────────────
            La mitad de abajo —lo que NO incluye— es la que delimita la
            responsabilidad del profesional, y por eso va en la primera página
            y no en un anexo al final. */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>{TITULO_METODOLOGIA}</Text>
          <Lista titulo={TITULO_ALCANCE} items={payload.metodologia.alcance} />
          <Lista titulo={TITULO_NO_INCLUYE} items={payload.metodologia.noIncluye} />
        </View>

        {/* ── Registro fotográfico ────────────────────────────────────────
            Va en el MISMO `Page` que lo anterior y no en uno nuevo: con un
            `Page` aparte, el documento se llevaba media página en blanco cada
            vez que la metodología no terminaba justo al final de la hoja. El
            contenido fluye y react-pdf corta donde toca.

            El corte de página se controla con `wrap={false}` sobre bloques
            explícitos, no con `minPresenceAhead`: probado con este mismo
            documento, `minPresenceAhead` no movía nada —el PDF salía byte por
            byte idéntico con 250 y con 350—, así que el encabezado de un
            espacio seguía quedándose solo al pie de una página con sus fotos en
            la siguiente. Agrupar el encabezado con su primera fila de fotos sí
            lo garantiza. */}
        <Text style={pdfStyles.sectionTitle}>{ETIQUETAS_ACTA.registroFotografico}</Text>

        {payload.espacios.map((espacio) => {
          const filas = enFilas(espacio.fotos, FOTOS_POR_FILA);
          const [primera, ...resto] = filas;

          return (
            <View key={espacio.espacioId} style={pdfStyles.section}>
              {/* El nombre del espacio nunca viaja solo: va pegado a su primera
                  fila de fotos, y las dos cosas se mueven juntas de página. */}
              <View wrap={false}>
                <View style={s.espacioCabecera}>
                  <Text style={s.espacioTitulo}>{espacio.nombre}</Text>
                  <Text style={s.espacioUbicacion}>
                    {ETIQUETAS_ACTA.ubicacionEnInmueble}: {espacio.ubicacion}
                  </Text>
                </View>
                <FilaDeFotos fotos={primera} imagenes={imagenes} />
              </View>

              {resto.map((fila, i) => (
                <View key={i} wrap={false}>
                  <FilaDeFotos fotos={fila} imagenes={imagenes} />
                </View>
              ))}
            </View>
          );
        })}

        {/* ── Firmas ─────────────────────────────────────────────────────────
            El «recibido conforme» del cliente también se puede dejar en línea,
            por el enlace sin cuenta. Este bloque impreso es para cuando el acta
            se entrega en papel; la aclaración de qué significa va en los dos
            sitios, con las mismas palabras. */}
        <View wrap={false} style={{ marginTop: 10 }}>
          <Text style={s.declaracion}>{DECLARACION_PROFESIONAL}</Text>

          <View style={s.firmaCaja}>
            <View style={s.firmaColumna}>
              {firmaDataUrl ? (
                <Image src={firmaDataUrl} style={s.firmaImagen} />
              ) : (
                <View style={s.firmaEspacio} />
              )}
              <View style={s.firmaLinea}>
                <Text style={s.firmaEtiqueta}>{ETIQUETAS_ACTA.firmaProfesional}</Text>
                <Text style={s.firmaNombre}>{payload.profesional.nombre}</Text>
                {payload.profesional.matricula && (
                  <Text style={s.firmaDetalle}>
                    {ETIQUETAS_ACTA.matriculaProfesional}: {payload.profesional.matricula}
                  </Text>
                )}
                {firmadoMomento && <Text style={s.firmaDetalle}>{firmadoMomento}</Text>}
              </View>
            </View>

            <View style={s.firmaColumna}>
              <View style={s.firmaEspacio} />
              <View style={s.firmaLinea}>
                <Text style={s.firmaEtiqueta}>{TITULO_RECIBIDO}</Text>
                <Text style={s.campoEtiqueta}>{ETIQUETAS_ACTA.nombreQuienRecibe}</Text>
                <View style={s.campoVacio} />
                <Text style={s.campoEtiqueta}>{ETIQUETAS_ACTA.documentoQuienRecibe}</Text>
                <View style={s.campoVacio} />
                <Text style={s.campoEtiqueta}>
                  {ETIQUETAS_ACTA.fechaRecibido} · {ETIQUETAS_ACTA.firmaQuienRecibe}
                </Text>
                <View style={s.campoVacio} />
              </View>
            </View>
          </View>

          <Text style={s.aclaracion}>{ACLARACION_RECIBIDO}</Text>
        </View>

        <PieFijo folio={folio} huellaCorta={huellaCorta} />
      </Page>
    </Document>
  );
}

/** El sello de verificación, en el pie de CADA página. */
function PieFijo({ folio, huellaCorta }: { folio: string; huellaCorta: string }) {
  return (
    <View style={s.pieFijo} fixed>
      <Text style={s.pieAlcance}>{PIE_ALCANCE}</Text>
      <View style={s.pieFila}>
        <Text style={pdfStyles.footerText}>
          {TEXTO_VERIFICACION} · {folio} · {huellaCorta}
        </Text>
        <Text
          style={pdfStyles.footerText}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </View>
    </View>
  );
}
