import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfColors, formatDate } from "./styles";

interface ContratistaData {
  nombre: string;
  rol: string;
  score_total: number;
  score_cumplimiento: number;
  score_calidad: number;
  score_velocidad_correccion: number;
  tareas_aprobadas: number;
  tareas_pendientes: number;
}

interface ContratistasReportData {
  constructoraNombre: string;
  contratistas: ContratistaData[];
}

function getScoreColor(score: number): string {
  if (score >= 85) return pdfColors.green;
  if (score >= 70) return pdfColors.brand;
  if (score >= 55) return pdfColors.yellow;
  if (score >= 40) return pdfColors.red;
  return pdfColors.redDark;
}

function getScoreLabel(score: number): string {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bueno";
  if (score >= 55) return "Regular";
  if (score >= 40) return "Bajo";
  return "Crítico";
}

export function ContratistasReport({ data }: { data: ContratistasReportData }) {
  const hoy = new Date();

  return (
    <Document
      title={`Score de contratistas - ${data.constructoraNombre}`}
      author="Seiricon"
      creator="Seiricon"
    >
      <Page size="A4" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.brand}>SEIRICON</Text>
            <Text style={pdfStyles.tagline}>construyendo en orden</Text>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.reportTitle}>Score de contratistas</Text>
            <Text style={pdfStyles.reportDate}>Generado el {formatDate(hoy)}</Text>
          </View>
        </View>

        {/* Intro */}
        <View style={pdfStyles.section}>
          <Text style={{ fontSize: 10, color: pdfColors.text, marginBottom: 4 }}>
            {data.constructoraNombre}
          </Text>
          <Text style={{ fontSize: 9, color: pdfColors.textMuted }}>
            Evaluación de desempeño de {data.contratistas.length} contratista
            {data.contratistas.length !== 1 ? "s" : ""} basada en tres ejes: cumplimiento (50%),
            calidad (30%) y velocidad de corrección (20%).
          </Text>
        </View>

        {/* Table */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Ranking</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeader}>
              <Text style={[pdfStyles.tableHeaderText, { flex: 0.5, textAlign: "center" }]}>#</Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 2.5 }]}>Contratista</Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>
                Cumplim.
              </Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>
                Calidad
              </Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>
                Velocidad
              </Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>
                Score
              </Text>
            </View>
            {data.contratistas.map((c, i) => (
              <View
                key={i}
                style={i === data.contratistas.length - 1 ? pdfStyles.tableRowLast : pdfStyles.tableRow}
              >
                <Text style={[pdfStyles.tableCell, { flex: 0.5, textAlign: "center" }]}>
                  {i + 1}
                </Text>
                <View style={{ flex: 2.5 }}>
                  <Text style={[pdfStyles.tableCell, { fontFamily: "Helvetica-Bold" }]}>
                    {c.nombre}
                  </Text>
                  <Text style={{ fontSize: 7, color: pdfColors.textMuted, marginTop: 1 }}>
                    {c.rol.replace(/_/g, " ").toLowerCase()}
                  </Text>
                </View>
                <Text style={[pdfStyles.tableCell, { flex: 1, textAlign: "center" }]}>
                  {c.score_cumplimiento}
                </Text>
                <Text style={[pdfStyles.tableCell, { flex: 1, textAlign: "center" }]}>
                  {c.score_calidad}
                </Text>
                <Text style={[pdfStyles.tableCell, { flex: 1, textAlign: "center" }]}>
                  {c.score_velocidad_correccion}
                </Text>
                <Text
                  style={[
                    pdfStyles.tableCell,
                    {
                      flex: 1,
                      textAlign: "center",
                      fontFamily: "Helvetica-Bold",
                      color: getScoreColor(c.score_total),
                    },
                  ]}
                >
                  {c.score_total} · {getScoreLabel(c.score_total)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Stats summary */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Resumen de trabajo</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeader}>
              <Text style={[pdfStyles.tableHeaderText, { flex: 3 }]}>Contratista</Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>
                Completadas
              </Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>
                En progreso
              </Text>
            </View>
            {data.contratistas.map((c, i) => (
              <View
                key={i}
                style={i === data.contratistas.length - 1 ? pdfStyles.tableRowLast : pdfStyles.tableRow}
              >
                <Text style={[pdfStyles.tableCell, { flex: 3 }]}>{c.nombre}</Text>
                <Text
                  style={[
                    pdfStyles.tableCell,
                    { flex: 1, textAlign: "center", color: pdfColors.green, fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  {c.tareas_aprobadas}
                </Text>
                <Text style={[pdfStyles.tableCell, { flex: 1, textAlign: "center" }]}>
                  {c.tareas_pendientes}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={pdfStyles.footer} fixed>
          <Text style={pdfStyles.footerText}>Seiricon · seiricon.com</Text>
          <Text
            style={pdfStyles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
