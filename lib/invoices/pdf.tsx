import { formatDate, formatMoney } from "@/lib/format";

export type InvoicePdfData = {
  number: string; companyCode: "VMH" | "VTH"; companyAddress: string | null; gstin: string | null; issueDate: Date; dueDate: Date; currency: string;
  billTo: { name: string; address: string | null }; project: string | null;
  lines: { description: string; qty: number; rate: number; amount: number }[];
  subtotal: number; taxRate: number; taxAmount: number; discount: number; total: number; paid: number; notes: string | null;
};

/** Rupee sign isn't in the built-in PDF fonts, so amounts use "Rs." in the PDF. */
const money = (v: number, c: string) => formatMoney(v, c).replace("â‚¹", "Rs. ");

export async function renderInvoicePdf(d: InvoicePdfData) {
  // react-pdf (and pdfkit) are only loaded here, at call time, so the Worker
  // never touches them at startup/deploy validation.
  const { Document, Page, StyleSheet, Svg, Path, Text, View, renderToBuffer } = await import("@react-pdf/renderer");
  const { createElement: h } = await import("react");

  const s = StyleSheet.create({
    page: { padding: 40, fontSize: 10, color: "#0F172A", fontFamily: "Helvetica" },
    row: { flexDirection: "row", justifyContent: "space-between" },
    muted: { color: "#5B6478" },
    h1: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 18 },
    th: { flexDirection: "row", backgroundColor: "#F1F4F8", paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 9 },
    tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#E6EAF0" },
    bold: { fontFamily: "Helvetica-Bold" },
  });

  const cols = [0.5, 4, 0.8, 1.6, 1.6];

  const doc = h(Document, { title: `Invoice ${d.number}` },
    h(Page, { size: "A4", style: s.page },
      h(View, { style: s.row },
        h(View, {},
          h(View, { style: { flexDirection: "row", alignItems: "center", gap: 6 } },
            h(Svg, { viewBox: "0 0 32 28", width: 22, height: 20 },
              h(Path, { d: "M22.5 2.5h7.2L19.2 25.5h-5.4z", fill: "#5B6478" }),
              h(Path, { d: "M2.3 2.5h7.4l8.7 19.4-2.7 3.6h-2.6z", fill: "#0F1A2B" })
            ),
            h(Text, { style: { fontSize: 16, fontFamily: "Helvetica-Bold" } }, "Vertex")
          ),
          h(Text, { style: [s.muted, { fontSize: 8, letterSpacing: 1.5, marginLeft: 28 }] }, d.companyCode === "VTH" ? "TECH HOUSE" : "MEDIA HOUSE"),
          d.companyAddress ? h(Text, { style: [s.muted, { marginTop: 6, fontSize: 8 }] }, d.companyAddress) : null,
          d.gstin ? h(Text, { style: [s.muted, { fontSize: 8 }] }, `GSTIN: ${d.gstin}`) : null
        ),
        h(View, { style: { alignItems: "flex-end" } },
          h(Text, { style: [s.bold, { fontSize: 12 }] }, `#${d.number}`),
          h(Text, { style: s.muted }, `Issue Date: ${formatDate(d.issueDate)}`),
          h(Text, { style: s.muted }, `Due Date: ${formatDate(d.dueDate)}`)
        )
      ),
      h(Text, { style: s.h1 }, "INVOICE"),
      h(View, { style: [s.row, { marginTop: 14, marginBottom: 18 }] },
        h(View, {},
          h(Text, { style: s.bold }, "Bill To"),
          h(Text, { style: [s.bold, { marginTop: 2 }] }, d.billTo.name),
          d.billTo.address ? h(Text, { style: s.muted }, d.billTo.address) : null
        ),
        d.project ? h(View, { style: { width: 200 } },
          h(Text, { style: s.bold }, "Project"),
          h(Text, { style: s.muted }, d.project)
        ) : null
      ),
      h(View, { style: s.th },
        ["#", "Description", "Qty", "Rate", "Amount"].map((hd, i) =>
          h(Text, { key: hd, style: { flex: cols[i], textAlign: i >= 2 ? "right" : "left" } }, hd)
        )
      ),
      ...d.lines.map((l, i) =>
        h(View, { key: i, style: s.tr },
          h(Text, { style: { flex: cols[0] } }, i + 1),
          h(Text, { style: { flex: cols[1] } }, l.description),
          h(Text, { style: { flex: cols[2], textAlign: "right" } }, l.qty),
          h(Text, { style: { flex: cols[3], textAlign: "right" } }, money(l.rate, d.currency)),
          h(Text, { style: { flex: cols[4], textAlign: "right" } }, money(l.amount, d.currency))
        )
      ),
      h(View, { style: { alignSelf: "flex-end", width: 220, marginTop: 12, gap: 4 } },
        h(View, { style: s.row }, h(Text, {}, "Subtotal"), h(Text, { style: s.bold }, money(d.subtotal, d.currency))),
        d.discount > 0 ? h(View, { style: s.row }, h(Text, {}, "Discount"), h(Text, {}, `- ${money(d.discount, d.currency)}`)) : null,
        h(View, { style: s.row }, h(Text, { style: s.muted }, `Tax (${d.taxRate}%)`), h(Text, {}, money(d.taxAmount, d.currency))),
        h(View, { style: [s.row, { borderTopWidth: 1, borderTopColor: "#E6EAF0", paddingTop: 4 }] }, h(Text, { style: s.bold }, "Total"), h(Text, { style: s.bold }, money(d.total, d.currency))),
        d.paid > 0 ? h(View, { style: s.row }, h(Text, { style: s.muted }, "Paid"), h(Text, {}, money(d.paid, d.currency))) : null,
        d.paid > 0 ? h(View, { style: s.row }, h(Text, { style: s.bold }, "Balance due"), h(Text, { style: s.bold }, money(d.total - d.paid, d.currency))) : null
      ),
      d.notes ? h(View, { style: { marginTop: 28 } }, h(Text, { style: s.bold }, "Notes"), h(Text, { style: s.muted }, d.notes)) : null
    )
  );

  return renderToBuffer(doc);
}