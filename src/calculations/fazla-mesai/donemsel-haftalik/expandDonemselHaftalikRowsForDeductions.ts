/**
 * Dönemsel Haftalık — UBGT / yıllık izin düşüm satırı köprüsü.
 * Tarih: deductionPeriodEngine. FM: deductionDailyHourStrategy (haftalık net − strateji saati − 45).
 */

import { addDays } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import type { FazlaMesaiRowBase } from "@modules/fazla-mesai/shared";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import {
  buildDeductionPeriodsForFm,
  parseFmDate,
  type FmPeriodSegment,
} from "@/shared/utils/fazlaMesai/deductionPeriodEngine";
import { filterExclusionsForWeeklyOff } from "@/shared/utils/fazlaMesai/weeklyOffExclusionFilter";
import { splitByExclusions } from "@/modules/tanikli-standart/rules/splitByExclusions.rule";
import { countWeeksBySevenDaySteps } from "@/modules/tanikli-standart/rules/preserveWeeks.rule";
import type { TanikliRowWithSegmentFields } from "@/modules/tanikli-standart/rules/calculateFm.rule";
import { ceilWeeklyWorkHoursToHalfHour } from "@/shared/utils/fazlaMesai/weeklyHoursRounding";
import type { SeasonalPattern } from "../donemsel/types";
import { calcDailyNetHours, calcFmHoursPerWeekHaftalik } from "../donemsel/utils";
import { resolveDeductionMarginalNetHours } from "./deductionDailyHourStrategy";

const WEEKLY_WORK_LIMIT = 45;

export type DonemselHaftalikDeductionMeta = {
  pattern: SeasonalPattern;
  deductionDates: Array<{ dateISO: string; dayWeight: number }>;
};

export type DonemselHaftalikSeasonalDeductionContext = {
  summerPattern: SeasonalPattern;
  winterPattern: SeasonalPattern;
  summerMonths: number[];
};

function roundFmHours(h: number): number {
  if (!Number.isFinite(h) || h <= 0) return 0;
  return Number(h.toFixed(2));
}

function collectSeasonalGroupNetDailiesInOrder(pattern: SeasonalPattern): number[] {
  const d1 = Math.max(0, Math.min(7, pattern.days1 ?? 0));
  const d2 = Math.max(0, Math.min(7, pattern.days2 ?? 0));
  const net1 =
    d1 > 0 && pattern.startTime && pattern.endTime
      ? calcDailyNetHours(pattern.startTime, pattern.endTime)
      : 0;
  const net2 =
    d2 > 0 && pattern.startTime2 && pattern.endTime2
      ? calcDailyNetHours(pattern.startTime2, pattern.endTime2)
      : 0;
  return [net1, net2];
}

function weeklyNetFromHaftalikPattern(pattern: SeasonalPattern): number {
  return calcFmHoursPerWeekHaftalik(pattern) + WEEKLY_WORK_LIMIT;
}

/** UBGT/yıllık izin düşüm haftası FM — haftalık ortalama gün veya (baseline+45)/hg kullanılmaz. */
export function calculateDonemselHaftalikDeductionFmHours(opts: {
  pattern: SeasonalPattern;
  deductionDates: Array<{ dateISO: string; dayWeight: number }>;
}): number {
  const { pattern, deductionDates } = opts;
  if (!deductionDates?.length) {
    return calcFmHoursPerWeekHaftalik(pattern);
  }

  let weeklyNet = weeklyNetFromHaftalikPattern(pattern);
  const marginalPerDay = resolveDeductionMarginalNetHours(
    collectSeasonalGroupNetDailiesInOrder(pattern),
  );
  if (marginalPerDay <= 0) {
    return calcFmHoursPerWeekHaftalik(pattern);
  }

  const seen = new Set<string>();
  for (const item of deductionDates) {
    const dateISO = String(item.dateISO || "").slice(0, 10);
    if (!dateISO || seen.has(dateISO)) continue;
    seen.add(dateISO);
    const weight = Math.max(0, Math.min(1, Number(item.dayWeight) || 1));
    weeklyNet = Math.max(0, weeklyNet - marginalPerDay * weight);
  }

  const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(weeklyNet);
  return roundFmHours(Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT));
}

export function resolveSeasonalPatternForDate(
  dateISO: string,
  ctx: DonemselHaftalikSeasonalDeductionContext,
): SeasonalPattern {
  const d = parseFmDate(dateISO);
  const month = d ? d.getMonth() + 1 : 0;
  const summerMonths = ctx.summerMonths?.length ? ctx.summerMonths : ctx.summerPattern.months ?? [];
  return summerMonths.includes(month) ? ctx.summerPattern : ctx.winterPattern;
}

/** calculateFm sonrası düşüm satırı FM’sini strateji ile düzeltir. */
export function applyDonemselHaftalikDeductionFmOverride<T extends TanikliRowWithSegmentFields>(
  row: T,
): T {
  const meta = (row as T & { donemselHaftalikDeduction?: DonemselHaftalikDeductionMeta })
    .donemselHaftalikDeduction;
  if (!row.isExclusionBlock || !meta?.pattern) return row;
  const fmHours = calculateDonemselHaftalikDeductionFmHours({
    pattern: meta.pattern,
    deductionDates: meta.deductionDates ?? [],
  });
  return { ...row, fmHours };
}

