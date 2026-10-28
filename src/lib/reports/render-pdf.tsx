import "server-only"

import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer"

import { formatDateTime } from "@/lib/format"

import { REPORT_META, type ReportColumn, type ReportData, type ReportRow } from "./definitions"
import { formatCell, isNumeric } from "./format-cell"

// Built-in Helvetica: no font download needed, so PDFs work offline at the venue.
const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 8.5, fontFamily: "Helvetica", color: "#1d2433" },
  header: { borderBottomWidth: 2, borderBottomColor: "#2f4fb8", paddingBottom: 10, marginBottom: 12 },
  institution: { fontSize: 10, color: "#4a5568" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2 },
  meta: { fontSize: 9, color: "#4a5568", marginTop: 4 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  summaryBox: { width: "24%", marginRight: "1%", marginBottom: 6, padding: 7, backgroundColor: "#f1f3f9", borderRadius: 4 },
  summaryLabel: { fontSize: 7.5, color: "#4a5568" },
  summaryValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 2 },
  sectionTitle: { fontSize: 11.5, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4, color: "#2f4fb8" },
  groupTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 2 },
  tableHeader: { flexDirection: "row", backgroundColor: "#2f4fb8", color: "#ffffff", fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d9deea" },
  rowAlt: { backgroundColor: "#f8f9fc" },
  subtotal: { flexDirection: "row", backgroundColor: "#eef1f8", fontFamily: "Helvetica-Bold", borderTopWidth: 0.75, borderTopColor: "#9aa5c4" },
  total: { flexDirection: "row", backgroundColor: "#dce3f7", fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: "#2f4fb8", marginTop: 6 },
  cell: { paddingVertical: 3.5, paddingHorizontal: 4 },
  notes: { marginTop: 14, fontSize: 7.5, color: "#4a5568" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#718096" },
})

function Cells({ columns, row }: { columns: ReportColumn[]; row: ReportRow }) {
  const totalWidth = columns.reduce((s, c) => s + (c.width ?? 1), 0)
  return (
    <>
      {columns.map((c) => (
        <Text
          key={c.key}
          style={[styles.cell, { width: `${((c.width ?? 1) / totalWidth) * 100}%`, textAlign: isNumeric(c.format) ? "right" : "left" }]}
        >
          {formatCell(row[c.key], c.format)}
        </Text>
      ))}
    </>
  )
}

function ReportDocument({ data }: { data: ReportData }) {
  const header = Object.fromEntries(data.columns.map((c) => [c.key, c.label])) as ReportRow
  return (
    <Document title={`${data.title} — ${data.institution}`} author={data.generatedBy} creator="EduTrack" subject={data.period}>
      <Page size="LETTER" orientation={REPORT_META[data.type].landscape ? "landscape" : "portrait"} style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.institution}>{data.institution}</Text>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.meta}>
            {data.period} · {data.scope} · Generated {formatDateTime(data.generatedAt)} by {data.generatedBy}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          {data.summary.map((s) => (
            <View key={s.label} style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>{s.label}</Text>
              <Text style={styles.summaryValue}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* The column header repeats at the top of every page (fixed). */}
        <View style={styles.tableHeader} fixed>
          {data.columns.map((c) => (
            <Text
              key={c.key}
              style={[
                styles.cell,
                {
                  width: `${((c.width ?? 1) / data.columns.reduce((s, x) => s + (x.width ?? 1), 0)) * 100}%`,
                  textAlign: isNumeric(c.format) ? "right" : "left",
                },
              ]}
            >
              {String(header[c.key])}
            </Text>
          ))}
        </View>

        {data.sections.map((section, si) => (
          <View key={si}>
            {section.title ? (
              <Text style={styles.sectionTitle} minPresenceAhead={40}>
                {section.title}
              </Text>
            ) : null}
            {section.groups.map((group, gi) => (
              <View key={gi}>
                {group.title ? (
                  <Text style={styles.groupTitle} minPresenceAhead={30}>
                    {group.title}
                  </Text>
                ) : null}
                {group.rows.map((row, ri) => (
                  <View key={ri} style={ri % 2 ? [styles.row, styles.rowAlt] : styles.row} wrap={false}>
                    <Cells columns={data.columns} row={row} />
                  </View>
                ))}
                {group.subtotal ? (
                  <View style={styles.subtotal} wrap={false}>
                    <Cells columns={data.columns} row={group.subtotal} />
                  </View>
                ) : null}
              </View>
            ))}
            {section.subtotal ? (
              <View style={styles.total} wrap={false}>
                <Cells columns={data.columns} row={section.subtotal} />
              </View>
            ) : null}
          </View>
        ))}

        {data.grandTotal ? (
          <View style={styles.total} wrap={false}>
            <Cells columns={data.columns} row={data.grandTotal} />
          </View>
        ) : null}

        {data.rowCount === 0 ? <Text style={{ marginTop: 16 }}>No records match this report&apos;s filters.</Text> : null}

        <View style={styles.notes}>
          {data.notes.map((n) => (
            <Text key={n}>• {n}</Text>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {data.institution} · {data.title}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function renderPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument data={data} />)
}
