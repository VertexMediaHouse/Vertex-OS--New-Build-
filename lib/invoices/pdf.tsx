import { Document, Page, StyleSheet, Svg, Path, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/format";

export type InvoicePdfData = {
  number: string; companyCode: "VMH" | "VTH"; companyAddress: string | null; gstin: string | null; issueDate: Date; dueDate: Date; currency: string;
  billTo: { name: string; address: string | null }; project: string | null;
  lines: { description: string; qty: number; rate: number; amount: number }[];
  subtotal: number; taxRate: number; taxAmount: number; discount: number; total: number; paid: number; notes: string | null;
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#0F172A", fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: "#5B6478" },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 18 },
  th: { flexDirection: "row", backgroundColor: "#F1F4F8", paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 9 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#E6EAF0" },
  bold: { fontFamily: "Helvetica-Bold" },
});

/** Rupee sign isn't in the built-in PDF fonts, so amounts use "Rs." in the PDF. */
const money = (v: number, c: string) => formatMoney(v, c).replace("₹", "Rs. ");

export function InvoicePdf({ d }: { d: InvoicePdfData }) {
  const cols = [0.5, 4, 0.8, 1.6, 1.6];
  return (
    <Document title={`Invoice ${d.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Svg viewBox="0 0 32 28" width={22} height={20}><Path d="M22.5 2.5h7.2L19.2 25.5h-5.4z" fill="#5B6478" /><Path d="M2.3 2.5h7.4l8.7 19.4-2.7 3.6h-2.6z" fill="#0F1A2B" /></Svg>
              <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold" }}>Vertex</Text>
            </View>
            <Text style={[s.muted, { fontSize: 8, letterSpacing: 1.5, marginLeft: 28 }]}>{d.companyCode === "VTH" ? "TECH HOUSE" : "MEDIA HOUSE"}</Text>
            {d.companyAddress && <Text style={[s.muted, { marginTop: 6, fontSize: 8 }]}>{d.companyAddress}</Text>}
            {d.gstin && <Text style={[s.muted, { fontSize: 8 }]}>GSTIN: {d.gstin}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.bold, { fontSize: 12 }]}>#{d.number}</Text>
            <Text style={s.muted}>Issue Date: {formatDate(d.issueDate)}</Text>
            <Text style={s.muted}>Due Date: {formatDate(d.dueDate)}</Text>
          </View>
        </View>
        <Text style={s.h1}>INVOICE</Text>
        <View style={[s.row, { marginTop: 14, marginBottom: 18 }]}>
          <View><Text style={s.bold}>Bill To</Text><Text style={[s.bold, { marginTop: 2 }]}>{d.billTo.name}</Text>{d.billTo.address && <Text style={s.muted}>{d.billTo.address}</Text>}</View>
          {d.project && <View style={{ width: 200 }}><Text style={s.bold}>Project</Text><Text style={s.muted}>{d.project}</Text></View>}
        </View>
        <View style={s.th}>{["#", "Description", "Qty", "Rate", "Amount"].map((h, i) => <Text key={h} style={{ flex: cols[i], textAlign: i >= 2 ? "right" : "left" }}>{h}</Text>)}</View>
        {d.lines.map((l, i) => (
          <View key={i} style={s.tr}>
            <Text style={{ flex: cols[0] }}>{i + 1}</Text>
            <Text style={{ flex: cols[1] }}>{l.description}</Text>
            <Text style={{ flex: cols[2], textAlign: "right" }}>{l.qty}</Text>
            <Text style={{ flex: cols[3], textAlign: "right" }}>{money(l.rate, d.currency)}</Text>
            <Text style={{ flex: cols[4], textAlign: "right" }}>{money(l.amount, d.currency)}</Text>
          </View>
        ))}
        <View style={{ alignSelf: "flex-end", width: 220, marginTop: 12, gap: 4 }}>
          <View style={s.row}><Text>Subtotal</Text><Text style={s.bold}>{money(d.subtotal, d.currency)}</Text></View>
          {d.discount > 0 && <View style={s.row}><Text>Discount</Text><Text>- {money(d.discount, d.currency)}</Text></View>}
          <View style={s.row}><Text style={s.muted}>Tax ({d.taxRate}%)</Text><Text>{money(d.taxAmount, d.currency)}</Text></View>
          <View style={[s.row, { borderTopWidth: 1, borderTopColor: "#E6EAF0", paddingTop: 4 }]}><Text style={s.bold}>Total</Text><Text style={s.bold}>{money(d.total, d.currency)}</Text></View>
          {d.paid > 0 && <View style={s.row}><Text style={s.muted}>Paid</Text><Text>{money(d.paid, d.currency)}</Text></View>}
          {d.paid > 0 && <View style={s.row}><Text style={s.bold}>Balance due</Text><Text style={s.bold}>{money(d.total - d.paid, d.currency)}</Text></View>}
        </View>
        {d.notes && <View style={{ marginTop: 28 }}><Text style={s.bold}>Notes</Text><Text style={s.muted}>{d.notes}</Text></View>}
      </Page>
    </Document>
  );
}

export const renderInvoicePdf = (d: InvoicePdfData) => renderToBuffer(<InvoicePdf d={d} />);
