import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfColors, formatDate } from "./styles";
import type { DerechoPeticionPayload } from "@/lib/juntos/derecho-peticion";

/**
 * Derecho de petición — línea «Juntos» (spec-go-juntos.md, sección «Derecho
 * de petición»). Plantilla formal en ejercicio del artículo 23 de la
 * Constitución Política: dirigido a la alcaldía de la ciudad del
 * peticionario, identifica a la persona (nombre, cédula), narra los hechos
 * (sismo del 10 de agosto de 2026, dirección del inmueble, resumen de daños
 * tomado del acta), solicita la inclusión en el censo de damnificados (RUD)
 * y la evaluación técnica de la vivienda, y anexa el acta.
 *
 * Los datos personales SOLO existen en el request y en este PDF (regla dura
 * del spec: no se persisten ni se loguean).
 */

const dpStyles = StyleSheet.create({
  logo: { width: 30, height: 30, marginRight: 10 },
  headerIzq: { flexDirection: "row", alignItems: "center" },
  lugarFecha: { fontSize: 10, marginBottom: 16 },
  destinatario: { fontSize: 10, lineHeight: 1.5, marginBottom: 14 },
  destinatarioNombre: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  referencia: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 14, lineHeight: 1.5 },
  parrafo: { fontSize: 10, lineHeight: 1.6, marginBottom: 10, textAlign: "justify" },
  subtitulo: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 6 },
  itemNumerado: { flexDirection: "row", gap: 6, marginBottom: 6 },
  itemNumero: { width: 14, fontSize: 10, fontFamily: "Helvetica-Bold" },
  itemTexto: { flex: 1, fontSize: 10, lineHeight: 1.55, textAlign: "justify" },
  danoFila: {
    flexDirection: "row",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    paddingVertical: 4,
    marginLeft: 20,
  },
  danoEspacio: { width: 120, fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  danoDetalle: { flex: 1, fontSize: 9.5, color: pdfColors.textMuted },
  firmaLinea: {
    width: 220,
    borderTopWidth: 1,
    borderTopColor: pdfColors.text,
    paddingTop: 4,
    marginTop: 42,
  },
  firmaNombre: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  firmaDetalle: { fontSize: 9, color: pdfColors.textMuted, marginTop: 1 },
  footerFijo: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 6,
  },
  footerNota: { fontSize: 7, color: pdfColors.textMuted, lineHeight: 1.3 },
  footerFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
});

export interface DerechoPeticionReportProps {
  data: DerechoPeticionPayload;
  folio: string;
  hashCorto: string;
  logoDataUrl: string | null;
}

