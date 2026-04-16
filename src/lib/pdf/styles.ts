import { StyleSheet } from "@react-pdf/renderer";

export const pdfColors = {
  brand: "#2563eb",
  brandDark: "#1e40af",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  bgMuted: "#f8fafc",
  green: "#16a34a",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#dc2626",
  redDark: "#7f1d1d",
};

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: pdfColors.text,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: pdfColors.brand,
  },
  brand: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.brand,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 9,
    color: pdfColors.textMuted,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  reportTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
    marginBottom: 2,
  },
  reportDate: {
    fontSize: 9,
    color: pdfColors.textMuted,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  col: {
    flex: 1,
  },
  card: {
    padding: 12,
    backgroundColor: pdfColors.bgMuted,
    borderRadius: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 8,
    color: pdfColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
    marginTop: 2,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: pdfColors.border,
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: pdfColors.bgMuted,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    padding: 8,
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    padding: 8,
  },
  tableRowLast: {
    flexDirection: "row",
    padding: 8,
  },
  tableCell: {
    fontSize: 9,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: pdfColors.border,
    borderRadius: 3,
    marginTop: 4,
    marginBottom: 4,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: pdfColors.brand,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: pdfColors.textMuted,
  },
});

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}
