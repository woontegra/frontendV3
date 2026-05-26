/**
 * Ücret Alacağı — V3 (V2 ile aynı hesaplama kabuğu; manuel ücret şablonu destekli).
 */

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getDaysInMonth } from "date-fns";
import { Video, Copy } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { apiClient } from "@/utils/apiClient";
import { asgariUcretler, getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import type { FazlaMesaiRowBase } from "@modules/fazla-mesai/shared";
import { calcWorkPeriodBilirKisi } from "@/calculations/ihbar-tazminati/utils";
import {
  calculateSegmentedNetFromRows,
  calculateSegmentedGrossFromNetRows,
  calculateSegmentedGrossFromBrutCetvelRows,
  computeNetFromGrossSingle,
  computeGrossFromNetSingle,
} from "./incomeTaxCore";
import { UcretConversionCards, EMPTY_CONVERSION_PANEL, type ConversionPanelData } from "./UcretConversionCards";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { loadSavedCase } from "@/calculations/shared/loadSavedCase";
import { ManualBrutWageApplyControls } from "@/features/manual-brut-wage/ManualBrutWageApplyControls";
import UbgtKatsayiModal from "./UbgtKatsayiModal";
import { getAsgariNetUcretForPeriod } from "./asgariNetUcretler";
import {
  NET_CETVEL_FOOTER,
  calcCetvelGrandTotal,
  calcRowUcretTotal,
  type HesaplamaTab,
} from "./ucretAlacagiCalc";

const PAGE_HEADING = "Ücret Alacağı";
const PREVIEW_TITLE = "Ücret Alacağı Rapor";
const REDIRECT_PATH = "/ucret-alacagi";
const RECORD_TYPE = "ucret_alacagi";

const FORM_LABELS = {
  START_DATE: "Çalışma dönemi başlangıcı",
  END_DATE: "Çalışma dönemi sonu",
  GROSS_TO_NET: "Brütten Nete Çevir",
  NET_TO_GROSS: "Netten Brüte Çevir",
  GROSS_SALARY: "Çıplak Brüt Ücret",
  NET_SALARY: "Net Ücret",
};
const NOTE_TEXT = "Bu alan bilgi amaçlıdır ve ileride güncellenecektir.";

const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

interface CetvelRow {
  id: string;
  rangeLabel: string;
  startISO: string;
  endISO: string;
  katsayi: number;
  ucret: number;
  gunSayisi: number;
  ayGunSayisi: number;
  ucretManual: boolean;
  odenenUcret: number;
  netVerisiYok?: boolean;
}

const formatDateTR = (dateStr: string): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
};

function getAsgariUcretForPeriod(startISO: string): number {
  const v = getAsgariUcretByDate(startISO);
  return v ?? asgariUcretler[asgariUcretler.length - 1].brut;
}

function cetvelRowsToApiRows(rows: CetvelRow[]): { start: string; end: string; days: number }[] {
  return rows
    .map((r) => {
      const start = r.startISO || (r as { start?: string }).start || "";
      const end = r.endISO || (r as { end?: string }).end || "";
      const days = r.gunSayisi ?? (r as { days?: number }).days ?? 0;
      return { start, end, days };
    })
    .filter((r) => r.start && r.end && r.days > 0);
}

function applyNetCetvelFromCetvelRows(
  prevNet: CetvelRow[],
  brutRows: CetvelRow[],
  netKatsayi: number
): CetvelRow[] {
  const apiRows = cetvelRowsToApiRows(brutRows);
  if (apiRows.length === 0) return [];
  return mergeNetCetvelWithApi(prevNet, apiRows, netKatsayi);
}

function cetvelSpanKey(startISO: string, endISO: string) {
  return `${startISO}\0${endISO}`;
}

function mergeCetvelWithApi(
  prev: CetvelRow[],
  apiRows: { start: string; end: string; days: number }[],
  globalKatsayiNow: number
): CetvelRow[] {
  const prevBySpan = new Map(prev.map((r) => [cetvelSpanKey(r.startISO, r.endISO), r]));
  return apiRows.map((row, idx) => {
    const startISO = row.start;
    const endISO = row.end;
    const existing = prevBySpan.get(cetvelSpanKey(startISO, endISO));
    const ayGunSayisi = getDaysInMonth(new Date(row.start));
    if (existing) {
      return {
        ...existing,
        rangeLabel: `${formatDateTR(startISO)} – ${formatDateTR(endISO)}`,
        startISO,
        endISO,
        gunSayisi: row.days,
        ayGunSayisi,
      };
    }
    return {
      id: `row-${idx}-${startISO}`,
      rangeLabel: `${formatDateTR(startISO)} – ${formatDateTR(endISO)}`,
      startISO,
      endISO,
      katsayi: globalKatsayiNow,
      ucret: getAsgariUcretForPeriod(startISO),
      gunSayisi: row.days,
      ayGunSayisi,
      ucretManual: false,
      odenenUcret: 0,
    };
  });
}

function mergeNetCetvelWithApi(
  prev: CetvelRow[],
  apiRows: { start: string; end: string; days: number }[],
  globalKatsayiNow: number
): CetvelRow[] {
  const prevBySpan = new Map(prev.map((r) => [cetvelSpanKey(r.startISO, r.endISO), r]));
  return apiRows.map((row, idx) => {
    const startISO = row.start;
    const endISO = row.end;
    const existing = prevBySpan.get(cetvelSpanKey(startISO, endISO));
    const ayGunSayisi = getDaysInMonth(new Date(row.start));
    if (existing) {
      return {
        ...existing,
        rangeLabel: `${formatDateTR(startISO)} – ${formatDateTR(endISO)}`,
        startISO,
        endISO,
        gunSayisi: row.days,
        ayGunSayisi,
      };
    }
    const netVal = getAsgariNetUcretForPeriod(startISO);
    return {
      id: `net-row-${idx}-${startISO}`,
      rangeLabel: `${formatDateTR(startISO)} – ${formatDateTR(endISO)}`,
      startISO,
      endISO,
      katsayi: globalKatsayiNow,
      ucret: netVal ?? 0,
      gunSayisi: row.days,
      ayGunSayisi,
      ucretManual: false,
      odenenUcret: 0,
      netVerisiYok: netVal == null,
    };
  });
}

function cetvelRowBgCls(idx: number, isOdenenFocused: boolean): string {
  if (isOdenenFocused) {
    return "bg-red-50 dark:bg-red-950/40 ring-2 ring-inset ring-red-300 dark:ring-red-700";
  }
  return idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/80";
}

const tabBtnCls = (active: boolean) =>
  `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
    active
      ? "bg-blue-600 text-white shadow-sm"
      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
  }`;

function parseInputAmount(v: string): number {
  const clean = String(v || "").replace(/₺/g, "").replace(/\s/g, "").trim();
  if (!clean) return 0;
  return parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
}