export function DerechoPeticionReport({ data, folio, hashCorto, logoDataUrl }: DerechoPeticionReportProps) {
  const hoy = new Date();
  const { identidad, danos, folioActa } = data;

  return (
    <Document title="Derecho de petición — Seiricon Juntos" author="Seiricon" creator="Seiricon">
      <Page size="A4" style={[pdfStyles.page, { paddingBottom: 64 }]}>
        <View style={[pdfStyles.header, { marginBottom: 18 }]}>
          <View style={dpStyles.headerIzq}>
            {logoDataUrl && <Image src={logoDataUrl} style={dpStyles.logo} />}
            <View>
              <Text style={pdfStyles.brand}>SEIRICON</Text>
              <Text style={pdfStyles.tagline}>Juntos — plantilla de derecho de petición</Text>
            </View>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.reportTitle}>Derecho de petición</Text>
            <Text style={pdfStyles.reportDate}>Folio {folio}</Text>
          </View>
        </View>

        <Text style={dpStyles.lugarFecha}>
          {identidad.ciudad}, {formatDate(hoy)}
        </Text>

        <View style={dpStyles.destinatario}>
          <Text style={dpStyles.destinatarioNombre}>Señores</Text>
          <Text style={dpStyles.destinatarioNombre}>Alcaldía de {identidad.ciudad}</Text>
          <Text>Oficina o Secretaría de Gestión del Riesgo de Desastres</Text>
          <Text>{identidad.ciudad}</Text>
        </View>

        <Text style={dpStyles.referencia}>
          Referencia: Derecho de petición (artículo 23 de la Constitución Política) — solicitud de inclusión en el
          censo de damnificados (Registro Único de Damnificados) y de evaluación técnica de vivienda afectada por el
          sismo del 10 de agosto de 2026.
        </Text>

        <Text style={dpStyles.parrafo}>
          Yo, {identidad.nombre}, identificado(a) con cédula de ciudadanía No. {identidad.cedula}, en ejercicio del
          derecho de petición consagrado en el artículo 23 de la Constitución Política de Colombia, me dirijo
          respetuosamente a su despacho con fundamento en los siguientes
        </Text>

        <Text style={dpStyles.subtitulo}>HECHOS</Text>
        <View style={dpStyles.itemNumerado}>
          <Text style={dpStyles.itemNumero}>1.</Text>
          <Text style={dpStyles.itemTexto}>
            El 10 de agosto de 2026 se presentó el sismo que afectó a varios municipios del suroccidente del país,
            entre ellos {identidad.ciudad}.
          </Text>
        </View>
        <View style={dpStyles.itemNumerado}>
          <Text style={dpStyles.itemNumero}>2.</Text>
          <Text style={dpStyles.itemTexto}>
            Como consecuencia del sismo, el inmueble ubicado en {identidad.direccion}, {identidad.ciudad}, en el que
            habito / del que soy responsable, sufrió daños que registré fotográficamente con fecha, hora y ubicación
            {folioActa
              ? ` en el acta de documentación de daños con folio ${folioActa}, que anexo a esta petición.`
              : " en el acta de documentación de daños que anexo a esta petición."}
          </Text>
        </View>
        <View style={dpStyles.itemNumerado}>
          <Text style={dpStyles.itemNumero}>3.</Text>
          <Text style={dpStyles.itemTexto}>Los daños declarados, espacio por espacio, son los siguientes:</Text>
        </View>
        {danos.map((d, i) => (
          <View key={i} style={dpStyles.danoFila}>
            <Text style={dpStyles.danoEspacio}>{d.espacio}</Text>
            <Text style={dpStyles.danoDetalle}>{d.descripcion ?? "Daños registrados fotográficamente."}</Text>
          </View>
        ))}

        <Text style={[dpStyles.subtitulo, { marginTop: 12 }]}>PETICIONES</Text>
        <View style={dpStyles.itemNumerado}>
          <Text style={dpStyles.itemNumero}>1.</Text>
          <Text style={dpStyles.itemTexto}>
            Que se me incluya, junto con mi núcleo familiar, en el censo oficial de personas damnificadas por el sismo
            (Registro Único de Damnificados — RUD) que adelanta la administración municipal.
          </Text>
        </View>
        <View style={dpStyles.itemNumerado}>
          <Text style={dpStyles.itemNumero}>2.</Text>
          <Text style={dpStyles.itemTexto}>
            Que se ordene la evaluación técnica del inmueble ubicado en {identidad.direccion}, {identidad.ciudad}, por
            parte de los organismos competentes (Cuerpo de Bomberos, Cruz Roja o quien la administración designe), y
            que se me informe el resultado.
          </Text>
        </View>
        <View style={dpStyles.itemNumerado}>
          <Text style={dpStyles.itemNumero}>3.</Text>
          <Text style={dpStyles.itemTexto}>
            Que se me informe qué ayudas, subsidios o programas de apoyo están disponibles para las personas
            damnificadas y cuál es el procedimiento para acceder a ellos.
          </Text>
        </View>

        <Text style={dpStyles.subtitulo}>ANEXOS</Text>
        <Text style={dpStyles.parrafo}>
          Acta de documentación de daños{folioActa ? ` (folio ${folioActa})` : ""} con registro fotográfico fechado y
          geolocalizado del inmueble.
        </Text>

        <Text style={dpStyles.subtitulo}>NOTIFICACIONES</Text>
        <Text style={dpStyles.parrafo}>
          Recibiré respuesta en la dirección {identidad.direccion}, {identidad.ciudad}, o en el número de
          WhatsApp/celular {identidad.whatsapp}.
        </Text>

        <Text style={dpStyles.parrafo}>Atentamente,</Text>

        <View style={dpStyles.firmaLinea} wrap={false}>
          <Text style={dpStyles.firmaNombre}>{identidad.nombre}</Text>
          <Text style={dpStyles.firmaDetalle}>C.C. {identidad.cedula}</Text>
        </View>

        <View style={dpStyles.footerFijo} fixed>
          <Text style={dpStyles.footerNota}>
            Plantilla generada por Seiricon Juntos a partir de los datos y daños declarados por la persona
            peticionaria. La autoridad tiene 15 días hábiles para responder un derecho de petición.
          </Text>
          <View style={dpStyles.footerFila}>
            <Text style={pdfStyles.footerText}>
              Seiricon Juntos · Verifica este documento en seiricon.com/go/juntos/verificar · Folio: {folio} · Huella: {hashCorto}
            </Text>
            <Text
              style={pdfStyles.footerText}
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
