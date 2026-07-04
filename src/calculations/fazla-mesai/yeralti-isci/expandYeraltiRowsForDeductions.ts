/**
 * Yeraltı İşçileri — UBGT / yıllık izin düşüm satırı köprüsü.
 * Düşüm günleri 7 günlük pencerelere yerleştirilir; her pencere 1 hafta düşüme karşılık gelir.
 * FM/tutar: yeraltı formülü (187,5 / 2 / 37,5).
 */

import { addDays } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import {
  normalizeDeductionDays,
  parseFmDate,
  type NormalizedDeductionOnDate,
} from "@/shared/utils/fazlaMesai/deductionPeriodEngine";
import { filterExclusionsForWeeklyOff } from "@/shared/utils/fazlaMesai/weeklyOffExclusionFilter";
import { countWeeksBySevenDaySteps } from "@/modules/tanikli-standart/rules/preserveWeeks.rule";
import type { YeraltiExpandSourceRow } from "./yeraltiAnnualLeaveUbgtExpand";
import { expandYeraltiRowsForExclusions } from "./yeraltiAnnualLeaveUbgtExpand";

const LEGACY_ONLY_EXCLUSION_TYPES = new Set(["Rapor", "Diğer", "Puantaj/Bordro"]);

const FAZLA_MESAI_DENOMINATOR = 187.5;
const FAZLA_MESAI_KATSAYI = 2;
const WEEKLY_WORK_LIMIT_Y = 37.5;
const STANDARD_DAILY_REFERENCE_HOURS = 6.25;
const EPS = 1e-7;

export type YeraltiExpandFmParams = {
  dailyNet: number;
  hg: number;
  weeklyOffDay: number | null;
  davaciSevenDay: "tatilli" | "tatilsiz";
  applyLeaveFmAdj: (h: number) => number;
};

export interface ExpandYeraltiRowsForDeductionsOptions {
  weeklyOffDay: number | null;
  /** Verilirse düşüm satırında yeraltı haftalık FM yeniden hesaplanır (eski expand ile uyumlu). */
  fmParams?: YeraltiExpandFmParams;
}

function applyYargitayRoundingYeralti(decimalHours: number): number {
  const hours = Math.floor(decimalHours);
  const fractionalPart = decimalHours - hours;
  const minutes = Math.round(fractionalPart * 60);
  if (minutes === 0) return hours;
  if (minutes <= 30) return hours + 0.5;
  return hours + 1;
}

/**
 * Düşüm sonrası net haftalık çalışma: dailyNet × (haftalık çalışma günü − düşülen gün).
 * `excludedUnits` kesirli olabilir (0,5 gün UBGT).
 */
function remainingNetWeeklyForYeraltiDeduction(
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
  const holidayExtra = Math.max(0, dailyNet - STANDARD_DAILY_REFERENCE_HOURS);
  return Math.max(0, 6 * dailyNet + holidayExtra - excl * dailyNet);
}

/** max(0, yuvarlanmış net haftalık − 37,5) */
function yeraltiFmHoursForDeductionWeek(
  fmParams: YeraltiExpandFmParams,
  excludedUnits: number,
): number {
  const remainingNetWeekly = remainingNetWeeklyForYeraltiDeduction(
    fmParams.dailyNet,
    fmParams.hg,
    excludedUnits,
    fmParams.davaciSevenDay,
  );
  const totalRounded = applyYargitayRoundingYeralti(remainingNetWeekly);
  let fmWeek = Math.max(0, totalRounded - WEEKLY_WORK_LIMIT_Y);
  fmWeek = fmParams.applyLeaveFmAdj(fmWeek);
  return fmWeek;
}