function syncCetvelRowsFromDom(tab: HesaplamaTab, brutRows: CetvelRow[], netRows: CetvelRow[]): CetvelRow[] {
  const container = document.getElementById("ucret-print") || document;
  const result = (tab === "net" ? netRows : brutRows).map((r) => ({ ...r }));

  if (tab === "net") {
    container.querySelectorAll<HTMLInputElement>("input[data-net-ucret-row]").forEach((inp) => {
      const rowId = inp.getAttribute("data-net-ucret-row");
      if (!rowId) return;
      const idx = result.findIndex((r) => r.id === rowId);
      if (idx >= 0) result[idx] = { ...result[idx], ucret: parseInputAmount(inp.value), ucretManual: true };
    });
    container.querySelectorAll<HTMLInputElement>("input[data-net-katsayi-row]").forEach((inp) => {
      const rowId = inp.getAttribute("data-net-katsayi-row");
      if (!rowId) return;
      const num = parseFloat(String(inp.value || "").replace(",", ".")) || 1;
      const idx = result.findIndex((r) => r.id === rowId);
      if (idx >= 0) result[idx] = { ...result[idx], katsayi: num };
    });
    container.querySelectorAll<HTMLInputElement>("input[data-net-odenen-row]").forEach((inp) => {
      const rowId = inp.getAttribute("data-net-odenen-row");
      if (!rowId) return;
      const idx = result.findIndex((r) => r.id === rowId);
      if (idx >= 0) result[idx] = { ...result[idx], odenenUcret: parseInputAmount(inp.value) };
    });
    return result;
  }

  container.querySelectorAll<HTMLInputElement>("input[data-ucret-row]").forEach((inp) => {
    const rowId = inp.getAttribute("data-ucret-row");
    if (!rowId) return;
    const idx = result.findIndex((r) => r.id === rowId);
    if (idx >= 0) result[idx] = { ...result[idx], ucret: parseInputAmount(inp.value), ucretManual: true };
  });
  container.querySelectorAll<HTMLInputElement>("input[data-katsayi-row]").forEach((inp) => {
    const rowId = inp.getAttribute("data-katsayi-row");
    if (!rowId) return;
    const num = parseFloat(String(inp.value || "").replace(",", ".")) || 1;
    const idx = result.findIndex((r) => r.id === rowId);
    if (idx >= 0) result[idx] = { ...result[idx], katsayi: num };
  });
  container.querySelectorAll<HTMLInputElement>("input[data-odenen-row]").forEach((inp) => {
    const rowId = inp.getAttribute("data-odenen-row");
    if (!rowId) return;
    const idx = result.findIndex((r) => r.id === rowId);
    if (idx >= 0) result[idx] = { ...result[idx], odenenUcret: parseInputAmount(inp.value) };
  });
  return result;
}

function buildUcretReportConfig(params: {
  tab: HesaplamaTab;
  rows: CetvelRow[];
  startDate: string;
  endDate: string;
  workPeriodLabel: string;
  totalAmount: number;
  hasCustomKatsayi: boolean;
  globalKatsayi: number;
  conversionPanel: ConversionPanelData;
}): ReportConfig {
  const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isNetTab = params.tab === "net";

  const conversionRows: Array<{ label: string; value: string; isDeduction?: boolean; isNet?: boolean }> = isNetTab
    ? [
        { label: "Net Ücret", value: `${fmtLocal(params.conversionPanel.net)}₺` },
        { label: "SGK Primi (%14)", value: `+${fmtLocal(params.conversionPanel.sgk)}₺`, isDeduction: true },
        { label: "İşsizlik Primi (%1)", value: `+${fmtLocal(params.conversionPanel.issizlik)}₺`, isDeduction: true },
      ]
    : [
        { label: "Brüt Ücret", value: `${fmtLocal(params.conversionPanel.gross)}₺` },
        { label: "SGK Primi (%14)", value: `-${fmtLocal(params.conversionPanel.sgk)}₺`, isDeduction: true },
        { label: "İşsizlik Primi (%1)", value: `-${fmtLocal(params.conversionPanel.issizlik)}₺`, isDeduction: true },
      ];

  if (params.conversionPanel.gelirVergisiIstisna > 0) {
    if (isNetTab) {
      conversionRows.push(
        { label: "Gelir Vergisi (Brüt)", value: `+${fmtLocal(params.conversionPanel.gelirVergisiBrut)}₺`, isDeduction: true },
        { label: "Asg. Üc. Gelir Vergi İstisnası", value: `-${fmtLocal(params.conversionPanel.gelirVergisiIstisna)}₺` },
        { label: "Net Gelir Vergisi", value: `+${fmtLocal(params.conversionPanel.gelirVergisi)}₺`, isDeduction: true }
      );
    } else {
      conversionRows.push(
        { label: "Gelir Vergisi (Brüt)", value: `-${fmtLocal(params.conversionPanel.gelirVergisiBrut)}₺`, isDeduction: true },
        { label: "Asg. Üc. Gelir Vergi İstisnası", value: `+${fmtLocal(params.conversionPanel.gelirVergisiIstisna)}₺` },
        { label: "Net Gelir Vergisi", value: `-${fmtLocal(params.conversionPanel.gelirVergisi)}₺`, isDeduction: true }
      );
    }
  } else {
    conversionRows.push({
      label: "Gelir Vergisi " + (params.conversionPanel.gelirVergisiDilimleri || ""),
      value: isNetTab
        ? `+${fmtLocal(params.conversionPanel.gelirVergisi)}₺`
        : `-${fmtLocal(params.conversionPanel.gelirVergisi)}₺`,
      isDeduction: true,
    });
  }

  if (params.conversionPanel.damgaVergisiIstisna > 0) {
    if (isNetTab) {
      conversionRows.push(
        { label: "Damga Vergisi (Brüt)", value: `+${fmtLocal(params.conversionPanel.damgaVergisiBrut)}₺`, isDeduction: true },
        { label: "Asg. Üc. Damga Vergi İstisnası", value: `-${fmtLocal(params.conversionPanel.damgaVergisiIstisna)}₺` },
        { label: "Net Damga Vergisi", value: `+${fmtLocal(params.conversionPanel.damgaVergisi)}₺`, isDeduction: true }
      );
    } else {
      conversionRows.push(
        { label: "Damga Vergisi (Brüt)", value: `-${fmtLocal(params.conversionPanel.damgaVergisiBrut)}₺`, isDeduction: true },
        { label: "Asg. Üc. Damga Vergi İstisnası", value: `+${fmtLocal(params.conversionPanel.damgaVergisiIstisna)}₺` },
        { label: "Net Damga Vergisi", value: `-${fmtLocal(params.conversionPanel.damgaVergisi)}₺`, isDeduction: true }
      );
    }
  } else {
    conversionRows.push({
      label: "Damga Vergisi (binde 7,59)",
      value: isNetTab
        ? `+${fmtLocal(params.conversionPanel.damgaVergisi)}₺`
        : `-${fmtLocal(params.conversionPanel.damgaVergisi)}₺`,
      isDeduction: true,
    });
  }

  conversionRows.push(
    isNetTab
      ? { label: "Brüt Ücret", value: `${fmtLocal(params.conversionPanel.gross)}₺`, isNet: true }
      : { label: "Net Ücret", value: `${fmtLocal(params.conversionPanel.net)}₺`, isNet: true }
  );

  return {
    title: "Ücret Alacağı",
    sections: { info: true, periodTable: true, grossToNet: true },
    infoRows: [
      { label: "Çalışma Dönemi Başlangıcı", value: params.startDate ? new Date(params.startDate).toLocaleDateString("tr-TR") : "-" },
      { label: "Çalışma Dönemi Sonu", value: params.endDate ? new Date(params.endDate).toLocaleDateString("tr-TR") : "-" },
      { label: "Çalışma Süresi", value: params.workPeriodLabel || "-" },
      { label: "Katsayı", value: params.globalKatsayi.toString(), condition: params.hasCustomKatsayi },
    ],
    periodData: {
      title: isNetTab ? "Net Ücret Hesaplama Cetveli" : "Ücret Hesaplama Cetveli",
      fontSize: "10px",
      headers: isNetTab
        ? ["Tarih Aralığı", "Gün Sayısı", "Katsayı", "Net Ücret (₺)", "Ödenen Ücret", "Toplam (₺)"]
        : ["Tarih Aralığı", "Gün Sayısı", "Katsayı", "Ücret (₺)", "Ödenen Ücret", "Toplam (₺)"],
      rows: params.rows.map((row) => [
        row.rangeLabel,
        row.gunSayisi.toString(),
        row.katsayi.toFixed(4).replace(".", ","),
        `${fmtLocal(row.ucret)}₺`,
        (row.odenenUcret ?? 0) > 0 ? `${fmtLocal(row.odenenUcret)}₺` : "-",
        `${fmtLocal(calcRowUcretTotal(row))}₺`,
      ]),
      footer: isNetTab
        ? ["Toplam Net Ücret:", "", "", "", "", `${fmtLocal(params.totalAmount)}₺`]
        : ["Toplam Brüt Ücret:", "", "", "", "", `${fmtLocal(params.totalAmount)}₺`],
      alignRight: [1, 2, 3, 4, 5],
    },
    grossToNetData: {
      title: isNetTab ? "Netten Brüte Çeviri" : "Brütten Nete Çeviri",
      fontSize: "10px",
      rows: conversionRows,
    },
  };
}

