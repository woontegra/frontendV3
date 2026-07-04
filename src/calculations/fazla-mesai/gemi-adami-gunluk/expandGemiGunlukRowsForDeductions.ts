/**
 * Gemi Adamı Günlük Çalışan — UBGT / yıllık izin düşüm satırı köprüsü.
 * Düşüm günleri 7 günlük pencerelere yerleştirilir; her pencere 1 hafta düşüme karşılık gelir.
 * FM: 48 saat sınırı; tutar: 240 / 1,25.
 */

import { addDays } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import {
  normalizeDeductionDays,
  parseFmDate,
  type NormalizedDeductionOnDate,
} from "@/shared/utils/fazlaMesai/deductionPeriodEngine";
import { bilirkisiRoundWeeklyTotalHours } from "../standart/annualLeaveSixDayRowSplit";
import { DAMGA_VERGISI_ORANI, GELIR_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import type { GemiExpandSourceRow } from "./gemiAnnualLeaveUbgtExpand";
import { expandGemiRowsAnnualLeaveUbgt, type GemiExpandParams } from "./gemiAnnualLeaveUbgtExpand";

const LEGACY_ONLY_EXCLUSION_TYPES = new Set(["Rapor", "Diğer", "Puantaj/Bordro"]);

const FAZLA_MESAI_DENOMINATOR = 240;
const FAZLA_MESAI_KATSAYI = 1.25;
const WEEKLY_WORK_LIMIT = 48;
const GEMI_STANDARD_DAILY_REF_HOURS = 8;
const EPS = 1e-7;

export type GemiGunlukExpandFmParams = {
  dailyNet: number;
  hg: number;
  weeklyOffDay: number | null;
  davaciSevenDay: "tatilli" | "tatilsiz";
  applyYargitay270FmDeduction?: boolean;
};

export interface ExpandGemiGunlukRowsForDeductionsOptions {
  weeklyOffDay: number | null;
  fmParams?: GemiGunlukExpandFmParams;
}

function remainingNetWeeklyForGemiDeduction(
  dailyNet: number,
  weeklyWorkingDays: number,
  excludedUnits: number,
  davaciSevenDay: "tatilli" | "tatilsiz",
): number {
  const hgSafe = Math.max(1, Math.min(7, Math.floor(weeklyWorkingDays) || 6));
  const excl = Math.max(0, Math.min(hgSafe, Number(excludedUnits) || 0));
  if (hgSafe !== 7) {
    return Math.max(0, (hgSafe - excl) * dailyNet);
  }
  if (davaciSevenDay === "tatilsiz") {
    return Math.max(0, (7 - excl) * dailyNet);
  }
  const holidayExtra = Math.max(0, dailyNet - GEMI_STANDARD_DAILY_REF_HOURS);
  return Math.max(0, 6 * dailyNet + holidayExtra - excl * dailyNet);
}

function gemiFmHoursForDeductionWeek(
  fmParams: GemiGunlukExpandFmParams,
  excludedUnits: number,
): number {
  const remainingNetWeekly = remainingNetWeeklyForGemiDeduction(
    fmParams.dailyNet,
    fmParams.hg,
    excludedUnits,
    fmParams.davaciSevenDay,
  );
  const totalRounded = bilirkisiRoundWeeklyTotalHours(remainingNetWeekly);
  let fmWeek = Math.max(0, totalRounded - WEEKLY_WORK_LIMIT);
  if (fmParams.applyYargitay270FmDeduction) {
    fmWeek = Math.max(0, fmWeek - (5 + 12 / 60));
  }
  return fmWeek;
}

function gemiFmNet(weeks: number, brut: number, kats: number, fmHours: number): { fm: number; net: number } {
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

function enrichRowsWithoutDeductions(
  rows: GemiExpandSourceRow[],
  weeklyOffDay: number | null,
): GemiExpandSourceRow[] {
  return rows.map((row) => ({ ...row }));
}

function buildCombinedNormalRow(
  sourceRow: GemiExpandSourceRow,
  rowIdx: number,
  periodStartISO: string,
  periodEndISO: string,
  baseWeeks: number,
  originalWeeks: number,
): GemiExpandSourceRow {
  const kats = sourceRow.katsayi ?? 1;
  const fmHours = sourceRow.fmHours ?? 0;
  const brut = sourceRow.brut ?? (getAsgariUcretByDate(periodStartISO) || 0);
  const { fm, net } = gemiFmNet(baseWeeks, brut, kats, fmHours);

  return {
    ...sourceRow,
    id: `gemi-base-${rowIdx}-${periodStartISO}-${periodEndISO}`,
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
  fmParams: GemiGunlukExpandFmParams | undefined,
): GemiExpandSourceRow {
  const excludedDays = win.totalDeductionDayUnits;
  const brut = getAsgariUcretByDate(win.startISO) ?? sourceRow.brut;
  const kats = sourceRow.katsayi ?? 1;

  let fmHours = sourceRow.fmHours ?? 0;
  if (fmParams && excludedDays > EPS) {
    fmHours = gemiFmHoursForDeductionWeek(fmParams, excludedDays);
  }

  const { fm, net } = gemiFmNet(1, brut, kats, fmHours);

  return {
    ...sourceRow,
    id: `gemi-ded-${rowIdx}-${winIdx}-${win.startISO}-${win.endISO}`,
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
  weeklyOffDay: number | null,
  fmParams: GemiGunlukExpandFmParams | undefined,
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
      out.push(...enrichRowsWithoutDeductions([row], weeklyOffDay));
      return;
    }

    const daysInPeriod = allNormalized.filter((d) => {
      const dd = parseFmDate(d.dateISO);
      return dd && dd >= periodStart && dd <= periodEnd;
    });

    if (daysInPeriod.length === 0) {
      out.push(...enrichRowsWithoutDeductions([row], weeklyOffDay));
      return;
    }

    const windows = buildSevenDayWindows(daysInPeriod, periodEnd);
    if (windows.length === 0) {
      out.push(...enrichRowsWithoutDeductions([row], weeklyOffDay));
      return;
    }

    const originalWeeks = Math.max(0, Math.floor(Number(row.weeks) || 0));
    const deductionWeekCount = windows.length;
    const baseWeeks = Math.max(0, originalWeeks - deductionWeekCount);

    if (baseWeeks > 0) {
      out.push(buildCombinedNormalRow(row, rowIdx, startISO, endISO, baseWeeks, originalWeeks));
    }

    windows.forEach((win, winIdx) => {
      const dedRow = mapWindowToRow(win, row, rowIdx, winIdx, fmParams);
      if (fmParams && dedRow.fmHours <= EPS) {
        return;
      }
      out.push(dedRow);
    });
  });

  return out.length > 0 ? out : rows;
}

/**
 * UBGT/yıllık izin: 7 günlük pencere bazlı düşüm (bitişik pencereler birleştirilmez).
 * Rapor/Diğer/Puantaj/Bordro: eski expandGemiRowsAnnualLeaveUbgt.
 */
export function expandGemiGunlukRowsForDeductions(
  rows: GemiExpandSourceRow[],
  exclusions: ExcludedDay[] | null | undefined,
  options: ExpandGemiGunlukRowsForDeductionsOptions,
): GemiExpandSourceRow[] {
  const { weeklyOffDay, fmParams } = options;
  if (!rows.length) return rows;
  if (!exclusions?.length) {
    return enrichRowsWithoutDeductions(rows, weeklyOffDay);
  }

  if (exclusionsNeedLegacySplit(exclusions)) {
    if (!fmParams) {
      return expandWithMotor(rows, exclusions, weeklyOffDay, undefined);
    }
    const legacyParams: GemiExpandParams = {
      hg: fmParams.hg,
      weeklyOffDay: fmParams.weeklyOffDay,
      davaciSevenDay: fmParams.davaciSevenDay,
      applyYargitay270FmDeduction: fmParams.applyYargitay270FmDeduction,
    };
    return expandGemiRowsAnnualLeaveUbgt(rows, exclusions, legacyParams);
  }

  return expandWithMotor(rows, exclusions, weeklyOffDay, fmParams);
}
