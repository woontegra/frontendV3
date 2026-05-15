export type CoefficientReportInfoRow = { label: string; value: string; condition?: boolean };

export type CoefficientReportConfig = {
  title: string;
  sections?: { info?: boolean; periodTable?: boolean; grossToNet?: boolean };
  infoRows?: CoefficientReportInfoRow[];
  periodData?: {
    title?: string;
    headers: string[];
    rows: string[][];
    alignRight?: number[];
  };
  grossToNetData?: {
    title?: string;
    rows: Array<{ label: string; value: string; isDeduction?: boolean; isNet?: boolean }>;
  };
};

const FONT = "9px";

/** Yazdır / PDF için `#report-content` içi (V2 `ReportContentFromConfig` ile uyumlu veri) */
export default function CoefficientReportPrintDom({ config }: { config: CoefficientReportConfig }) {
  const sections = config.sections ?? {};
  const infoFiltered = (config.infoRows ?? []).filter((r) => r.condition !== false);
  const pd = config.periodData;
  const gnd = config.grossToNetData;

  return (
    <div
      style={{
        maxWidth: "16cm",
        width: "100%",
        margin: "0 auto",
        fontSize: FONT,
        fontFamily: "Inter, Arial, sans-serif",
        color: "#111827",
      }}
    >
      <p style={{ textAlign: "right", fontSize: FONT, color: "#6b7280", margin: "0 0 8px" }}>
        Tarih: {new Date().toLocaleDateString("tr-TR")}
      </p>
      <h1 style={{ fontSize: "11px", textAlign: "center", margin: "0 0 12px", fontWeight: 700 }}>{config.title}</h1>

      {sections.info !== false && infoFiltered.length > 0 ? (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #999",
            fontSize: FONT,
            marginBottom: 14,
          }}
        >
          <tbody>
            {infoFiltered.map((row, idx) => (
              <tr key={idx}>
                <td
                  style={{
                    border: "1px solid #999",
                    padding: "5px 8px",
                    background: "#f9fafb",
                    fontWeight: 600,
                    width: "30%",
                  }}
                >
                  {row.label}
                </td>
                <td style={{ border: "1px solid #999", padding: "5px 8px" }}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {sections.periodTable !== false && pd && pd.rows.length > 0 ? (
        <>
          {pd.title ? (
            <div style={{ fontSize: FONT, fontWeight: 700, marginBottom: 4, textAlign: "left" }}>{pd.title}</div>
          ) : null}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #999",
              fontSize: FONT,
              marginBottom: 14,
            }}
          >
            <thead>
              <tr>
                {pd.headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      border: "1px solid #999",
                      padding: "5px 8px",
                      background: "#f3f4f6",
                      textAlign: pd.alignRight?.includes(i) ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pd.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        border: "1px solid #999",
                        padding: "5px 8px",
                        textAlign: pd.alignRight?.includes(ci) ? "right" : "left",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {sections.grossToNet !== false && gnd && gnd.rows.length > 0 ? (
        <>
          <div style={{ fontSize: FONT, fontWeight: 700, marginBottom: 4, textAlign: "left" }}>
            {gnd.title || "Brütten Nete"}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #999", fontSize: FONT }}>
            <tbody>
              {gnd.rows.map((row, i) => (
                <tr key={i}>
                  <td
                    style={{
                      border: "1px solid #999",
                      padding: "5px 8px",
                      fontWeight: row.isNet ? 600 : 400,
                    }}
                  >
                    {row.label}
                  </td>
                  <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right" }}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