function buildWordTableSectionsFromConfig(config: ReportConfig) {
  const sections: Array<{ id: string; title: string; html: string }> = [];

  const infoRowsFiltered = (config.infoRows || []).filter((r) => r.condition !== false);
  if (infoRowsFiltered.length > 0) {
    const n1 = adaptToWordTable({
      headers: ["Alan", "Değer"],
      rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
    });
    sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
  }

  const pd = config.periodData;
  if (pd?.rows?.length) {
    const periodRows = [...pd.rows];
    if (pd.footer?.length) periodRows.push(pd.footer);
    const n2 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
    sections.push({
      id: "ucret-hesaplama",
      title: pd.title || "Ücret Hesaplama Cetveli",
      html: buildWordTable(n2.headers, n2.rows),
    });
  }

  const gnd = config.grossToNetData?.rows;
  if (gnd?.length) {
    const n3 = adaptToWordTable(gnd);
    sections.push({
      id: "brutten-nete",
      title: config.grossToNetData?.title || "Brütten Nete Çeviri",
      html: buildWordTable(n3.headers, n3.rows),
    });
  }

  return sections;
}

function mapSavedCetvelRows(rowsSource: unknown[]): CetvelRow[] {
  return rowsSource.map((r: Record<string, unknown>) => {
    const odenenRaw = r.odenenUcret ?? r.odenen_ucret ?? r.OdenenUcret ?? 0;
    const odenen = Number(odenenRaw) || 0;
    const startISO = String(r.startISO ?? r.start ?? "");
    const endISO = String(r.endISO ?? r.end ?? "");
    const gunSayisi = Number(r.gunSayisi ?? r.days ?? 0) || 0;
    const ayGunSayisi =
      Number(r.ayGunSayisi ?? r.ay_gun_sayisi ?? 0) || getDaysInMonth(new Date(startISO || Date.now()));
    return {
      ...r,
      id: String(r.id ?? `row-${startISO}`),
      rangeLabel: String(r.rangeLabel ?? `${formatDateTR(startISO)} – ${formatDateTR(endISO)}`),
      startISO,
      endISO,
      katsayi: Number(r.katsayi ?? 1) || 1,
      ucret: Number(r.ucret ?? 0) || 0,
      gunSayisi,
      ayGunSayisi,
      ucretManual: Boolean(r.ucretManual),
      odenenUcret: odenen,
      netVerisiYok: r.netVerisiYok != null ? Boolean(r.netVerisiYok) : undefined,
    };
  }) as CetvelRow[];
}

function segmentedToConversionPanel(d: {
  totalGross: number;
  totalNet: number;
  totalSgk: number;
  totalIssizlik: number;
  totalGelirVergisi: number;
  totalGelirVergisiBrut: number;
  totalGelirVergisiIstisna: number;
  totalDamgaVergisi: number;
  totalDamgaVergisiBrut: number;
  totalDamgaVergisiIstisna: number;
}): ConversionPanelData {
  return {
    gross: d.totalGross,
    net: d.totalNet,
    sgk: d.totalSgk,
    issizlik: d.totalIssizlik,
    gelirVergisi: d.totalGelirVergisi,
    gelirVergisiBrut: d.totalGelirVergisiBrut,
    gelirVergisiIstisna: d.totalGelirVergisiIstisna,
    gelirVergisiDilimleri: "",
    damgaVergisi: d.totalDamgaVergisi,
    damgaVergisiBrut: d.totalDamgaVergisiBrut,
    damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
  };
}

function conversionPanelFromRows(tab: HesaplamaTab, rows: CetvelRow[]): ConversionPanelData {
  if (!rows.length) return EMPTY_CONVERSION_PANEL;
  if (tab === "net") {
    const eligible = rows.filter((row) => row.ucret > 0 && (!row.netVerisiYok || row.ucretManual));
    if (!eligible.length) return EMPTY_CONVERSION_PANEL;
    return segmentedToConversionPanel(calculateSegmentedGrossFromNetRows(eligible));
  }
  return segmentedToConversionPanel(calculateSegmentedNetFromRows(rows));
}

