import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_COLORS, PDF_FONT_FAMILY, registerPdfFonts } from "@/lib/pdf/fonts";
import { formatGroszPlain } from "@/lib/money";
import { formatDate, formatMinutesAsHours } from "@/lib/time";
import type { AnnexCaseGroup } from "@/lib/billing";

registerPdfFonts();

export interface AnnexPdfData {
  invoiceNumber: string;
  sellerName: string;
  sellerTaxId: string | null;
  buyerName: string;
  periodFrom: string | null;
  periodTo: string | null;
  groups: AnnexCaseGroup[];
  totalMinutes: number;
  billableMinutes: number;
  proBonoMinutes: number;
  totalNetGrosz: number;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 8.5,
    color: PDF_COLORS.text,
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: PDF_COLORS.gold,
    paddingBottom: 10,
    marginBottom: 14,
  },
  brand: { fontSize: 16, fontWeight: 700, letterSpacing: 1 },
  brandAccent: { color: PDF_COLORS.gold },
  title: { fontSize: 12, fontWeight: 700, textAlign: "right" },
  subtitle: { fontSize: 9, textAlign: "right", color: PDF_COLORS.muted, marginTop: 2 },
  intro: { marginBottom: 14, fontSize: 9, color: PDF_COLORS.muted, lineHeight: 1.4 },
  summaryRow: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.subtleBackground,
    padding: 8,
    marginBottom: 16,
  },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: 7, color: PDF_COLORS.muted, marginBottom: 2 },
  summaryValue: { fontSize: 10, fontWeight: 700 },
  caseHeader: {
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.navy,
  },
  caseTitle: { fontSize: 10, fontWeight: 700 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    paddingVertical: 4,
  },
  cellDate: { width: 54 },
  cellLawyer: { width: 92 },
  cellDesc: { flex: 1, paddingRight: 6 },
  cellHours: { width: 42, textAlign: "right" },
  cellAmount: { width: 62, textAlign: "right" },
  headText: { fontSize: 7, fontWeight: 700, color: PDF_COLORS.muted, letterSpacing: 0.5 },
  caseTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 5,
    gap: 12,
  },
  caseTotalLabel: { fontSize: 8.5, fontWeight: 500 },
  proBono: { color: PDF_COLORS.muted, fontStyle: "italic" },
  grandTotal: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: PDF_COLORS.navy,
    paddingTop: 8,
  },
  grandTotalText: { fontSize: 11, fontWeight: 700 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLORS.border,
    paddingTop: 6,
    fontSize: 7.5,
    color: PDF_COLORS.muted,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export function AnnexDocument({ data }: { data: AnnexPdfData }) {
  const period =
    data.periodFrom && data.periodTo
      ? `${formatDate(data.periodFrom)} – ${formatDate(data.periodTo)}`
      : "—";

  return (
    <Document
      title={`Zestawienie godzin do faktury ${data.invoiceNumber}`}
      author={data.sellerName}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.brand}>
              LEGAL<Text style={styles.brandAccent}>WISE</Text>
            </Text>
            <Text style={{ fontSize: 8.5, color: PDF_COLORS.muted }}>{data.sellerName}</Text>
          </View>
          <View>
            <Text style={styles.title}>ZESTAWIENIE CZYNNOŚCI</Text>
            <Text style={styles.subtitle}>załącznik do faktury {data.invoiceNumber}</Text>
          </View>
        </View>

        <Text style={styles.intro}>
          Zestawienie czynności wykonanych na rzecz: {data.buyerName}.{"\n"}
          Okres rozliczeniowy: {period}.
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>CZAS ŁĄCZNIE</Text>
            <Text style={styles.summaryValue}>{formatMinutesAsHours(data.totalMinutes)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>W TYM ROZLICZANE</Text>
            <Text style={styles.summaryValue}>{formatMinutesAsHours(data.billableMinutes)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>W TYM NIEODPŁATNIE</Text>
            <Text style={styles.summaryValue}>{formatMinutesAsHours(data.proBonoMinutes)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>WARTOŚĆ NETTO</Text>
            <Text style={styles.summaryValue}>{formatGroszPlain(data.totalNetGrosz)} zł</Text>
          </View>
        </View>

        {data.groups.map((group) => (
          <View key={group.caseId} break={false}>
            <View style={styles.caseHeader} wrap={false}>
              <Text style={styles.caseTitle}>
                {group.caseNumber} — {group.caseTitle}
              </Text>
            </View>

            <View style={styles.tableHead} wrap={false}>
              <Text style={[styles.cellDate, styles.headText]}>DATA</Text>
              <Text style={[styles.cellLawyer, styles.headText]}>PRAWNIK</Text>
              <Text style={[styles.cellDesc, styles.headText]}>CZYNNOŚĆ</Text>
              <Text style={[styles.cellHours, styles.headText]}>CZAS</Text>
              <Text style={[styles.cellAmount, styles.headText]}>NETTO</Text>
            </View>

            {group.rows.map((row, index) => (
              <View key={`${group.caseId}-${index}`} style={styles.row} wrap={false}>
                <Text style={styles.cellDate}>{formatDate(row.workDate)}</Text>
                <Text style={styles.cellLawyer}>{row.lawyerName}</Text>
                <Text
                  style={[
                    styles.cellDesc,
                    row.billingType === "nieodplatny" ? styles.proBono : {},
                  ]}
                >
                  {row.description}
                  {row.billingType === "nieodplatny" ? " (nieodpłatnie)" : ""}
                </Text>
                <Text style={styles.cellHours}>{formatMinutesAsHours(row.minutes, false)}</Text>
                <Text style={styles.cellAmount}>
                  {row.amountNetGrosz > 0 ? formatGroszPlain(row.amountNetGrosz) : "—"}
                </Text>
              </View>
            ))}

            <View style={styles.caseTotal} wrap={false}>
              <Text style={styles.caseTotalLabel}>
                Razem w sprawie: {formatMinutesAsHours(group.totalMinutes)}
              </Text>
              <Text style={styles.caseTotalLabel}>
                {formatGroszPlain(group.totalNetGrosz)} zł
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.grandTotal} wrap={false}>
          <Text style={styles.grandTotalText}>
            Razem: {formatMinutesAsHours(data.totalMinutes)}
          </Text>
          <Text style={styles.grandTotalText}>
            {formatGroszPlain(data.totalNetGrosz)} zł netto
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Zestawienie do faktury {data.invoiceNumber}
            {data.sellerTaxId ? ` · NIP ${data.sellerTaxId}` : ""}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Strona ${pageNumber} z ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
