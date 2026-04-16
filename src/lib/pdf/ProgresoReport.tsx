import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfColors, formatDate } from "./styles";

interface ProgresoReportData {
  proyectoNombre: string;
  constructoraNombre: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  progreso: {
    porcentajeAprobado: number;
    porcentajeReportado: number;
    aprobadas: number;
    reportadas: number;
    total: number;
  };
  stats: {
    pendientes: number;
    noAprobadas: number;
    enRiesgo: number;
  };
  edificios: {
    nombre: string;
    unidades: number;
    porcentajeAprobado: number;
    porcentajeReportado: number;
    tareasAprobadas: number;
    tareasTotales: number;
  }[];
}

export function ProgresoReport({ data }: { data: ProgresoReportData }) {
  const hoy = new Date();

  return (
    <Document
      title={`Reporte de progreso - ${data.proyectoNombre}`}
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
            <Text style={pdfStyles.reportTitle}>Reporte de progreso</Text>
            <Text style={pdfStyles.reportDate}>Generado el {formatDate(hoy)}</Text>
          </View>
        </View>

        {/* Project info */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>{data.proyectoNombre}</Text>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Constructora</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{data.constructoraNombre}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Fecha inicio</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{formatDate(data.fechaInicio)}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Fecha fin estimada</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{formatDate(data.fechaFin)}</Text>
            </View>
          </View>
        </View>

        {/* Progress summary */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Resumen de progreso</Text>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Progreso aprobado</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.brand, fontSize: 24 }]}>
                {data.progreso.porcentajeAprobado}%
              </Text>
              <View style={pdfStyles.progressBarTrack}>
                <View
                  style={[pdfStyles.progressBarFill, { width: `${data.progreso.porcentajeAprobado}%` }]}
                />
              </View>
              <Text style={{ fontSize: 8, color: pdfColors.textMuted }}>
                {data.progreso.aprobadas} de {data.progreso.total} tareas aprobadas
              </Text>
            </View>

            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Progreso reportado</Text>
              <Text style={[pdfStyles.value, { color: "#60a5fa", fontSize: 24 }]}>
                {data.progreso.porcentajeReportado}%
              </Text>
              <View style={pdfStyles.progressBarTrack}>
                <View
                  style={[
                    pdfStyles.progressBarFill,
                    { width: `${data.progreso.porcentajeReportado}%`, backgroundColor: "#60a5fa" },
                  ]}
                />
              </View>
              <Text style={{ fontSize: 8, color: pdfColors.textMuted }}>
                {data.progreso.reportadas} de {data.progreso.total} tareas reportadas
              </Text>
            </View>
          </View>
        </View>

        {/* Task stats */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Estado de tareas</Text>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.card, pdfStyles.col, { backgroundColor: "#f0fdf4" }]}>
              <Text style={pdfStyles.label}>Aprobadas</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.green }]}>{data.progreso.aprobadas}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col, { backgroundColor: "#eff6ff" }]}>
              <Text style={pdfStyles.label}>Reportadas</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.brand }]}>{data.progreso.reportadas - data.progreso.aprobadas}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Pendientes</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.textMuted }]}>{data.stats.pendientes}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col, { backgroundColor: "#fef2f2" }]}>
              <Text style={pdfStyles.label}>No aprobadas</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.red }]}>{data.stats.noAprobadas}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col, { backgroundColor: "#fff7ed" }]}>
              <Text style={pdfStyles.label}>En riesgo</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.orange }]}>{data.stats.enRiesgo}</Text>
            </View>
          </View>
        </View>

        {/* Buildings */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Progreso por edificio</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeader}>
              <Text style={[pdfStyles.tableHeaderText, { flex: 2 }]}>Edificio</Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>Unidades</Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>Tareas</Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>Reportado</Text>
              <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>Aprobado</Text>
            </View>
            {data.edificios.map((ed, i) => (
              <View
                key={i}
                style={i === data.edificios.length - 1 ? pdfStyles.tableRowLast : pdfStyles.tableRow}
              >
                <Text style={[pdfStyles.tableCell, { flex: 2, fontFamily: "Helvetica-Bold" }]}>
                  {ed.nombre}
                </Text>
                <Text style={[pdfStyles.tableCell, { flex: 1, textAlign: "center" }]}>
                  {ed.unidades}
                </Text>
                <Text style={[pdfStyles.tableCell, { flex: 1, textAlign: "center" }]}>
                  {ed.tareasAprobadas}/{ed.tareasTotales}
                </Text>
                <Text
                  style={[pdfStyles.tableCell, { flex: 1, textAlign: "center", color: "#60a5fa" }]}
                >
                  {ed.porcentajeReportado}%
                </Text>
                <Text
                  style={[
                    pdfStyles.tableCell,
                    { flex: 1, textAlign: "center", color: pdfColors.brand, fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  {ed.porcentajeAprobado}%
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
