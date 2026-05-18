/**
 * Yeraltı İşçileri — UBGT / yıllık izin düşüm satırı köprüsü.
 * Tarih: deductionPeriodEngine. FM/tutar: sayfa veya isteğe bağlı yeraltı FM yardımcısı.
 */

import { addDays } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import {
  buildDeductionPeriodsForFm,
  parseFmDate,
  type FmPeriodSegment,
} from "@/shared/utils/fazlaMesai/deductionPeriodEngine";
import { filterExclusionsForWeeklyOff } from "@/shared/utils/fazlaMesai/weeklyOffExclusionFilter";
import { splitByExclusions } from "@/modules/tanikli-standart/rules/splitByExclusions.rule";
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

/** "(1 gün UBGT + 1 gün yıllık izin düşülmüştür)" → 2 (tüm "N gün" ifadeleri toplanır). */
function parseExcludedUnitsFromCaption(caption: string | undefined): number | null {
  if (!caption) return null;
  const re = /([\d]+(?:[.,]5)?)\s*gün/gi;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(caption)) !== null) {
    const n = parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total > EPS ? total : null;
}

/**
 * FM için düşüm gün birimi: motor `segment.deductions` dayWeight toplamı esas alınır.
 * (UBGT + yıllık izin aynı 7 günlük pencerede → 1+1=2; aynı tarihte çift UBGT max 1.)
 */
function resolveExcludedUnitsForDeductionSegment(segment: FmPeriodSegment): number {
  const fromDeductions = sumDeductionDayUnits(segment);
  if (fromDeductions > EPS) return fromDeductions;
  return parseExcludedUnitsFromCaption(segment.caption) ?? 0;
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

function sumDeductionDayUnits(segment: FmPeriodSegment): number {
  return segment.deductions.reduce((s, d) => s + d.dayWeight, 0);
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

function mapDeductionSegmentToRow(
  segment: FmPeriodSegment,
  sourceRow: YeraltiExpandSourceRow,
  rowIdx: number,
  segIdx: number,
  weeklyOffDay: number | null,
  fmParams: YeraltiExpandFmParams | undefined,
): YeraltiExpandSourceRow {
  const b0 = parseIsoDateLocal(segment.startISO);
  const b1 = parseIsoDateLocal(segment.endISO);
  const seg =
    b0 && b1 && b0 <= b1 ? countWorkDaysInInclusiveRange(b0, b1, weeklyOffDay) : 0;
  const excludedDays = resolveExcludedUnitsForDeductionSegment(segment);
  const brut = getAsgariUcretByDate(segment.startISO) ?? sourceRow.brut;
  const kats = sourceRow.katsayi ?? 1;

  let fmHours = sourceRow.fmHours ?? 0;
  if (fmParams && excludedDays > EPS) {
    fmHours = yeraltiFmHoursForDeductionWeek(fmParams, excludedDays);
  }

  const { fm, net } = yeraltiFmNet(1, brut, kats, fmHours);

  return {
    ...sourceRow,
    id: `yr-ded-${rowIdx}-${segIdx}-${segment.startISO}-${segment.endISO}`,
    startISO: segment.startISO,
    endISO: segment.endISO,
    rangeLabel: `${segment.startISO} – ${segment.endISO}`,
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
    yillikIzinAciklama: segment.caption || undefined,
    isExclusionBlock: true,
    prePreserveWeeks: 1,
  } as YeraltiExpandSourceRow;
}

function expandWithMotor(
  rows: YeraltiExpandSourceRow[],
  exclusions: ExcludedDay[],
  weeklyOffDay: number | null,
  fmParams: YeraltiExpandFmParams | undefined,
): YeraltiExpandSourceRow[] {
  const out: YeraltiExpandSourceRow[] = [];

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

    const periodResult = buildDeductionPeriodsForFm({
      periodStart: startISO,
      periodEnd: endISO,
      exclusions,
    });

    const deductionSegments = periodResult.segments.filter((s) => s.containsDeduction);
    if (deductionSegments.length === 0) {
      out.push(...enrichRowsWithoutDeductions([row], weeklyOffDay));
      return;
    }

    const originalWeeks = Math.max(0, Math.floor(Number(row.originalWeekCount ?? w0) || 0));
    const deductionWeekCount = deductionSegments.length;
    const baseWeeks = Math.max(0, originalWeeks - deductionWeekCount);

    if (baseWeeks > 0) {
      out.push(
        buildCombinedNormalRow(row, rowIdx, startISO, endISO, baseWeeks, originalWeeks, weeklyOffDay),
      );
    }

    deductionSegments
      .sort((a, b) => a.startISO.localeCompare(b.startISO))
      .forEach((segment, segIdx) => {
        const dedRow = mapDeductionSegmentToRow(
          segment,
          row,
          rowIdx,
          segIdx,
          weeklyOffDay,
          fmParams,
        );
        if (fmParams && dedRow.fmHours <= EPS) {
          return;
        }
        out.push(dedRow);
      });
  });

  return out.length > 0 ? out : rows;
}

/**
 * UBGT/yıllık izin: ortak motor + birleşik normal satır.
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