function yeraltiFmNet(weeks: number, brut: number, kats: number, fmHours: number): { fm: number; net: number } {
  const step1 = Number((weeks * brut * kats * fmHours).toFixed(6));
  const step2 = Number((step1 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
  const step3 = Number((step2 * FAZLA_MESAI_KATSAYI).toFixed(6));
  const fm = Number(step3.toFixed(2));
  const net = Number((fm * (1 - 0.00759 - 0.15)).toFixed(2));
  return { fm, net };
}

export function exclusionsNeedLegacySplit(exclusions: ExcludedDay[]): boolean {
  if (!exclusions?.length) return false;
  return exclusions.some((ex) => LEGACY_ONLY_EXCLUSION_TYPES.has(String(ex.type || "").trim()));
}

function parseIsoDateLocal(iso: string): Date | null {
  return parseFmDate(iso);
}

function isWorkDay(d: Date, weeklyOff: number | null): boolean {
  if (weeklyOff == null) return true;
  return d.getDay() !== weeklyOff;
}

function countWorkDaysInInclusiveRange(start: Date, end: Date, weeklyOff: number | null): number {
  let n = 0;
  let cur = new Date(start);
  while (cur <= end) {
    if (isWorkDay(cur, weeklyOff)) n += 1;
    cur = addDays(cur, 1);
  }
  return n;
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
  rows: YeraltiExpandSourceRow[],
  weeklyOffDay: number | null,
): YeraltiExpandSourceRow[] {
  return rows.map((row) => {
    const s = String(row.startISO || "").slice(0, 10);
    const e = String(row.endISO || "").slice(0, 10);
    const a = parseIsoDateLocal(s);
    const b = parseIsoDateLocal(e);
    const seg = a && b && a <= b ? countWorkDaysInInclusiveRange(a, b, weeklyOffDay) : 0;
    const Wpre =
      a && b && a <= b
        ? Math.max(0, Math.floor(Number(row.weeks) || 0)) || countWeeksBySevenDaySteps(a, b)
        : Math.max(0, Math.floor(Number(row.weeks) || 0));
    return {
      ...row,
      segmentWorkDays: seg,
      excludedDays: 0,
      totalDays: seg,
      isExclusionBlock: false,
      prePreserveWeeks: Wpre,
    } as YeraltiExpandSourceRow;
  });
}

function buildCombinedNormalRow(
  sourceRow: YeraltiExpandSourceRow,
  rowIdx: number,
  periodStartISO: string,
  periodEndISO: string,
  baseWeeks: number,
  originalWeeks: number,
  weeklyOffDay: number | null,
): YeraltiExpandSourceRow {
  const rowStart = parseIsoDateLocal(periodStartISO);
  const rowEnd = parseIsoDateLocal(periodEndISO);
  const segmentMain =
    rowStart && rowEnd && rowStart <= rowEnd
      ? countWorkDaysInInclusiveRange(rowStart, rowEnd, weeklyOffDay)
      : 0;
  const kats = sourceRow.katsayi ?? 1;
  const fmHours = sourceRow.fmHours ?? 0;
  const brut = sourceRow.brut ?? (getAsgariUcretByDate(periodStartISO) || 0);
  const { fm, net } = yeraltiFmNet(baseWeeks, brut, kats, fmHours);

  return {
    ...sourceRow,
    id: `yr-base-${rowIdx}-${periodStartISO}-${periodEndISO}`,
    startISO: periodStartISO,
    endISO: periodEndISO,
    rangeLabel: `${periodStartISO} – ${periodEndISO}`,
    weeks: baseWeeks,
    originalWeekCount: originalWeeks,
    segmentWorkDays: segmentMain,
    excludedDays: 0,
    totalDays: segmentMain,
    isExclusionBlock: false,
    prePreserveWeeks: baseWeeks,
    yillikIzinAciklama: undefined,
    brut,
    fmHours,
    fm,
    net,
  };
}

function mapWindowToRow(
  win: DeductionWindow,
  sourceRow: YeraltiExpandSourceRow,
  rowIdx: number,
  winIdx: number,
  weeklyOffDay: number | null,
  fmParams: YeraltiExpandFmParams | undefined,
): YeraltiExpandSourceRow {
  const b0 = parseIsoDateLocal(win.startISO);
  const b1 = parseIsoDateLocal(win.endISO);
  const seg =
    b0 && b1 && b0 <= b1 ? countWorkDaysInInclusiveRange(b0, b1, weeklyOffDay) : 0;
  const excludedDays = win.totalDeductionDayUnits;
  const brut = getAsgariUcretByDate(win.startISO) ?? sourceRow.brut;
  const kats = sourceRow.katsayi ?? 1;

  let fmHours = sourceRow.fmHours ?? 0;
  if (fmParams && excludedDays > EPS) {
    fmHours = yeraltiFmHoursForDeductionWeek(fmParams, excludedDays);
  }

  const { fm, net } = yeraltiFmNet(1, brut, kats, fmHours);

  return {
    ...sourceRow,
    id: `yr-ded-${rowIdx}-${winIdx}-${win.startISO}-${win.endISO}`,
    startISO: win.startISO,
    endISO: win.endISO,
    rangeLabel: `${win.startISO} – ${win.endISO}`,
    weeks: 1,
    originalWeekCount: 1,
    brut,
    katsayi: kats,
    fmHours,
    fm,
    net,
    segmentWorkDays: seg,
    excludedDays,
    totalDays: seg,
    yillikIzinAciklama: win.caption || undefined,
    isExclusionBlock: true,
    prePreserveWeeks: 1,
  } as YeraltiExpandSourceRow;
}

function expandWithMotor(
  rows: YeraltiExpandSourceRow[],
  exclusionsForMotor: ExcludedDay[],
  weeklyOffDay: number | null,
  fmParams: YeraltiExpandFmParams | undefined,
): YeraltiExpandSourceRow[] {
  const out: YeraltiExpandSourceRow[] = [];
  const allNormalized = normalizeDeductionDays(exclusionsForMotor);

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

    const periodStart = parseIsoDateLocal(startISO);
    const periodEnd = parseIsoDateLocal(endISO);
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

    const originalWeeks = Math.max(0, Math.floor(Number(row.originalWeekCount ?? w0) || 0));
    const deductionWeekCount = windows.length;
    const baseWeeks = Math.max(0, originalWeeks - deductionWeekCount);

    if (baseWeeks > 0) {
      out.push(
        buildCombinedNormalRow(row, rowIdx, startISO, endISO, baseWeeks, originalWeeks, weeklyOffDay),
      );
    }

    windows.forEach((win, winIdx) => {
      const dedRow = mapWindowToRow(win, row, rowIdx, winIdx, weeklyOffDay, fmParams);
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
 * Rapor/Diğer/Puantaj/Bordro: eski expandYeraltiRowsForExclusions.
 */
export function expandYeraltiRowsForDeductions(
  rows: YeraltiExpandSourceRow[],
  exclusions: ExcludedDay[] | null | undefined,
  options: ExpandYeraltiRowsForDeductionsOptions,
): YeraltiExpandSourceRow[] {
  const { weeklyOffDay, fmParams } = options;
  if (!rows.length) return rows;
  if (!exclusions?.length) {
    return enrichRowsWithoutDeductions(rows, weeklyOffDay);
  }

  const exclusionsForMotor = filterExclusionsForWeeklyOff(exclusions, weeklyOffDay);

  if (exclusionsNeedLegacySplit(exclusions)) {
    if (!fmParams) {
      return expandWithMotor(rows, exclusionsForMotor, weeklyOffDay, undefined);
    }
    return expandYeraltiRowsForExclusions(rows, exclusionsForMotor, {
      dailyNet: fmParams.dailyNet,
      hg: fmParams.hg,
      weeklyOffDay: fmParams.weeklyOffDay,
      davaciSevenDay: fmParams.davaciSevenDay,
      applyLeaveFmAdj: fmParams.applyLeaveFmAdj,
    });
  }

  return expandWithMotor(rows, exclusionsForMotor, weeklyOffDay, fmParams);
}
