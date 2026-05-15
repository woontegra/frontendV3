export function buildWordTable(headers: string[], rows: (string | number)[][]): string {
  let table = '<table border="1" cellpadding="2" cellspacing="0">';

  if (headers.length > 0) {
    table += "<thead><tr>";
    headers.forEach((header) => {
      table += `<th scope="col">${header}</th>`;
    });
    table += "</tr></thead>";
  }

  table += "<tbody>";
  rows.forEach((row) => {
    table += "<tr>";
    row.forEach((cell) => {
      table += `<td>${cell ?? ""}</td>`;
    });
    table += "</tr>";
  });
  table += "</tbody></table><p>&nbsp;</p>";

  return table;
}

export function adaptToWordTable(data: unknown): { headers: string[]; rows: (string | number)[][] } {
  if (
    data &&
    typeof data === "object" &&
    "headers" in data &&
    "rows" in data &&
    Array.isArray((data as { headers: unknown }).headers) &&
    Array.isArray((data as { rows: unknown }).rows)
  ) {
    return data as { headers: string[]; rows: (string | number)[][] };
  }

  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] && "label" in data[0]) {
    return {
      headers: ["Kalem", "Tutar"],
      rows: data.map((item) => {
        const row = item as { label: string; value: string };
        return [row.label, row.value];
      }),
    };
  }

  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0]) {
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const rows = data.map((item) =>
      headers.map((key) => String((item as Record<string, unknown>)[key] ?? "")),
    );
    return { headers, rows };
  }

  return { headers: [], rows: [] };
}

export function buildStyledReportTable(
  headers: string[],
  rows: (string | number)[][],
  opts?: { lastRowBg?: "blue" | "green" },
): string {
  let html =
    '<table style="width:100%;border-collapse:collapse;border:1px solid #999;font-size:10px">';

  if (headers.length > 0) {
    html += '<tr style="background:#f3f4f6;font-weight:600">';
    headers.forEach((header, index) => {
      const align = index === headers.length - 1 ? ";text-align:right" : "";
      html += `<td style="border:1px solid #999;padding:5px 8px;font-size:10px${align}"><strong>${header}</strong></td>`;
    });
    html += "</tr>";
  }

  rows.forEach((row, rowIndex) => {
    const isLast = rowIndex === rows.length - 1;
    const bg =
      opts?.lastRowBg === "green" && isLast
        ? "#dcfce7"
        : opts?.lastRowBg === "blue" && isLast
          ? "#dbeafe"
          : undefined;
    const rowStyle = bg ? ` style="background:${bg};font-weight:600"` : "";
    html += `<tr${rowStyle}>`;

    row.forEach((cell, cellIndex) => {
      const value = String(cell ?? "");
      const isLastCol = cellIndex === row.length - 1;
      const extra: string[] = [];
      if (isLastCol) {
        extra.push("text-align:right");
      }
      if (value.trimStart().startsWith("-")) {
        extra.push("color:#dc2626");
      } else if (
        value.trimStart().startsWith("+") ||
        (isLast && opts?.lastRowBg === "green" && isLastCol)
      ) {
        extra.push("color:#16a34a");
      }
      html += `<td style="border:1px solid #999;padding:5px 8px;font-size:10px;${extra.join(";")}">${value}</td>`;
    });
    html += "</tr>";
  });

  return `${html}</table>`;
}
