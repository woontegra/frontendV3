/**
 * Haftalık Karma — UBGT / yıllık izin düşüm satırı köprüsü.
 * Tarih: deductionPeriodEngine. FM/tutar: sayfa pipeline (calculateFm, preserveWeeks, calculateRowMoney).
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
import { splitByExclusions } from "@/modules/tanikli-standart/rules/splitByExclusions.rule";
import { countWeeksBySevenDaySteps } from "@/modules/tanikli-standart/rules/preserveWeeks.rule";

const LEGACY_ONLY_EXCLUSION_TYPES = new Set(["Rapor", "Diğer", "Puantaj/Bordro"]);

export interface ExpandHaftalikKarmaRowsForDeductionsParams {
  rows: FazlaMesaiRowBase[];
  exclusions: ExcludedDay[];
  weeklyOffDay: number | null;
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
): FazlaMesaiRowBase {
  const b0 = parseIsoDateLocal(segment.startISO);
  const b1 = parseIsoDateLocal(segment.endISO);
  const seg =
    b0 && b1 && b0 <= b1 ? countWorkDaysInInclusiveRange(b0, b1, weeklyOffDay) : 0;
  const excludedDays = sumDeductionDayUnits(segment);
  const brut = getAsgariUcretByDate(segment.startISO) ?? sourceRow.brut;

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
    karmaDeductionDates: segment.deductions.map((d) => ({
      dateISO: d.dateISO,
      dayWeight: d.dayWeight,
    })),
  } as FazlaMesaiRowBase;
}

function expandWithMotor(
  rows: FazlaMesaiRowBase[],
  exclusions: ExcludedDay[],
  weeklyOffDay: number | null,
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
        out.push(mapDeductionSegmentToRow(segment, row, rowIdx, segIdx, weeklyOffDay));
      });
  });

  return out.length > 0 ? out : rows;
}

export function expandHaftalikKarmaRowsForDeductions(
  params: ExpandHaftalikKarmaRowsForDeductionsParams,
): FazlaMesaiRowBase[] {
  const { rows, exclusions, weeklyOffDay } = params;
  if (!rows.length) return rows;
  if (!exclusions?.length) {
    return enrichRowsWithoutDeductions(rows, weeklyOffDay);
  }

  if (exclusionsNeedLegacySplit(exclusions)) {
    return splitByExclusions(rows, exclusions, { weeklyOffDay });
  }

  return expandWithMotor(rows, exclusions, weeklyOffDay);
}
