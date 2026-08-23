import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_COLORS, PDF_FONT_FAMILY, registerPdfFonts } from "@/lib/pdf/fonts";
import { formatGroszPlain } from "@/lib/money";
import { formatDate } from "@/lib/time";

registerPdfFonts();

export interface InvoicePdfLine {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unitPriceNetGrosz: number;
  netGrosz: number;
  vatRate: number;
  vatGrosz: number;
  grossGrosz: number;
}

export interface InvoicePdfData {
  number: string;
  issueDate: string;
  saleDate: string | null;
  dueDate: string | null;
  paymentMethod: string;
  periodFrom: string | null;
  periodTo: string | null;
  sellerName: string;
  sellerTaxId: string | null;
  sellerAddress: string | null;
  sellerBankAccount: string | null;
  buyerName: string;
  buyerTaxId: string | null;
  buyerAddress: string | null;
  lines: InvoicePdfLine[];
  totalNetGrosz: number;
  totalVatGrosz: number;
  totalGrossGrosz: number;
  notes: string | null;
  /** Informacja o statusie wobec KSeF — świadomie widoczna na dokumencie. */
  ksefNotice: string | null;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
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
    marginBottom: 18,
  },
  brand: { fontSize: 16, fontWeight: 700, letterSpacing: 1 },
  brandAccent: { color: PDF_COLORS.gold },
  invoiceTitle: { fontSize: 13, fontWeight: 700, textAlign: "right" },
  invoiceNumber: { fontSize: 11, textAlign: "right", marginTop: 2 },
  partiesRow: { flexDirection: "row", gap: 24, marginBottom: 16 },
  party: { flex: 1 },
  partyLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: PDF_COLORS.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyName: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  partyLine: { fontSize: 8.5, color: PDF_COLORS.muted, marginBottom: 1 },
  metaRow: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.subtleBackground,
    padding: 8,
    marginBottom: 16,
  },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 7, color: PDF_COLORS.muted, marginBottom: 2 },
  metaValue: { fontSize: 9, fontWeight: 500 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.navy,
    color: "#FFFFFF",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  cellNo: { width: 20 },
  cellName: { flex: 1, paddingRight: 6 },
  cellQty: { width: 46, textAlign: "right" },
  cellUnit: { width: 34, textAlign: "center" },
  cellPrice: { width: 56, textAlign: "right" },
  cellNet: { width: 60, textAlign: "right" },
  cellVat: { width: 34, textAlign: "right" },
  cellGross: { width: 62, textAlign: "right" },
  headText: { fontSize: 7.5, fontWeight: 700 },
  summary: { marginTop: 14, flexDirection: "row", justifyContent: "flex-end" },
  summaryBox: { width: 240 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: PDF_COLORS.navy,
    marginTop: 4,
    paddingTop: 5,
  },
  summaryTotalText: { fontSize: 11, fontWeight: 700 },
  payment: { marginTop: 22, borderTopWidth: 0.5, borderTopColor: PDF_COLORS.border, paddingTop: 10 },
  notice: {
    marginTop: 16,
    padding: 8,
    borderWidth: 0.5,
    borderColor: PDF_COLORS.gold,
    backgroundColor: "#FBECD9",
    fontSize: 8,
  },
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

function money(grosz: number): string {
  return formatGroszPlain(grosz);
}

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document
      title={`Faktura ${data.number}`}
      author={data.sellerName}
      subject={`Faktura ${data.number} dla ${data.buyerName}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.brand}>
              LEGAL<Text style={styles.brandAccent}>WISE</Text>
            </Text>
            <Text style={styles.partyLine}>{data.sellerName}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>FAKTURA</Text>
            <Text style={styles.invoiceNumber}>{data.number}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>SPRZEDAWCA</Text>
            <Text style={styles.partyName}>{data.sellerName}</Text>
            {data.sellerAddress && <Text style={styles.partyLine}>{data.sellerAddress}</Text>}
            {data.sellerTaxId && <Text style={styles.partyLine}>NIP {data.sellerTaxId}</Text>}
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>NABYWCA</Text>
            <Text style={styles.partyName}>{data.buyerName}</Text>
            {data.buyerAddress && <Text style={styles.partyLine}>{data.buyerAddress}</Text>}
            {data.buyerTaxId && <Text style={styles.partyLine}>NIP {data.buyerTaxId}</Text>}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Data wystawienia</Text>
            <Text style={styles.metaValue}>{formatDate(data.issueDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Data sprzedaży</Text>
            <Text style={styles.metaValue}>
              {data.saleDate ? formatDate(data.saleDate) : "—"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Termin płatności</Text>
            <Text style={styles.metaValue}>{data.dueDate ? formatDate(data.dueDate) : "—"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Okres rozliczeniowy</Text>
            <Text style={styles.metaValue}>
              {data.periodFrom && data.periodTo
                ? `${formatDate(data.periodFrom)} – ${formatDate(data.periodTo)}`
                : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.cellNo, styles.headText]}>Lp.</Text>
          <Text style={[styles.cellName, styles.headText]}>Nazwa usługi</Text>
          <Text style={[styles.cellQty, styles.headText]}>Ilość</Text>
          <Text style={[styles.cellUnit, styles.headText]}>J.m.</Text>
          <Text style={[styles.cellPrice, styles.headText]}>Cena netto</Text>
          <Text style={[styles.cellNet, styles.headText]}>Wartość netto</Text>
          <Text style={[styles.cellVat, styles.headText]}>VAT</Text>
          <Text style={[styles.cellGross, styles.headText]}>Brutto</Text>
        </View>

        {data.lines.map((line) => (
          <View key={line.position} style={styles.tableRow} wrap={false}>
            <Text style={styles.cellNo}>{line.position}</Text>
            <Text style={styles.cellName}>{line.description}</Text>
            <Text style={styles.cellQty}>
              {new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(line.quantity)}
            </Text>
            <Text style={styles.cellUnit}>{line.unit}</Text>
            <Text style={styles.cellPrice}>{money(line.unitPriceNetGrosz)}</Text>
            <Text style={styles.cellNet}>{money(line.netGrosz)}</Text>
            <Text style={styles.cellVat}>{line.vatRate}%</Text>
            <Text style={styles.cellGross}>{money(line.grossGrosz)}</Text>
          </View>
        ))}

        <View style={styles.summary}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text>Razem netto</Text>
              <Text>{money(data.totalNetGrosz)} zł</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Podatek VAT</Text>
              <Text>{money(data.totalVatGrosz)} zł</Text>
            </View>
            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalText}>Do zapłaty</Text>
              <Text style={styles.summaryTotalText}>{money(data.totalGrossGrosz)} zł</Text>
            </View>
          </View>
        </View>

        <View style={styles.payment}>
          <Text style={styles.partyLabel}>PŁATNOŚĆ</Text>
          <Text style={styles.partyLine}>Forma płatności: {data.paymentMethod}</Text>
          {data.sellerBankAccount && (
            <Text style={styles.partyLine}>Numer rachunku: {data.sellerBankAccount}</Text>
          )}
          {data.notes && <Text style={[styles.partyLine, { marginTop: 6 }]}>{data.notes}</Text>}
        </View>

        {/* Status wobec KSeF podajemy wprost na dokumencie. Faktura, która nie
            trafiła do KSeF, nie jest fakturą ustrukturyzowaną i odbiorca musi
            to wiedzieć — przemilczenie tego wprowadzałoby w błąd. */}
        {data.ksefNotice && <Text style={styles.notice}>{data.ksefNotice}</Text>}

        <View style={styles.footer} fixed>
          <Text>
            {data.sellerName}
            {data.sellerTaxId ? ` · NIP ${data.sellerTaxId}` : ""}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Strona ${pageNumber} z ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
