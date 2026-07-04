/**
 * Gemi Adamı 7/24 Çalışan — UBGT / yıllık izin düşüm satırı köprüsü.
 * Düşüm günleri 7 günlük pencerelere yerleştirilir; her pencere 1 hafta düşüme karşılık gelir.
 * FM: 7×24 formülü (91 net, gün başı 13 saat, 48+8 düşüm).
 */

import { addDays } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import {
  normalizeDeductionDays,
  parseFmDate,
  type NormalizedDeductionOnDate,
} from "@/shared/utils/fazlaMesai/deductionPeriodEngine";
import { DAMGA_VERGISI_ORANI, GELIR_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import type { GemiExpandSourceRow } from "../gemi-adami-gunluk/gemiAnnualLeaveUbgtExpand";
import { expandGemiRowsAnnualLeaveUbgt, type GemiExpandParams } from "../gemi-adami-gunluk/gemiAnnualLeaveUbgtExpand";

const LEGACY_ONLY_EXCLUSION_TYPES = new Set(["Rapor", "Diğer", "Puantaj/Bordro"]);

const FAZLA_MESAI_DENOMINATOR = 240;
const FAZLA_MESAI_KATSAYI = 1.25;
/** 7×24: 168 − 77 dinlenme */
const GEMI_724_WEEKLY_NET = 91;
/** 91 / 7 — UBGT/yıllık izin gün düşümü */
const GEMI_724_DAILY_NET = GEMI_724_WEEKLY_NET / 7;
const GEMI_724_LEGAL_WEEKLY_LIMIT = 48;
const GEMI_724_WEEKLY_LEAVE_HOURS = 8;
const EPS = 1e-7;

export interface ExpandGemi724RowsForDeductionsOptions {
  weeklyOffDay: number | null;
  applyYargitay270FmDeduction?: boolean;
}

function gemi724FmHoursForDeduction(excludedUnits: number): number {
  const excl = Math.max(0, Math.min(7, Number(excludedUnits) || 0));
  const weeklyNet = (7 - excl) * GEMI_724_DAILY_NET;
  return Math.max(0, weeklyNet - GEMI_724_LEGAL_WEEKLY_LIMIT - GEMI_724_WEEKLY_LEAVE_HOURS);
}

function gemi724FmNet(weeks: number, brut: number, kats: number, fmHours: number): { fm: number; net: number } {
  const step1 = Number((weeks * brut * kats * fmHours).toFixed(6));
  const step2 = Number((step1 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
  const step3 = Number((step2 * FAZLA_MESAI_KATSAYI).toFixed(6));
  const fm = Number(step3.toFixed(2));
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
  return { fm, net };
}

export function exclusionsNeedLegacySplit(exclusions: ExcludedDay[]): boolean {
  if (!exclusions?.length) return false;
  return exclusions.some((ex) => LEGACY_ONLY_EXCLUSION_TYPES.has(String(ex.type || "").trim()));
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayUnits(n: number): string {
  if (Math.abs(n - 0.5) < 1e-6) return "0,5";
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return String(n).replace(".", ",");
}

function formatWindowCaption(deductions: NormalizedDeductionOnDate[]): string {
  if (deductions.length === 0) return "";
  const ubgtUnits = deductions.filter((d) => d.kind === "UBGT").reduce((s, d) => s + d.dayWeight, 0);
  const izinUnits = deductions.filter((d) => d.kind === "YILLIK_IZIN").reduce((s, d) => s + d.dayWeight, 0);
  const parts: string[] = [];
  if (ubgtUnits > 0) parts.push(`${formatDayUnits(ubgtUnits)} gün UBGT`);
  if (izinUnits > 0) parts.push(`${formatDayUnits(izinUnits)} gün yıllık izin`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `(${parts[0]} düşülmüştür)`;
  return `(${parts.join(" + ")} düşülmüştür)`;
}

interface DeductionWindow {
  startISO: string;
  endISO: string;
  deductions: NormalizedDeductionOnDate[];
  totalDeductionDayUnits: number;
  caption: string;
}

/** Düşüm günlerini 7 günlük pencerelere böler; bitişik pencereler birleştirilmez. */
function buildSevenDayWindows(
  normalizedDays: NormalizedDeductionOnDate[],
  periodEnd: Date,
): DeductionWindow[] {
  if (normalizedDays.length === 0) return [];
  const sorted = [...normalizedDays].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const windows: DeductionWindow[] = [];
  let i = 0;
  while (i < sorted.length) {
    const firstDay = parseFmDate(sorted[i].dateISO);
    if (!firstDay) { i++; continue; }
    const windowEnd = addDays(firstDay, 6);
    const group: NormalizedDeductionOnDate[] = [];
    while (i < sorted.length) {
      const d = parseFmDate(sorted[i].dateISO);
      if (!d || d > windowEnd) break;
      group.push(sorted[i]);
      i++;
    }
    const clippedEnd = windowEnd > periodEnd ? periodEnd : windowEnd;
    windows.push({
      startISO: toISODate(firstDay),
      endISO: toISODate(clippedEnd),
      deductions: group,
      totalDeductionDayUnits: group.reduce((s, d) => s + d.dayWeight, 0),
      caption: formatWindowCaption(group),
    });
  }
  return windows;
}

function enrichRowsWithoutDeductions(rows: GemiExpandSourceRow[]): GemiExpandSourceRow[] {
  return rows.map((row) => ({ ...row }));
}

function buildCombinedNormalRow(
  sourceRow: GemiExpandSourceRow,
  rowIdx: number,
  periodStartISO: string,
  periodEndISO: string,
  baseWeeks: number,
): GemiExpandSourceRow {
  const kats = sourceRow.katsayi ?? 1;
  const fmHours = sourceRow.fmHours ?? 0;
  const brut = sourceRow.brut ?? (getAsgariUcretByDate(periodStartISO) || 0);
  const { fm, net } = gemi724FmNet(baseWeeks, brut, kats, fmHours);

  return {
    ...sourceRow,
    id: `gemi724-base-${rowIdx}-${periodStartISO}-${periodEndISO}`,
    startISO: periodStartISO,
    endISO: periodEndISO,
    rangeLabel: `${periodStartISO} – ${periodEndISO}`,
    weeks: baseWeeks,
    brut,
    fmHours,
    fm,
    net,
    yillikIzinAciklama: undefined,
    calc225: 240,
    factor: 1.25,
  };
}

function mapWindowToRow(
  win: DeductionWindow,
  sourceRow: GemiExpandSourceRow,
  rowIdx: number,
  winIdx: number,
): GemiExpandSourceRow {
  const excludedDays = win.totalDeductionDayUnits;
  const brut = getAsgariUcretByDate(win.startISO) ?? sourceRow.brut;
  const kats = sourceRow.katsayi ?? 1;
  const fmHours = excludedDays > EPS ? gemi724FmHoursForDeduction(excludedDays) : sourceRow.fmHours ?? 0;
  const { fm, net } = gemi724FmNet(1, brut, kats, fmHours);

  return {
    ...sourceRow,
    id: `gemi724-ded-${rowIdx}-${winIdx}-${win.startISO}-${win.endISO}`,
    startISO: win.startISO,
    endISO: win.endISO,
    rangeLabel: `${win.startISO} – ${win.endISO}`,
    weeks: 1,
    brut,
    katsayi: kats,
    fmHours,
    fm,
    net,
    calc225: 240,
    factor: 1.25,
    yillikIzinAciklama: win.caption || undefined,
  };
}

function expandWithMotor(
  rows: GemiExpandSourceRow[],
  exclusions: ExcludedDay[],
): GemiExpandSourceRow[] {
  const out: GemiExpandSourceRow[] = [];
  const allNormalized = normalizeDeductionDays(exclusions);

  rows.forEach((row, rowIdx) => {
    if (row.isManual) {
      out.push(row);
      return;
    }
    const startISO = row.startISO;
    const endISO = row.endISO;
    const w0 = row.weeks ?? 0;
    if (!startISO || !endISO || w0 <= 0) {
      out.push(row);
      return;
    }

    const periodStart = parseFmDate(startISO);
    const periodEnd = parseFmDate(endISO);
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      out.push(...enrichRowsWithoutDeductions([row]));
      return;
    }

    const daysInPeriod = allNormalized.filter((d) => {
      const dd = parseFmDate(d.dateISO);
      return dd && dd >= periodStart && dd <= periodEnd;
    });

    if (daysInPeriod.length === 0) {
      out.push(...enrichRowsWithoutDeductions([row]));
      return;
    }

    const windows = buildSevenDayWindows(daysInPeriod, periodEnd);
    if (windows.length === 0) {
      out.push(...enrichRowsWithoutDeductions([row]));
      return;
    }

    const originalWeeks = Math.max(0, Math.floor(Number(row.weeks) || 0));
    const deductionWeekCount = windows.length;
    const baseWeeks = Math.max(0, originalWeeks - deductionWeekCount);

    if (baseWeeks > 0) {
      out.push(buildCombinedNormalRow(row, rowIdx, startISO, endISO, baseWeeks));
    }

    windows.forEach((win, winIdx) => {
      const dedRow = mapWindowToRow(win, row, rowIdx, winIdx);
      if (dedRow.fmHours <= EPS) {
        return;
      }
      out.push(dedRow);
    });
  });

  return out.length > 0 ? out : rows;
}

/**
 * UBGT/yıllık izin: 7 günlük pencere bazlı düşüm (bitişik pencereler birleştirilmez).
 * Rapor/Diğer/Puantaj/Bordro: eski expandGemiRowsAnnualLeaveUbgt (hg=7).
 */
export function expandGemi724RowsForDeductions(
  rows: GemiExpandSourceRow[],
  exclusions: ExcludedDay[] | null | undefined,
  options: ExpandGemi724RowsForDeductionsOptions,
): GemiExpandSourceRow[] {
  const { weeklyOffDay, applyYargitay270FmDeduction } = options;
  if (!rows.length) return rows;
  if (!exclusions?.length) {
    return enrichRowsWithoutDeductions(rows);
  }

  if (exclusionsNeedLegacySplit(exclusions)) {
    const legacyParams: GemiExpandParams = {
      hg: 7,
      weeklyOffDay,
      davaciSevenDay: "tatilsiz",
      applyYargitay270FmDeduction,
    };
    return expandGemiRowsAnnualLeaveUbgt(rows, exclusions, legacyParams);
  }

  return expandWithMotor(rows, exclusions);
}
