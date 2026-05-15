import type { ExtraItem, NetFromGrossData } from "../contract";
import { fmtCurrency, parseNum } from "../engine/format";
import { adaptToWordTable, buildStyledReportTable, buildWordTable } from "./wordTable";

export type ReportSection = {
  id: string;
  title: string;
  html: string;
  htmlForPdf: string;
};

type GrossFromNetData = {
  net: number;
  gross: number;
  sgk: number;
  issizlik: number;
  gelirVergisi: number;
  gelirVergisiBrut?: number;
  gelirVergisiIstisna?: number;
  gelirVergisiDilimleri?: string;
  damgaVergisi: number;
  damgaVergisiBrut?: number;
  damgaVergisiIstisna?: number;
};

type BuildReportSectionsInput = {
  selectedYear: number;
  ciplakBrut: string;
  extraItems: ExtraItem[];
  totalBrut: number;
  netFromGross: NetFromGrossData;
  grossFromNet: GrossFromNetData;
  notes: string;
};

function formatAmount(value: number): string {
  return fmtCurrency(value);
}

export function buildReportSections({
  selectedYear,
  ciplakBrut,
  extraItems,
  totalBrut,
  netFromGross,
  grossFromNet,
  notes,
}: BuildReportSectionsInput): ReportSection[] {
  const sections: ReportSection[] = [];

  const topInfo = adaptToWordTable({
    headers: ["Hesaplama Yılı", "Tarih"],
    rows: [[String(selectedYear), new Date().toLocaleDateString("tr-TR")]],
  });
  sections.push({
    id: "ust-bilgiler",
    title: "Üst Bilgiler",
    html: buildWordTable(topInfo.headers, topInfo.rows),
    htmlForPdf: buildStyledReportTable(topInfo.headers, topInfo.rows),
  });

  const componentRows: Array<{ label: string; value: string }> = [
    { label: "Çıplak Brüt Ücret", value: `${formatAmount(parseNum(ciplakBrut))}₺` },
  ];
  extraItems
    .filter((item) => parseNum(item.value) > 0)
    .forEach((item, index) => {
      componentRows.push({
        label: item.name || `Ek Kalem ${index + 1}`,
        value: `${formatAmount(parseNum(item.value))}₺`,
      });
    });
  componentRows.push({ label: "Giydirilmiş Brüt Ücret", value: `${formatAmount(totalBrut)}₺` });

  const componentTable = adaptToWordTable(componentRows);
  sections.push({
    id: "ana-hesap",
    title: "Ücret Bileşenleri",
    html: buildWordTable(componentTable.headers, componentTable.rows),
    htmlForPdf: buildStyledReportTable(componentTable.headers, componentTable.rows, { lastRowBg: "blue" }),
  });

  if (netFromGross.gross > 0) {
    const grossToNetRows: Array<{ label: string; value: string }> = [
      { label: "Brüt Ücret", value: `${formatAmount(netFromGross.gross)} ₺` },
      { label: "SGK Primi (%14)", value: `-${formatAmount(netFromGross.sgk)} ₺` },
      { label: "İşsizlik Primi (%1)", value: `-${formatAmount(netFromGross.issizlik)} ₺` },
    ];

    if ((netFromGross.gelirVergisiIstisna ?? 0) > 0) {
      grossToNetRows.push(
        {
          label: "Gelir Vergisi (Brüt)",
          value: `-${formatAmount(netFromGross.gelirVergisiBrut ?? 0)} ₺`,
        },
        {
          label: "Asg. Üc. Gelir Vergi İstisnası",
          value: `+${formatAmount(netFromGross.gelirVergisiIstisna ?? 0)} ₺`,
        },
        { label: "Net Gelir Vergisi", value: `-${formatAmount(netFromGross.gelirVergisi)} ₺` },
      );
    } else {
      grossToNetRows.push({
        label: `Gelir Vergisi ${netFromGross.gelirVergisiDilimleri || ""}`.trim(),
        value: `-${formatAmount(netFromGross.gelirVergisi)} ₺`,
      });
    }

    if ((netFromGross.damgaVergisiIstisna ?? 0) > 0) {
      grossToNetRows.push(
        {
          label: "Damga Vergisi (Brüt)",
          value: `-${formatAmount(netFromGross.damgaVergisiBrut ?? 0)} ₺`,
        },
        {
          label: "Asg. Üc. Damga Vergi İstisnası",
          value: `+${formatAmount(netFromGross.damgaVergisiIstisna ?? 0)} ₺`,
        },
        { label: "Net Damga Vergisi", value: `-${formatAmount(netFromGross.damgaVergisi)} ₺` },
      );
    } else {
      grossToNetRows.push({
        label: "Damga Vergisi (binde 7,59)",
        value: `-${formatAmount(netFromGross.damgaVergisi)} ₺`,
      });
    }

    grossToNetRows.push({ label: "Net Ücret", value: `${formatAmount(netFromGross.net)} ₺` });

    const grossToNetTable = adaptToWordTable(grossToNetRows);
    sections.push({
      id: "brutten-nete",
      title: "Brüt'ten Net'e Çeviri",
      html: buildWordTable(grossToNetTable.headers, grossToNetTable.rows),
      htmlForPdf: buildStyledReportTable(grossToNetTable.headers, grossToNetTable.rows, {
        lastRowBg: "green",
      }),
    });
  }

  if (grossFromNet.gross > 0) {
    const netToGrossRows: Array<{ label: string; value: string }> = [
      { label: "Net Ücret", value: `${formatAmount(grossFromNet.net)} ₺` },
      { label: "SGK Primi (%14)", value: `+${formatAmount(grossFromNet.sgk)} ₺` },
      { label: "İşsizlik Primi (%1)", value: `+${formatAmount(grossFromNet.issizlik)} ₺` },
    ];

    if ((grossFromNet.gelirVergisiIstisna ?? 0) > 0) {
      netToGrossRows.push(
        {
          label: "Gelir Vergisi (Brüt)",
          value: `+${formatAmount(grossFromNet.gelirVergisiBrut ?? 0)} ₺`,
        },
        {
          label: "Asg. Üc. Gelir Vergi İstisnası",
          value: `-${formatAmount(grossFromNet.gelirVergisiIstisna ?? 0)} ₺`,
        },
        { label: "Net Gelir Vergisi", value: `+${formatAmount(grossFromNet.gelirVergisi)} ₺` },
      );
    } else {
      netToGrossRows.push({
        label: "Gelir Vergisi",
        value: `+${formatAmount(grossFromNet.gelirVergisi)} ₺`,
      });
    }

    if ((grossFromNet.damgaVergisiIstisna ?? 0) > 0) {
      netToGrossRows.push(
        {
          label: "Damga Vergisi (Brüt)",
          value: `+${formatAmount(grossFromNet.damgaVergisiBrut ?? 0)} ₺`,
        },
        {
          label: "Asg. Üc. Damga Vergi İstisnası",
          value: `-${formatAmount(grossFromNet.damgaVergisiIstisna ?? 0)} ₺`,
        },
        { label: "Net Damga Vergisi", value: `+${formatAmount(grossFromNet.damgaVergisi)} ₺` },
      );
    } else {
      netToGrossRows.push({
        label: "Damga Vergisi (binde 7,59)",
        value: `+${formatAmount(grossFromNet.damgaVergisi)} ₺`,
      });
    }

    netToGrossRows.push({ label: "Brüt Ücret", value: `${formatAmount(grossFromNet.gross)} ₺` });

    const netToGrossTable = adaptToWordTable(netToGrossRows);
    sections.push({
      id: "netten-brute",
      title: "Net'ten Brüt'e Çeviri",
      html: buildWordTable(netToGrossTable.headers, netToGrossTable.rows),
      htmlForPdf: buildStyledReportTable(netToGrossTable.headers, netToGrossTable.rows, {
        lastRowBg: "green",
      }),
    });
  }

  if (notes.trim()) {
    const notesTable = adaptToWordTable({ headers: ["Notlar"], rows: [[notes.trim()]] });
    sections.push({
      id: "sonuc",
      title: "Notlar",
      html: buildWordTable(notesTable.headers, notesTable.rows),
      htmlForPdf: buildStyledReportTable(notesTable.headers, notesTable.rows),
    });
  }

  return sections;
}