const LEGACY_ONLY_EXCLUSION_TYPES = new Set(["Rapor", "Diğer", "Puantaj/Bordro"]);

export interface ExpandDonemselHaftalikRowsForDeductionsParams {
  rows: FazlaMesaiRowBase[];
  exclusions: ExcludedDay[];
  weeklyOffDay: number | null;
  seasonalDeductionContext?: DonemselHaftalikSeasonalDeductionContext;
}

function isLegacyOnlyExclusionType(type: string): boolean {
  return LEGACY_ONLY_EXCLUSION_TYPES.has(String(type || "").trim());
}

export function exclusionsNeedLegacySplit(exclusions: ExcludedDay[]): boolean {
  if (!exclusions?.length) return false;
  return exclusions.some((ex) => isLegacyOnlyExclusionType(String(ex.type || "")));
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
  rows: FazlaMesaiRowBase[],
  weeklyOffDay: number | null,
): FazlaMesaiRowBase[] {
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
    } as FazlaMesaiRowBase;
  });
}

function sumDeductionDayUnits(segment: FmPeriodSegment): number {
  return segment.deductions.reduce((s, d) => s + d.dayWeight, 0);
}

function buildCombinedNormalRow(
  sourceRow: FazlaMesaiRowBase,
  rowIdx: number,
  periodStartISO: string,
  periodEndISO: string,
  baseWeeks: number,
  originalWeeks: number,
  weeklyOffDay: number | null,
): FazlaMesaiRowBase {
  const rowStart = parseIsoDateLocal(periodStartISO);
  const rowEnd = parseIsoDateLocal(periodEndISO);
  const segmentMain =
    rowStart && rowEnd && rowStart <= rowEnd
      ? countWorkDaysInInclusiveRange(rowStart, rowEnd, weeklyOffDay)
      : 0;

  return {
    ...sourceRow,
    id: `auto-base-${rowIdx}-${periodStartISO}-${periodEndISO}`,
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
  } as FazlaMesaiRowBase;
}

function mapDeductionSegmentToRow(
  segment: FmPeriodSegment,
  sourceRow: FazlaMesaiRowBase,
  rowIdx: number,
  segIdx: number,
  weeklyOffDay: number | null,
  seasonalCtx: DonemselHaftalikSeasonalDeductionContext | undefined,
): FazlaMesaiRowBase {
  const b0 = parseIsoDateLocal(segment.startISO);
  const b1 = parseIsoDateLocal(segment.endISO);
  const seg =
    b0 && b1 && b0 <= b1 ? countWorkDaysInInclusiveRange(b0, b1, weeklyOffDay) : 0;
  const excludedDays = sumDeductionDayUnits(segment);
  const brut = getAsgariUcretByDate(segment.startISO) ?? sourceRow.brut;
  const deductionDates = segment.deductions.map((d) => ({
    dateISO: d.dateISO,
    dayWeight: d.dayWeight,
  }));
  const pattern =
    seasonalCtx != null
      ? resolveSeasonalPatternForDate(segment.startISO, seasonalCtx)
      : undefined;

  return {
    ...sourceRow,
    id: `auto-ded-${rowIdx}-${segIdx}-${segment.startISO}-${segment.endISO}`,
    startISO: segment.startISO,
    endISO: segment.endISO,
    rangeLabel: `${segment.startISO} – ${segment.endISO}`,
    weeks: 1,
    originalWeekCount: 1,
    brut,
    segmentWorkDays: seg,
    excludedDays,
    totalDays: seg,
    yillikIzinAciklama: segment.caption || undefined,
    isExclusionBlock: true,
    prePreserveWeeks: 1,
    donemselHaftalikDeduction:
      pattern != null ? { pattern, deductionDates } : undefined,
  } as FazlaMesaiRowBase;
}

function expandWithMotor(
  rows: FazlaMesaiRowBase[],
  exclusions: ExcludedDay[],
  weeklyOffDay: number | null,
  seasonalDeductionContext: DonemselHaftalikSeasonalDeductionContext | undefined,
): FazlaMesaiRowBase[] {
  const out: FazlaMesaiRowBase[] = [];

  rows.forEach((row, rowIdx) => {
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
        out.push(
          mapDeductionSegmentToRow(
            segment,
            row,
            rowIdx,
            segIdx,
            weeklyOffDay,
            seasonalDeductionContext,
          ),
        );
      });
  });

  return out.length > 0 ? out : rows;
}

export function expandDonemselHaftalikRowsForDeductions(
  params: ExpandDonemselHaftalikRowsForDeductionsParams,
): FazlaMesaiRowBase[] {
  const { rows, exclusions, weeklyOffDay, seasonalDeductionContext } = params;
  if (!rows.length) return rows;
  if (!exclusions?.length) {
    return enrichRowsWithoutDeductions(rows, weeklyOffDay);
  }

  const exclusionsForMotor = filterExclusionsForWeeklyOff(exclusions, weeklyOffDay);

  if (exclusionsNeedLegacySplit(exclusions)) {
    return splitByExclusions(rows, exclusionsForMotor, { weeklyOffDay });
  }

  return expandWithMotor(rows, exclusionsForMotor, weeklyOffDay, seasonalDeductionContext);
}