export default function UcretAlacagiPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  const videoLink = getVideoLink("ucret-alacagi");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCetvel, setShowCetvel] = useState(false);
  const [cetvelRows, setCetvelRows] = useState<CetvelRow[]>([]);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [globalKatsayi, setGlobalKatsayi] = useState(1);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);
  const [grossForNet, setGrossForNet] = useState("");
  const [netForGross, setNetForGross] = useState("");
  const [netTabGrossForNet, setNetTabGrossForNet] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [manualWageFromTemplateActive, setManualWageFromTemplateActive] = useState(false);
  const [activeTab, setActiveTab] = useState<HesaplamaTab>("brut");
  const [focusedOdenenRowId, setFocusedOdenenRowId] = useState<string | null>(null);
  const [netCetvelRows, setNetCetvelRows] = useState<CetvelRow[]>([]);
  const [showNetCetvel, setShowNetCetvel] = useState(false);
  const [netGlobalKatsayi, setNetGlobalKatsayi] = useState(1);
  const [netHasCustomKatsayi, setNetHasCustomKatsayi] = useState(false);
  const [katsayiModalTarget, setKatsayiModalTarget] = useState<HesaplamaTab>("brut");
  const loadRanRef = useRef(false);
  const calcRequestIdRef = useRef(0);
  const netCalcRequestIdRef = useRef(0);
  const globalKatsayiRef = useRef(globalKatsayi);
  const netGlobalKatsayiRef = useRef(netGlobalKatsayi);
  const cetvelRowsRef = useRef<CetvelRow[]>([]);
  const netCetvelRowsRef = useRef<CetvelRow[]>([]);

  useEffect(() => {
    globalKatsayiRef.current = globalKatsayi;
  }, [globalKatsayi]);

  useEffect(() => {
    cetvelRowsRef.current = cetvelRows;
  }, [cetvelRows]);

  useEffect(() => {
    netGlobalKatsayiRef.current = netGlobalKatsayi;
  }, [netGlobalKatsayi]);

  useEffect(() => {
    netCetvelRowsRef.current = netCetvelRows;
  }, [netCetvelRows]);

  const selectedYear = useMemo(() => {
    if (endDate && endDate.trim() !== "") {
      const exitDate = new Date(endDate);
      if (!isNaN(exitDate.getTime())) {
        const year = exitDate.getFullYear();
        if (year >= 2010 && year <= 2030) return year;
      }
    }
    return new Date().getFullYear();
  }, [endDate]);

  const workPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    const result = calcWorkPeriodBilirKisi(startDate, endDate);
    if (!result.label) return null;
    return result;
  }, [startDate, endDate]);

  const netFromGross = useMemo((): ConversionPanelData => {
    if (!cetvelRows.length) return EMPTY_CONVERSION_PANEL;
    const d = calculateSegmentedNetFromRows(cetvelRows);
    return {
      gross: d.totalGross,
      sgk: d.totalSgk,
      issizlik: d.totalIssizlik,
      gelirVergisi: d.totalGelirVergisi,
      gelirVergisiBrut: d.totalGelirVergisiBrut,
      gelirVergisiIstisna: d.totalGelirVergisiIstisna,
      gelirVergisiDilimleri: "",
      damgaVergisi: d.totalDamgaVergisi,
      damgaVergisiBrut: d.totalDamgaVergisiBrut,
      damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
      net: d.totalNet,
    };
  }, [cetvelRows]);

  const netTabGrossFromCetvel = useMemo((): ConversionPanelData => {
    const eligible = netCetvelRows.filter((row) => row.ucret > 0 && (!row.netVerisiYok || row.ucretManual));
    if (!eligible.length) return EMPTY_CONVERSION_PANEL;
    const d = calculateSegmentedGrossFromNetRows(eligible);
    return {
      gross: d.totalGross,
      sgk: d.totalSgk,
      issizlik: d.totalIssizlik,
      gelirVergisi: d.totalGelirVergisi,
      gelirVergisiBrut: d.totalGelirVergisiBrut,
      gelirVergisiIstisna: d.totalGelirVergisiIstisna,
      gelirVergisiDilimleri: "",
      damgaVergisi: d.totalDamgaVergisi,
      damgaVergisiBrut: d.totalDamgaVergisiBrut,
      damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
      net: d.totalNet,
    };
  }, [netCetvelRows]);

  const netVal = useMemo(() => parseNum(netForGross), [netForGross]);
  const netTabGrossVal = useMemo(() => parseNum(netTabGrossForNet), [netTabGrossForNet]);

  const brutTabGrossFromNetManual = useMemo((): ConversionPanelData => {
    if (netVal <= 0) return EMPTY_CONVERSION_PANEL;

    const cetvelNet = netFromGross.net;
    const useSegmented =
      cetvelRows.length > 0 && cetvelNet > 0 && Math.abs(netVal - cetvelNet) < 0.02;

    const d = useSegmented
      ? calculateSegmentedGrossFromBrutCetvelRows(cetvelRows)
      : computeGrossFromNetSingle(netVal, selectedYear);

    return {
      gross: d.totalGross,
      net: useSegmented ? netVal : d.totalNet,
      sgk: d.totalSgk,
      issizlik: d.totalIssizlik,
      gelirVergisi: d.totalGelirVergisi,
      gelirVergisiBrut: d.totalGelirVergisiBrut,
      gelirVergisiIstisna: d.totalGelirVergisiIstisna,
      gelirVergisiDilimleri: "",
      damgaVergisi: d.totalDamgaVergisi,
      damgaVergisiBrut: d.totalDamgaVergisiBrut,
      damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
    };
  }, [netVal, selectedYear, cetvelRows, netFromGross.net]);

  const netTabNetFromGrossManual = useMemo((): ConversionPanelData => {
    if (netTabGrossVal <= 0) return EMPTY_CONVERSION_PANEL;

    const eligible = netCetvelRows.filter((row) => row.ucret > 0 && (!row.netVerisiYok || row.ucretManual));
    const cetvelGross = netTabGrossFromCetvel.gross;
    const useSegmented =
      eligible.length > 0 && cetvelGross > 0 && Math.abs(netTabGrossVal - cetvelGross) < 0.02;

    const d = useSegmented
      ? calculateSegmentedGrossFromNetRows(eligible)
      : computeNetFromGrossSingle(netTabGrossVal, selectedYear);

    return {
      gross: useSegmented ? netTabGrossVal : d.totalGross,
      sgk: d.totalSgk,
      issizlik: d.totalIssizlik,
      gelirVergisi: d.totalGelirVergisi,
      gelirVergisiBrut: d.totalGelirVergisiBrut,
      gelirVergisiIstisna: d.totalGelirVergisiIstisna,
      gelirVergisiDilimleri: "",
      damgaVergisi: d.totalDamgaVergisi,
      damgaVergisiBrut: d.totalDamgaVergisiBrut,
      damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
      net: d.totalNet,
    };
  }, [netTabGrossVal, selectedYear, netCetvelRows, netTabGrossFromCetvel.gross]);

  const totalBrut = useMemo(() => {
    const brutToplam = cetvelRows.reduce((acc, row) => {
      const isFullMonth = row.gunSayisi === row.ayGunSayisi;
      const rowTotal = isFullMonth ? row.ucret * row.katsayi : (row.ucret / 30) * row.gunSayisi * row.katsayi;
      return acc + rowTotal;
    }, 0);
    const odenenToplam = cetvelRows.reduce((acc, row) => acc + (row.odenenUcret || 0), 0);
    return Math.max(0, brutToplam - odenenToplam);
  }, [cetvelRows]);

  const totalNet = useMemo(() => calcCetvelGrandTotal(netCetvelRows), [netCetvelRows]);

  const applyGlobalCoefficient = useCallback((katsayi: number) => {
    if (!Number.isFinite(katsayi) || katsayi <= 0) return;
    if (katsayiModalTarget === "net") {
      setNetGlobalKatsayi(katsayi);
      setNetHasCustomKatsayi(true);
      setNetCetvelRows((prev) => prev.map((row) => ({ ...row, katsayi })));
      return;
    }
    setGlobalKatsayi(katsayi);
    setHasCustomKatsayi(true);
    setCetvelRows((prev) => prev.map((row) => ({ ...row, katsayi })));
  }, [katsayiModalTarget]);

  const removeGlobalCoefficient = useCallback(() => {
    if (activeTab === "net") {
      setNetGlobalKatsayi(1);
      setNetHasCustomKatsayi(false);
      setNetCetvelRows((prev) => prev.map((row) => ({ ...row, katsayi: 1 })));
      return;
    }
    setGlobalKatsayi(1);
    setHasCustomKatsayi(false);
    setCetvelRows((prev) => prev.map((row) => ({ ...row, katsayi: 1 })));
  }, [activeTab]);

  const handleApplyManualBruts = useCallback((brutById: Record<string, number>) => {
    setCetvelRows((prev) =>
      prev.map((row) => {
        const b = brutById[row.id];
        if (b != null && Number.isFinite(b) && b > 0) {
          return { ...row, ucret: b, ucretManual: true };
        }
        return row;
      })
    );
    if (Object.keys(brutById).length > 0) setManualWageFromTemplateActive(true);
  }, []);

  const handleDeactivateManualTemplate = useCallback(() => {
    setCetvelRows((prev) =>
      prev.map((row) => ({
        ...row,
        ucret: getAsgariUcretForPeriod(row.startISO),
        ucretManual: false,
      }))
    );
    setManualWageFromTemplateActive(false);
  }, []);

  const generateCetvel = useCallback(async () => {
    calcRequestIdRef.current += 1;
    const currentRequestId = calcRequestIdRef.current;

    if (!startDate || !endDate) {
      if (currentRequestId !== calcRequestIdRef.current) return;
      setCetvelRows([]);
      setManualWageFromTemplateActive(false);
      setShowCetvel(false);
      setNetCetvelRows([]);
      setShowNetCetvel(false);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    if (start > end) return;

    try {
      const avgUcret = getAsgariUcretForPeriod(startDate);
      const monthly = Number(avgUcret) || getAsgariUcretForPeriod(endDate);
      if (!monthly || monthly <= 0) {
        if (currentRequestId !== calcRequestIdRef.current) return;
        showToastError("Seçilen dönem için asgari ücret bulunamadı. Lütfen tarih aralığını kontrol edin.");
        setCetvelRows([]);
        setManualWageFromTemplateActive(false);
        setShowCetvel(false);
        setNetCetvelRows([]);
        setShowNetCetvel(false);
        return;
      }

      const response = await apiClient(`/api/ucret-alacagi/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, monthly }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (currentRequestId !== calcRequestIdRef.current) return;
        const serverMessage = result?.error || `Sunucu hatası (${response.status})`;
        showToastError(serverMessage);
        setCetvelRows([]);
        setManualWageFromTemplateActive(false);
        setShowCetvel(false);
        setNetCetvelRows([]);
        setShowNetCetvel(false);
        return;
      }

      if (result.success && result.data?.rows) {
        const apiRows = result.data.rows as { start: string; end: string; days: number }[];
        if (currentRequestId !== calcRequestIdRef.current) return;
        const prevSnapshot = cetvelRowsRef.current;
        const merged = mergeCetvelWithApi(prevSnapshot, apiRows, globalKatsayiRef.current);
        setCetvelRows(merged);
        setManualWageFromTemplateActive((was) => was && merged.some((r) => r.ucretManual));
        setShowCetvel(true);
        const netMerged = mergeNetCetvelWithApi(netCetvelRowsRef.current, apiRows, netGlobalKatsayiRef.current);
        setNetCetvelRows(netMerged);
        setShowNetCetvel(true);
      } else {
        if (currentRequestId !== calcRequestIdRef.current) return;
        if (result.error) showToastError(result.error);
        setCetvelRows([]);
        setManualWageFromTemplateActive(false);
        setShowCetvel(false);
        setNetCetvelRows([]);
        setShowNetCetvel(false);
      }
    } catch {
      if (currentRequestId !== calcRequestIdRef.current) return;
      showToastError("Hesaplama sırasında bir hata oluştu");
      setCetvelRows([]);
      setManualWageFromTemplateActive(false);
      setShowCetvel(false);
      setNetCetvelRows([]);
      setShowNetCetvel(false);
    }
  }, [startDate, endDate, showToastError]);

  const generateNetCetvel = useCallback(async () => {
    netCalcRequestIdRef.current += 1;
    const currentRequestId = netCalcRequestIdRef.current;

    if (!startDate || !endDate) {
      if (currentRequestId !== netCalcRequestIdRef.current) return;
      setNetCetvelRows([]);
      setShowNetCetvel(false);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;

    try {
      const avgUcret = getAsgariUcretForPeriod(startDate);
      const monthly = Number(avgUcret) || getAsgariUcretForPeriod(endDate);
      if (!monthly || monthly <= 0) {
        if (currentRequestId !== netCalcRequestIdRef.current) return;
        setNetCetvelRows([]);
        setShowNetCetvel(false);
        return;
      }

      const response = await apiClient(`/api/ucret-alacagi/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, monthly }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !result.data?.rows) {
        if (currentRequestId !== netCalcRequestIdRef.current) return;
        setNetCetvelRows([]);
        setShowNetCetvel(false);
        return;
      }

      const apiRows = result.data.rows as { start: string; end: string; days: number }[];
      if (currentRequestId !== netCalcRequestIdRef.current) return;
      const merged = mergeNetCetvelWithApi(netCetvelRowsRef.current, apiRows, netGlobalKatsayiRef.current);
      setNetCetvelRows(merged);
      setShowNetCetvel(true);
    } catch {
      if (currentRequestId !== netCalcRequestIdRef.current) return;
      setNetCetvelRows([]);
      setShowNetCetvel(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (loadRanRef.current) return;
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;

    const timer = setTimeout(() => {
      void generateCetvel();
    }, 300);

    return () => clearTimeout(timer);
  }, [startDate, endDate, generateCetvel]);

  /** Brüt cetvel oluşunca net cetveli aynı dönem yapısından üret. */
  useEffect(() => {
    if (!startDate || !endDate) return;
    if (showNetCetvel && netCetvelRows.length > 0) return;
    if (cetvelRows.length === 0) return;

    const merged = applyNetCetvelFromCetvelRows(
      netCetvelRowsRef.current,
      cetvelRows,
      netGlobalKatsayiRef.current
    );
    if (merged.length === 0) return;
    setNetCetvelRows(merged);
    setShowNetCetvel(true);
  }, [startDate, endDate, cetvelRows, showNetCetvel, netCetvelRows.length]);

  /** Brüt cetvel yoksa net sekmesinde API ile üret. */
  useEffect(() => {
    if (activeTab !== "net") return;
    if (!startDate || !endDate) return;
    if (showNetCetvel && netCetvelRows.length > 0) return;
    if (cetvelRows.length > 0) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;

    void generateNetCetvel();
  }, [activeTab, startDate, endDate, showNetCetvel, netCetvelRows.length, cetvelRows.length, generateNetCetvel]);

  useEffect(() => {
    loadRanRef.current = false;
  }, [effectiveId]);

  const handleUcretBlur = useCallback((rowId: string, newValue: string) => {
    const cleanValue = newValue.replace(/₺/g, "").replace(/\s/g, "").trim();
    const numValue = parseFloat(cleanValue.replace(/\./g, "").replace(",", ".")) || 0;
    setCetvelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ucret: numValue, ucretManual: true } : row)));
  }, []);

  const handleKatsayiBlur = useCallback((rowId: string, newValue: string) => {
    const numValue = parseFloat(newValue.replace(",", ".")) || 1;
    setCetvelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, katsayi: numValue } : row)));
  }, []);

  const handleOdenenUcretBlur = useCallback((rowId: string, newValue: string) => {
    const cleanValue = newValue.replace(/₺/g, "").replace(/\s/g, "").trim();
    const numValue = parseFloat(cleanValue.replace(/\./g, "").replace(",", ".")) || 0;
    setCetvelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, odenenUcret: numValue } : row)));
  }, []);

  const handleNetUcretBlur = useCallback((rowId: string, newValue: string) => {
    const cleanValue = newValue.replace(/₺/g, "").replace(/\s/g, "").trim();
    const numValue = parseFloat(cleanValue.replace(/\./g, "").replace(",", ".")) || 0;
    setNetCetvelRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, ucret: numValue, ucretManual: true, netVerisiYok: false } : row
      )
    );
  }, []);

  const handleNetKatsayiBlur = useCallback((rowId: string, newValue: string) => {
    const numValue = parseFloat(newValue.replace(",", ".")) || 1;
    setNetCetvelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, katsayi: numValue } : row)));
  }, []);

  const handleNetOdenenUcretBlur = useCallback((rowId: string, newValue: string) => {
    const cleanValue = newValue.replace(/₺/g, "").replace(/\s/g, "").trim();
    const numValue = parseFloat(cleanValue.replace(/\./g, "").replace(",", ".")) || 0;
    setNetCetvelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, odenenUcret: numValue } : row)));
  }, []);

  useEffect(() => {
    if (!effectiveId) return;
    let isMounted = true;

    const fetchData = async () => {
      try {
        if (loadRanRef.current) return;
        loadRanRef.current = true;

        const raw = (await loadSavedCase(effectiveId)) as Record<string, unknown>;
        if (!isMounted) return;

        let payload: Record<string, unknown> = {};
        if (raw.data) {
          if (typeof raw.data === "string") {
            try {
              payload = JSON.parse(raw.data) as Record<string, unknown>;
            } catch {
              payload = {};
            }
          } else {
            payload = raw.data as Record<string, unknown>;
          }
        }

        const rawData = payload.data;
        const nested =
          rawData && typeof rawData === "object" && !Array.isArray(rawData)
            ? (rawData as Record<string, unknown>)
            : null;
        const formObj =
          (payload.form as Record<string, unknown>) ||
          (nested?.form as Record<string, unknown>) ||
          payload;
        const formInner = (formObj as { form?: Record<string, unknown> })?.form ?? formObj;

        if (formInner?.startDate) setStartDate(String(formInner.startDate));
        if (formInner?.endDate) setEndDate(String(formInner.endDate));

        if (formInner?.globalKatsayi != null) {
          setGlobalKatsayi(Number(formInner.globalKatsayi));
          setHasCustomKatsayi(Number(formInner.globalKatsayi) !== 1);
        }

        if (formInner?.netGlobalKatsayi != null) {
          setNetGlobalKatsayi(Number(formInner.netGlobalKatsayi));
          setNetHasCustomKatsayi(Number(formInner.netGlobalKatsayi) !== 1);
        }

        if (formInner?.activeTab === "net" || formInner?.activeTab === "brut") {
          setActiveTab(formInner.activeTab as HesaplamaTab);
        }

        const brutRowsSource =
          (formInner as { cetvelRows?: unknown }).cetvelRows ??
          (formInner as { rows?: unknown }).rows ??
          (nested as { results?: { rows?: unknown } })?.results?.rows ??
          (formObj as { cetvelRows?: unknown }).cetvelRows ??
          (formObj as { rows?: unknown }).rows;

        const netRowsSource = (formInner as { netCetvelRows?: unknown }).netCetvelRows;

        if (brutRowsSource && Array.isArray(brutRowsSource)) {
          const mappedRows = mapSavedCetvelRows(brutRowsSource);
          setCetvelRows(mappedRows);
          setManualWageFromTemplateActive(false);
          setShowCetvel(true);
        }

        if (netRowsSource && Array.isArray(netRowsSource)) {
          const mappedNetRows = mapSavedCetvelRows(netRowsSource);
          setNetCetvelRows(mappedNetRows);
          setShowNetCetvel(true);
        } else if (brutRowsSource && Array.isArray(brutRowsSource)) {
          const mappedRows = mapSavedCetvelRows(brutRowsSource);
          const netMerged = applyNetCetvelFromCetvelRows([], mappedRows, netGlobalKatsayiRef.current);
          if (netMerged.length > 0) {
            setNetCetvelRows(netMerged);
            setShowNetCetvel(true);
          }
        }

        setCurrentRecordName(
          (raw.name as string) || (raw.notes as string) || (raw.aciklama as string) || null
        );
        success(`Kayıt yüklendi (#${effectiveId})`);
      } catch {
        if (!isMounted) return;
        loadRanRef.current = false;
        showToastError("Kayıt yüklenemedi");
      }
    };

    void fetchData();
    return () => {
      isMounted = false;
    };
  }, [effectiveId]); // eslint-disable-line react-hooks/exhaustive-deps -- success/showToastError

  const ucretReportConfig = useMemo((): ReportConfig => {
    const isNetTab = activeTab === "net";
    const rows = isNetTab ? netCetvelRows : cetvelRows;
    const totalAmount = isNetTab ? totalNet : totalBrut;
    return buildUcretReportConfig({
      tab: activeTab,
      rows,
      startDate,
      endDate,
      workPeriodLabel: workPeriod?.label || "-",
      totalAmount,
      hasCustomKatsayi: isNetTab ? netHasCustomKatsayi : hasCustomKatsayi,
      globalKatsayi: isNetTab ? netGlobalKatsayi : globalKatsayi,
      conversionPanel: conversionPanelFromRows(activeTab, rows),
    });
  }, [
    activeTab,
    startDate,
    endDate,
    workPeriod,
    cetvelRows,
    netCetvelRows,
    totalBrut,
    totalNet,
    hasCustomKatsayi,
    globalKatsayi,
    netHasCustomKatsayi,
    netGlobalKatsayi,
  ]);

  const buildPreviewReportConfig = useCallback((): ReportConfig => {
    const syncedRows = syncCetvelRowsFromDom(activeTab, cetvelRows, netCetvelRows);
    const totalAmount = calcCetvelGrandTotal(syncedRows);
    const isNetTab = activeTab === "net";
    return buildUcretReportConfig({
      tab: activeTab,
      rows: syncedRows,
      startDate,
      endDate,
      workPeriodLabel: workPeriod?.label || "-",
      totalAmount,
      hasCustomKatsayi: isNetTab ? netHasCustomKatsayi : hasCustomKatsayi,
      globalKatsayi: isNetTab ? netGlobalKatsayi : globalKatsayi,
      conversionPanel: conversionPanelFromRows(activeTab, syncedRows),
    });
  }, [
    activeTab,
    cetvelRows,
    netCetvelRows,
    startDate,
    endDate,
    workPeriod,
    hasCustomKatsayi,
    globalKatsayi,
    netHasCustomKatsayi,
    netGlobalKatsayi,
  ]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content");
    if (!el) return;
    const title = ucretReportConfig.title;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0;font-size:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}h2{font-size:12px;margin:8px 0 6px 0}</style></head><body>${el.innerHTML}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          /* ignore */
        }
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {
            /* ignore */
          }
        }, 400);
      };
    }
  }, [ucretReportConfig.title]);

  const handleSave = () => {
    try {
      if (document.activeElement instanceof HTMLInputElement) {
        (document.activeElement as HTMLInputElement).blur();
      }

      const brutRows =
        activeTab === "brut"
          ? syncCetvelRowsFromDom("brut", cetvelRows, netCetvelRows)
          : cetvelRows.map((r) => ({ ...r }));
      const netRows =
        activeTab === "net"
          ? syncCetvelRowsFromDom("net", cetvelRows, netCetvelRows)
          : netCetvelRows.map((r) => ({ ...r }));

      setCetvelRows(brutRows);
      setNetCetvelRows(netRows);

      const isNetTab = activeTab === "net";
      const rowsToSave = isNetTab ? netRows : brutRows;
      const finalTotal = calcCetvelGrandTotal(rowsToSave);

      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: {
              startDate,
              endDate,
              activeTab,
              cetvelRows: brutRows,
              netCetvelRows: netRows,
              globalKatsayi,
              netGlobalKatsayi,
            },
            results: { total: finalTotal, rows: rowsToSave },
          },
          start_date: startDate,
          end_date: endDate,
          brut_total: Number((isNetTab ? calcCetvelGrandTotal(brutRows) : finalTotal).toFixed(2)),
          net_total: Number((isNetTab ? finalTotal : calcCetvelGrandTotal(netRows)).toFixed(2)),
        },
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName,
        redirectPath: `${REDIRECT_PATH}/:id`,
      });
    } catch {
      showToastError("Kayıt yapılamadı.");
    }
  };

  const handleNewCalculation = () => {
    try {
      const hasUnsavedChanges = Boolean(
        startDate || endDate || cetvelRows.length > 0 || netCetvelRows.length > 0
      );
      if (hasUnsavedChanges && !window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      setStartDate("");
      setEndDate("");
      setCetvelRows([]);
      setNetCetvelRows([]);
      setManualWageFromTemplateActive(false);
      setShowCetvel(false);
      setShowNetCetvel(false);
      setGlobalKatsayi(1);
      setHasCustomKatsayi(false);
      setNetGlobalKatsayi(1);
      setNetHasCustomKatsayi(false);
      setActiveTab("brut");
      setNetForGross("");
      setNetTabGrossForNet("");
      setGrossFromNet(EMPTY_CONVERSION_PANEL);
      setCurrentRecordName(null);
      loadRanRef.current = false;
      if (effectiveId) navigate(REDIRECT_PATH);
    } catch {
      /* ignore */
    }
  };

  const dateInputCls =
    "w-full mt-1 rounded-lg h-9 text-sm border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-2.5";

  return (
    <>
      <div style={{ height: "2px", background: pageStyle?.color || "#1E88E5" }} />
      <div className="min-h-[calc(100vh-4rem)] w-full bg-gray-50 dark:bg-gray-900 pb-28">
        <div className="w-full py-3 sm:py-4">
          <header className="mb-3">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">{PAGE_HEADING}</h1>
            {currentRecordName ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Kayıt: {currentRecordName}</p>
            ) : null}
          </header>
          {videoLink ? (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => window.open(videoLink, "_blank")}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800"
              >
                <Video className="w-3 h-3" /> Video
              </button>
            </div>
          ) : null}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4">
              <section>
                <h2 className={sectionTitleCls}>Tarih bilgileri</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Çalışma dönemi için asgari ücret tabanlı ücret cetveli; brüt/net dönüştürücüler ve rapor.
                </p>
              </section>

              <div id="ucret-print" className="space-y-4">
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{FORM_LABELS.START_DATE}</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={startDate}
                        onChange={(e) => {
                          loadRanRef.current = false;
                          setStartDate(e.target.value);
                        }}
                        className={dateInputCls}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{FORM_LABELS.END_DATE}</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={endDate}
                        onChange={(e) => {
                          loadRanRef.current = false;
                          setEndDate(e.target.value);
                        }}
                        className={dateInputCls}
                      />
                    </div>
                  </div>
                  {workPeriod?.label ? (
                    <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                        Toplam çalışma süresi: <span className="font-semibold">{workPeriod.label}</span>
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-600 pb-2">
                  <button type="button" className={tabBtnCls(activeTab === "brut")} onClick={() => { setFocusedOdenenRowId(null); setActiveTab("brut"); }}>
                    Brütten Hesaplama
                  </button>
                  <button type="button" className={tabBtnCls(activeTab === "net")} onClick={() => { setFocusedOdenenRowId(null); setActiveTab("net"); }}>
                    Netten Hesaplama
                  </button>
                </div>

                {activeTab === "brut" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setKatsayiModalTarget("brut");
                          setShowKatsayiModal(true);
                        }}
                      >
                        Kat Sayı Hesapla
                      </Button>
                      {hasCustomKatsayi ? (
                        <Button type="button" variant="outline" size="sm" onClick={removeGlobalCoefficient}>
                          Kat Sayı Kaldır ({globalKatsayi.toFixed(4)})
                        </Button>
                      ) : null}
                    </div>

                {showCetvel && cetvelRows.length > 0 ? (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Ücret Hesaplama Cetveli</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dönem bazlı ücret hesaplaması</p>
                    </div>
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900">
                      <ManualBrutWageApplyControls
                        rows={cetvelRows as FazlaMesaiRowBase[]}
                        onApplyBrutsByRowId={handleApplyManualBruts}
                        manualBrutActive={manualWageFromTemplateActive}
                        onDeactivateManualBrut={handleDeactivateManualTemplate}
                        success={success}
                        error={showToastError}
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-600">
                            <th className="text-left px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Tarih Aralığı</th>
                            <th className="text-center px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Gün</th>
                            <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Katsayı</th>
                            <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Ücret (₺)</th>
                            <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Ödenen</th>
                            <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Toplam (₺)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cetvelRows.map((row, idx) => {
                            const isFullMonth = row.gunSayisi === row.ayGunSayisi;
                            const rowBrut = isFullMonth
                              ? row.ucret * row.katsayi
                              : (row.ucret / 30) * row.gunSayisi * row.katsayi;
                            const rowNet = Math.max(0, rowBrut - (row.odenenUcret || 0));
                            const hasOdenenFocus = focusedOdenenRowId === row.id;
                            return (
                              <tr
                                key={row.id}
                                className={`border-b border-gray-100 dark:border-gray-700 ${cetvelRowBgCls(idx, hasOdenenFocus)}`}
                              >
                                <td className="px-2 py-2 text-gray-800 dark:text-gray-200 font-medium">{row.rangeLabel}</td>
                                <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{row.gunSayisi}</td>
                                <td className="px-2 py-2 text-right">
                                  <input
                                    type="text"
                                    key={`katsayi-${row.id}-${row.katsayi}`}
                                    data-katsayi-row={row.id}
                                    defaultValue={row.katsayi.toFixed(4).replace(".", ",")}
                                    onBlur={(e) => handleKatsayiBlur(row.id, e.target.value)}
                                    className="w-20 text-right border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800"
                                  />
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <input
                                    type="text"
                                    key={`ucret-${row.id}-${row.ucret}`}
                                    data-ucret-row={row.id}
                                    defaultValue={`${fmtCurrency(row.ucret)}₺`}
                                    onBlur={(e) => handleUcretBlur(row.id, e.target.value)}
                                    className={`w-24 text-right border rounded px-1 py-0.5 text-xs ${
                                      row.ucretManual
                                        ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                    }`}
                                  />
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <input
                                    type="text"
                                    key={`odenen-${row.id}`}
                                    data-odenen-row={row.id}
                                    defaultValue={row.odenenUcret ? fmtCurrency(row.odenenUcret) : ""}
                                    placeholder="0"
                                    onFocus={() => setFocusedOdenenRowId(row.id)}
                                    onBlur={(e) => {
                                      handleOdenenUcretBlur(row.id, e.target.value);
                                      setFocusedOdenenRowId(null);
                                    }}
                                    className="w-20 text-right border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800"
                                  />
                                </td>
                                <td className="px-2 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">
                                  {fmtCurrency(rowNet)}₺
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <td colSpan={5} className="px-2 py-2 text-right font-bold text-base">
                              Toplam Brüt Ücret:
                            </td>
                            <td className="px-2 py-2 text-right font-bold">{fmtCurrency(totalBrut)}₺</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900 space-y-1">
                      <p className="text-[11px] text-amber-800 dark:text-amber-200">
                        <strong>Not:</strong> Ücret sütunundaki değerler varsayılan olarak ilgili dönemin resmi asgari brüt ücretini gösterir. İsterseniz bu değerleri manuel olarak değiştirebilirsiniz.
                      </p>
                      <p className="text-[11px] text-amber-800 dark:text-amber-200">
                        Brütten Nete çevirme kısmında hesaplamalar yukarıda yer alan aylık brüt ücretler tek tek hesaplanarak toplam veri tabloda yer almaktadır.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Ücret hesaplaması için tarihleri girin. Tablo otomatik oluşturulacaktır.
                  </div>
                )}

              <UcretConversionCards
                layout="brut"
                labels={FORM_LABELS}
                fmtCurrency={fmtCurrency}
                cetvelSourceText={
                  cetvelRows.length > 0 ? `Cetvelden: ${fmtCurrency(totalBrut)}₺` : "Cetvel oluşturun"
                }
                netFromGross={netFromGross}
                grossFromNet={brutTabGrossFromNetManual}
                manualInput={netForGross}
                onManualInputChange={setNetForGross}
                onUseLeftPanelValue={() => setNetForGross(fmtCurrency(netFromGross.net))}
                leftPanelResultValue={netFromGross.net}
                useLeftPanelLabel="Sol panelin netini kullan"
              />
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setKatsayiModalTarget("net");
                          setShowKatsayiModal(true);
                        }}
                      >
                        Kat Sayı Hesapla
                      </Button>
                      {netHasCustomKatsayi ? (
                        <Button type="button" variant="outline" size="sm" onClick={removeGlobalCoefficient}>
                          Kat Sayı Kaldır ({netGlobalKatsayi.toFixed(4)})
                        </Button>
                      ) : null}
                    </div>

                    {showNetCetvel && netCetvelRows.length > 0 ? (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Net Ücret Hesaplama Cetveli</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dönem bazlı net ücret hesaplaması</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-600">
                                <th className="text-left px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Tarih Aralığı</th>
                                <th className="text-center px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Gün</th>
                                <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Katsayı</th>
                                <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Net Ücret (₺)</th>
                                <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Ödenen</th>
                                <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Toplam (₺)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {netCetvelRows.map((row, idx) => {
                                const rowTotal = calcRowUcretTotal(row);
                                const hasOdenenFocus = focusedOdenenRowId === row.id;
                                return (
                                  <tr
                                    key={row.id}
                                    className={`border-b border-gray-100 dark:border-gray-700 ${cetvelRowBgCls(idx, hasOdenenFocus)}`}
                                  >
                                    <td className="px-2 py-2 text-gray-800 dark:text-gray-200 font-medium">{row.rangeLabel}</td>
                                    <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{row.gunSayisi}</td>
                                    <td className="px-2 py-2 text-right">
                                      <input
                                        type="text"
                                        key={`net-katsayi-${row.id}-${row.katsayi}`}
                                        data-net-katsayi-row={row.id}
                                        defaultValue={row.katsayi.toFixed(4).replace(".", ",")}
                                        onBlur={(e) => handleNetKatsayiBlur(row.id, e.target.value)}
                                        className="w-20 text-right border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800"
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      <input
                                        type="text"
                                        key={`net-ucret-${row.id}-${row.ucret}-${row.netVerisiYok}`}
                                        data-net-ucret-row={row.id}
                                        defaultValue={
                                          row.netVerisiYok && !row.ucretManual
                                            ? ""
                                            : row.ucret
                                              ? `${fmtCurrency(row.ucret)}₺`
                                              : ""
                                        }
                                        placeholder={
                                          row.netVerisiYok && !row.ucretManual ? "Net verisi yok" : "0,00"
                                        }
                                        onBlur={(e) => handleNetUcretBlur(row.id, e.target.value)}
                                        className={`w-24 text-right border rounded px-1 py-0.5 text-xs ${
                                          row.netVerisiYok && !row.ucretManual
                                            ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 placeholder:text-amber-600 dark:placeholder:text-amber-400"
                                            : row.ucretManual
                                              ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                        }`}
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      <input
                                        type="text"
                                        key={`net-odenen-${row.id}`}
                                        data-net-odenen-row={row.id}
                                        defaultValue={row.odenenUcret ? fmtCurrency(row.odenenUcret) : ""}
                                        placeholder="0"
                                        onFocus={() => setFocusedOdenenRowId(row.id)}
                                        onBlur={(e) => {
                                          handleNetOdenenUcretBlur(row.id, e.target.value);
                                          setFocusedOdenenRowId(null);
                                        }}
                                        className="w-20 text-right border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800"
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">
                                      {fmtCurrency(rowTotal)}₺
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                                <td colSpan={5} className="px-2 py-2 text-right font-bold text-base">
                                  {NET_CETVEL_FOOTER}
                                </td>
                                <td className="px-2 py-2 text-right font-bold">{fmtCurrency(totalNet)}₺</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900 space-y-1">
                          <p className="text-[11px] text-amber-800 dark:text-amber-200">
                            <strong>Not:</strong> Net ücret sütunu dönemsel resmi net asgari ücret tablosundan okunur (2015 ve sonrası). Veri bulunmayan dönemlerde hücre boş kalır; değerleri manuel girebilirsiniz.
                          </p>
                          <p className="text-[11px] text-amber-800 dark:text-amber-200">
                            Netten Brüte çevirme kısmında hesaplamalar yukarıda yer alan aylık net ücretler tek tek hesaplanarak toplam veri tabloda yer almaktadır.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Net ücret hesaplaması için tarihleri girin. Tablo otomatik oluşturulacaktır.
                      </div>
                    )}

                    <UcretConversionCards
                      layout="net"
                      labels={FORM_LABELS}
                      fmtCurrency={fmtCurrency}
                      cetvelSourceText={
                        netCetvelRows.length > 0 ? `Cetvelden: ${fmtCurrency(totalNet)}₺` : "Cetvel oluşturun"
                      }
                      netFromGross={netTabNetFromGrossManual}
                      grossFromNet={netTabGrossFromCetvel}
                      manualInput={netTabGrossForNet}
                      onManualInputChange={setNetTabGrossForNet}
                      onUseLeftPanelValue={() => setNetTabGrossForNet(fmtCurrency(netTabGrossFromCetvel.gross))}
                      leftPanelResultValue={netTabGrossFromCetvel.gross}
                      useLeftPanelLabel="Sol panelin brütünü kullan"
                    />

                  </>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3">
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">Notlar</h3>
                <p className="text-[11px] font-light text-slate-500 dark:text-slate-400 leading-relaxed">{NOTE_TEXT}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UbgtKatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      <div style={{ display: "none" }} aria-hidden="true">
        <ReportContentFromConfig config={ucretReportConfig} />
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={
          isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : effectiveId ? "Güncelle" : "Kaydet"
        }
        onPrint={handlePrint}
        previewButton={{
          title: PREVIEW_TITLE,
          copyTargetId: "ucret-alacagi-word-copy",
          hideWordDownload: true,
          renderContent: () => {
            if (document.activeElement instanceof HTMLInputElement) {
              document.activeElement.blur();
            }
            const previewConfig = buildPreviewReportConfig();
            const previewSections = buildWordTableSectionsFromConfig(previewConfig);
            return (
              <div style={{ background: "white", padding: 24 }}>
                <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #ucret-alacagi-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #ucret-alacagi-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
                <div id="ucret-alacagi-word-copy">
                  {previewSections.map((sec) => (
                    <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                      <div className="section-header">
                        <span className="section-title">{sec.title}</span>
                        <button
                          type="button"
                          className="copy-icon-btn"
                          onClick={async () => {
                            const ok = await copySectionForWord(sec.id);
                            if (ok) success("Kopyalandı");
                          }}
                          title="Word'e kopyala"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                    </div>
                  ))}
                </div>
              </div>
            );
          },
          onPdf: () => downloadPdfFromDOM(PREVIEW_TITLE, "ucret-alacagi-word-copy"),
        }}
      />
    </>
  );
}
