import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfColors, formatDate } from "./styles";
import { evaluarInmueble } from "@/lib/alerta/reglas";
import { LABEL_ELEMENTO } from "@/lib/alerta/copys";
import type { InformeGrietasPayload } from "@/lib/alerta/grietas";
import type { Nivel } from "@/lib/alerta/tipos";

// Estilos propios del informe de grietas — se combinan con
// pdfStyles/pdfColors compartidos de styles.ts, que solo se CONSUMEN aquí,
// no se modifican (mismo criterio que ActaDanosReport.tsx, Fase 1).
const informeStyles = StyleSheet.create({
  disclaimer: {
    padding: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fde68a",
    marginBottom: 16,
  },
  disclaimerText: {
    fontSize: 8,
    color: "#92400e",
    lineHeight: 1.4,
  },
  resumenNivel: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  grietaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  grietaTitulo: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
  },
  nivelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  discrepancia: {
    fontSize: 8,
    color: "#92400e",
    backgroundColor: "#fffbeb",
    padding: 6,
    borderRadius: 4,
    marginBottom: 6,
  },
  razon: {
    fontSize: 9,
    color: pdfColors.textMuted,
    marginBottom: 4,
  },
  queHacer: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
    marginBottom: 4,
  },
  queNoHacerItem: {
    fontSize: 9,
    color: pdfColors.textMuted,
  },
  notaVisual: {
    fontSize: 8,
    color: pdfColors.textMuted,
    marginTop: 6,
    fontStyle: "italic",
  },
  fotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  foto: {
    width: 160,
    height: 120,
    borderRadius: 4,
    objectFit: "cover",
    borderWidth: 1,
    borderColor: pdfColors.border,
  },
  footerDisclaimer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 6,
  },
  footerDisclaimerText: {
    fontSize: 7,
    color: pdfColors.textMuted,
    lineHeight: 1.3,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
});

const LABEL_NIVEL: Record<Nivel, string> = {
  rojo: "Riesgo alto",
  amarillo: "Necesita revisión",
  verde: "Sin señales de alarma",
};

const COLOR_NIVEL: Record<Nivel, string> = {
  rojo: pdfColors.red,
  amarillo: pdfColors.yellow,
  verde: pdfColors.green,
};

/**
 * Informe de grietas (/alerta/grietas). Cabecera Seiricon Alerta, disclaimer
 * arriba y en el pie de CADA página (`fixed`), nivel del inmueble
 * (evaluarInmueble) y, por grieta: nivel, elemento declarado vs. elemento
 * final (con la discrepancia si la hubo), razón, qué hacer, qué no hacer, y
 * las dos fotos con overlay (evidencia, no las de análisis).
 *
 * Usa `Image` con data-URI igual que ActaDanosReport.tsx (spec Fase 1, R5):
 * puede fallar en blanco si el data-URI está mal formado — probado con un
 * PDF real de al menos 1 foto antes de dar por cerrada esta pieza.
 */
export function InformeGrietasReport({ data }: { data: InformeGrietasPayload }) {
  const hoy = new Date();
  const veredictoInmueble = evaluarInmueble(data.grietas.map((g) => g.veredicto));

  return (
    <Document title="Informe de grietas — Seiricon Alerta" author="Seiricon" creator="Seiricon">
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.brand}>SEIRICON</Text>
            <Text style={pdfStyles.tagline}>Seiricon Alerta</Text>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.reportTitle}>Informe de grietas</Text>
            <Text style={pdfStyles.reportDate}>Generado el {formatDate(hoy)}</Text>
          </View>
        </View>

        <View style={informeStyles.disclaimer}>
          <Text style={informeStyles.disclaimerText}>
            Este documento es una lectura automatizada de fotos y respuestas de la persona reportante.
            NO constituye una evaluación de un ingeniero estructural ni un diagnóstico de habitabilidad.
          </Text>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Resultado general del inmueble</Text>
          <View style={[pdfStyles.card, { borderLeftWidth: 4, borderLeftColor: COLOR_NIVEL[veredictoInmueble.nivel] }]}>
            <Text style={pdfStyles.label}>Nivel (el peor de todas las grietas evaluadas)</Text>
            <Text style={[informeStyles.resumenNivel, { color: COLOR_NIVEL[veredictoInmueble.nivel] }]}>
              {LABEL_NIVEL[veredictoInmueble.nivel]}
            </Text>
            <Text style={[pdfStyles.value, { fontSize: 10, fontFamily: "Helvetica" }]}>{veredictoInmueble.que_hacer}</Text>
          </View>
        </View>

        {data.grietas.map((g, i) => (
          <View key={i} style={pdfStyles.section} wrap={false}>
            <View style={informeStyles.grietaHeader}>
              <Text style={informeStyles.grietaTitulo}>Grieta {i + 1}</Text>
              <Text style={[informeStyles.nivelBadge, { backgroundColor: COLOR_NIVEL[g.veredicto.nivel] }]}>
                {LABEL_NIVEL[g.veredicto.nivel]}
              </Text>
            </View>

            <View style={pdfStyles.row}>
              <View style={[pdfStyles.card, pdfStyles.col]}>
                <Text style={pdfStyles.label}>Elemento declarado</Text>
                <Text style={[pdfStyles.value, { fontSize: 11 }]}>{LABEL_ELEMENTO[g.elementoDeclarado]}</Text>
              </View>
              <View style={[pdfStyles.card, pdfStyles.col]}>
                <Text style={pdfStyles.label}>Elemento evaluado</Text>
                <Text style={[pdfStyles.value, { fontSize: 11 }]}>{LABEL_ELEMENTO[g.elementoFinal]}</Text>
              </View>
            </View>

            {g.hubo_discrepancia && (
              <Text style={informeStyles.discrepancia}>
                Lo que se declaró y lo que se ve en la foto no coinciden. Se usó la lectura más conservadora
                entre las dos.
              </Text>
            )}

            <Text style={informeStyles.razon}>{g.veredicto.razon}</Text>
            <Text style={informeStyles.queHacer}>{g.veredicto.que_hacer}</Text>
            {g.veredicto.que_no_hacer.length > 0 && (
              <View>
                {g.veredicto.que_no_hacer.map((item, j) => (
                  <Text key={j} style={informeStyles.queNoHacerItem}>
                    • {item}
                  </Text>
                ))}
              </View>
            )}
            {g.notaVisual && <Text style={informeStyles.notaVisual}>Lo que se ve en la foto: {g.notaVisual}</Text>}

            <View style={informeStyles.fotoGrid}>
              {g.fotos.map((foto, j) => (
                <Image key={j} src={foto.dataUrl} style={informeStyles.foto} />
              ))}
            </View>
          </View>
        ))}

        <View style={informeStyles.footerDisclaimer} fixed>
          <Text style={informeStyles.footerDisclaimerText}>
            Este documento es una lectura automatizada y NO constituye una evaluación de un ingeniero
            estructural ni un diagnóstico de habitabilidad.
          </Text>
          <View style={informeStyles.footerRow}>
            <Text style={pdfStyles.footerText}>Seiricon Alerta · seiricon.com/alerta</Text>
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
