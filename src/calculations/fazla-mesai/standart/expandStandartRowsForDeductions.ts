/**
 * Standart fazla mesai — UBGT / yıllık izin düşüm satırı köprüsü.
 * Tarih bölme: deductionPeriodEngine (her zaman 7 günlük pencere, gerçek tarihten başlar).
 * FM saati: haftalık çalışma günü (5/6/7) ve tatilli/tatilsiz seçimine göre.
 */

import type { ExcludedDay } from "@/utils/exclusionStorage";
import type { FazlaMesaiRowBase } from "@modules/fazla-mesai/shared";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import {
  buildDeductionPeriodsForFm,
  type FmPeriodSegment,
} from "@/shared/utils/fazlaMesai/deductionPeriodEngine";
import { resolveStoredManualBrutForStartISO } from "@/shared/utils/fazlaMesai/fmManualWageRowOverrides";
import { bilirkisiRoundWeeklyTotalHours } from "./annualLeaveSixDayRowSplit";
import {
  FAZLA_MESAI_DENOMINATOR,
  FAZLA_MESAI_KATSAYI,
  STANDARD_DAILY_REFERENCE_HOURS,
  WEEKLY_WORK_LIMIT,
} from "./constants";
import { DAMGA_VERGISI_ORANI, GELIR_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";

export interface ExpandStandartRowsForDeductionsParams {
  rows: FazlaMesaiRowBase[];
  exclusions: ExcludedDay[];
  /** Haftalık çalışma günü — yalnızca düşüm FM saati hesabında. */
  weeklyDays: number;
  dailyNet: number;
  baselineWeeklyFm: number;
  davaciSevenDay?: "tatilli" | "tatilsiz";
  weeklyOffDay?: number | null;
  rowOverrides?: Record<string, Partial<FazlaMesaiRowBase>>;
}

function normalizeWeeksForStandard(startISO: string, endISO: string, rawWeeks: number): number {
  const s = (startISO || "").slice(0, 10);
  const e = (endISO || "").slice(0, 10);
  if (!s || !e) return rawWeeks;
  const sy = s.slice(0, 4);
  const ey = e.slice(0, 4);
  const w = Number(rawWeeks);
  const safeW = Number.isFinite(w) && w > 0 ? w : NaN;
  if (sy === ey && s.slice(5) === "01-01" && e.slice(5) === "12-31") {
    return Number.isFinite(safeW) ? Math.min(52, safeW) : 52;
  }
  if (sy === ey && s.slice(5) === "01-01" && e.slice(5) === "06-30") {
    return Number.isFinite(safeW) ? Math.min(26, safeW) : 26;
  }
  if (sy === ey && s.slice(5) === "07-01" && e.slice(5) === "12-31") {
    return Number.isFinite(safeW) ? Math.min(26, safeW) : 26;
  }
  return rawWeeks;
}

/**
 * Düşüm satırı FM saati — çalışma günü sayısına göre; tarih aralığı motordan gelir.
 */
export function computeDeductionFmHoursForHg(
  weeklyDays: number,
  dailyNet: number,
  deductionDayUnits: number,
  davaciSevenDay: "tatilli" | "tatilsiz",
): number {
  const hgSafe = Math.max(1, Math.min(7, Math.floor(weeklyDays) || 6));
  const leave = Math.min(hgSafe, Math.max(0, deductionDayUnits));

  if (hgSafe >= 7) {
    if (davaciSevenDay === "tatilli") {
      const weeklyWork = dailyNet * 6;
      const extraHT = Math.max(0, dailyNet - STANDARD_DAILY_REFERENCE_HOURS);
      const rawTotal = Math.max(0, weeklyWork + extraHT - leave * dailyNet);
      return Math.max(0, bilirkisiRoundWeeklyTotalHours(rawTotal) - WEEKLY_WORK_LIMIT);
    }
    const rawTotal = Math.max(0, (7 - leave) * dailyNet);
    return Math.max(0, bilirkisiRoundWeeklyTotalHours(rawTotal) - WEEKLY_WORK_LIMIT);
  }

  const workedDays = Math.max(0, hgSafe - leave);
  const rawTotal = dailyNet * workedDays;
  return Math.max(0, bilirkisiRoundWeeklyTotalHours(rawTotal) - WEEKLY_WORK_LIMIT);
}

function sumDeductionDayUnits(segment: FmPeriodSegment): number {
  return segment.deductions.reduce((s, d) => s + d.dayWeight, 0);
}

function calcRowAmounts(
  weeks: number,
  fmHours: number,
  brut: number,
  kats: number,
): { fm: number; net: number } {
  const fm = Number(
    (((brut * kats * weeks * fmHours) / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI).toFixed(2),
  );
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
  return { fm, net };
}

/** Ana dönem: orijinal tarih aralığı, hafta = orijinal − düşüm hafta adedi. */
function buildCombinedNormalRow(
  sourceRow: FazlaMesaiRowBase,
  rowIdx: number,
  periodStartISO: string,
  periodEndISO: string,
  baseWeeks: number,
  originalWeeks: number,
  params: ExpandStandartRowsForDeductionsParams,
): FazlaMesaiRowBase {
  const kats = sourceRow.katsayi ?? 1;
  const effectiveDailyNet = sourceRow.dailyNet ?? params.dailyNet;
  const brutManual = (sourceRow as { brutManual?: boolean }).brutManual === true;
  const asgariBrut = getAsgariUcretByDate(periodStartISO) || sourceRow.brut || 0;
  const brut = params.rowOverrides
    ? resolveStoredManualBrutForStartISO(periodStartISO, params.rowOverrides, asgariBrut).brut
    : brutManual && sourceRow.brut
      ? sourceRow.brut
      : asgariBrut;

  const fmHours = params.baselineWeeklyFm ?? sourceRow.fmHours ?? 0;
  const { fm, net } = calcRowAmounts(baseWeeks, fmHours, brut, kats);

  return {
    ...sourceRow,
    id: `auto-base-${rowIdx}-${periodStartISO}-${periodEndISO}`,
    startISO: periodStartISO,
    endISO: periodEndISO,
    rangeLabel: `${periodStartISO} – ${periodEndISO}`,
    weeks: baseWeeks,
    originalWeekCount: originalWeeks,
    brut,
    katsayi: kats,
    fmHours,
    dailyNet: effectiveDailyNet,
    fm,
    net,
    wage: brut,
    overtimeAmount: fm,
    ...(brutManual ? { brutManual: true } : {}),
  } as FazlaMesaiRowBase;
}

function mapDeductionSegmentToRow(
  segment: FmPeriodSegment,
  sourceRow: FazlaMesaiRowBase,
  rowIdx: number,
  segIdx: number,
  params: ExpandStandartRowsForDeductionsParams,
): FazlaMesaiRowBase {
  const kats = sourceRow.katsayi ?? 1;
  const effectiveDailyNet = sourceRow.dailyNet ?? params.dailyNet;
  const brutManual = (sourceRow as { brutManual?: boolean }).brutManual === true;
  const asgariBrut = getAsgariUcretByDate(segment.startISO) || sourceRow.brut || 0;
  const brut = params.rowOverrides
    ? resolveStoredManualBrutForStartISO(segment.startISO, params.rowOverrides, asgariBrut).brut
    : brutManual && sourceRow.brut
      ? sourceRow.brut
      : asgariBrut;

  const davaciSevenDay = params.davaciSevenDay ?? "tatilsiz";
  const hg = params.weeklyDays;
  const weeks = 1;
  const deductionUnits = sumDeductionDayUnits(segment);
  const fmHours = computeDeductionFmHoursForHg(hg, effectiveDailyNet, deductionUnits, davaciSevenDay);
  const excludedDays = deductionUnits;
  const workedDays = Math.max(0, Math.min(7, hg) - Math.min(Math.min(7, hg), deductionUnits));

  const { fm, net } = calcRowAmounts(weeks, fmHours, brut, kats);

  return {
    ...sourceRow,
    id: `auto-ded-${rowIdx}-${segIdx}-${segment.startISO}-${segment.endISO}`,
    startISO: segment.startISO,
    endISO: segment.endISO,
    rangeLabel: `${segment.startISO} – ${segment.endISO}`,
    weeks,
    originalWeekCount: weeks,
    brut,
    katsayi: kats,
    fmHours,
    dailyNet: effectiveDailyNet,
    workedDays,
    excludedDays,
    fm,
    net,
    wage: brut,
    overtimeAmount: fm,
    yillikIzinAciklama: segment.caption || undefined,
    ...(brutManual ? { brutManual: true } : {}),
  } as FazlaMesaiRowBase;
}

/**
 * Her asgari dönem satırını UBGT/yıllık izin düşümlerine göre parçalar.
 */
export function expandStandartRowsForDeductions(
  params: ExpandStandartRowsForDeductionsParams,
): FazlaMesaiRowBase[] {
  const { rows, exclusions, dailyNet } = params;
  if (!rows.length) return rows;
  if (!exclusions?.length || dailyNet <= 0) return rows;

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
      out.push(row);
      return;
    }

    const originalWeeks = normalizeWeeksForStandard(
      startISO,
      endISO,
      row.originalWeekCount ?? w0,
    );
    const deductionWeekCount = deductionSegments.length;
    const baseWeeks = Math.max(0, originalWeeks - deductionWeekCount);

    const periodRows: FazlaMesaiRowBase[] = [];

    if (baseWeeks > 0) {
      periodRows.push(
        buildCombinedNormalRow(row, rowIdx, startISO, endISO, baseWeeks, originalWeeks, params),
      );
    }

    deductionSegments
      .sort((a, b) => a.startISO.localeCompare(b.startISO))
      .forEach((segment, segIdx) => {
        periodRows.push(mapDeductionSegmentToRow(segment, row, rowIdx, segIdx, params));
      });

    out.push(...periodRows);
  });

  return out.length > 0 ? out : rows;
}

/** Birim test / rapor için örnek senaryolar. */
export function runExpandStandartRowsDeductionExamples(): {
  example1Rows: Array<{ start: string; end: string; weeks: number; deduction: boolean }>;
  example1NormalWeeks: number;
  example2DeductionRowCount: number;
  example2NormalWeeks: number;
  example3DeductionUnits: number;
} {
  const baseRow = (start: string, end: string, weeks: number): FazlaMesaiRowBase =>
    ({
      id: `test-${start}`,
      startISO: start,
      endISO: end,
      rangeLabel: `${start} – ${end}`,
      weeks,
      originalWeekCount: weeks,
      brut: 3577.5,
      katsayi: 1,
      fmHours: 14,
      dailyNet: 10.6875,
      fm: 1000,
      net: 800,
    }) as FazlaMesaiRowBase;

  const common = {
    weeklyDays: 7,
    dailyNet: 10.6875,
    baselineWeeklyFm: 14,
    davaciSevenDay: "tatilsiz" as const,
  };

  const ex1 = expandStandartRowsForDeductions({
    rows: [baseRow("2021-01-01", "2021-12-31", 52)],
    exclusions: [
      { id: "u1", type: "UBGT", start: "2021-04-23", end: "2021-04-23", days: 1 },
    ],
    ...common,
  });

  const ex2 = expandStandartRowsForDeductions({
    rows: [baseRow("2021-01-01", "2021-12-31", 52)],
    exclusions: [
      { id: "u1", type: "UBGT", start: "2021-04-23", end: "2021-04-23", days: 1 },
      { id: "y1", type: "Yıllık İzin", start: "2021-04-25", end: "2021-04-25", days: 1 },
    ],
    ...common,
  });

  const ex3Rows = expandStandartRowsForDeductions({
    rows: [baseRow("2022-05-01", "2022-05-07", 1)],
    exclusions: [
      { id: "a", type: "UBGT", start: "2022-05-01", end: "2022-05-01", days: 1 },
      { id: "b", type: "UBGT", start: "2022-05-01", end: "2022-05-01", days: 0.5 },
    ],
    ...common,
  });

  const ded3 = ex3Rows.find((r) => (r as { yillikIzinAciklama?: string }).yillikIzinAciklama);

  const ex1Normal = ex1.find((r) => !(r as { yillikIzinAciklama?: string }).yillikIzinAciklama);
  const ex2Normal = ex2.find((r) => !(r as { yillikIzinAciklama?: string }).yillikIzinAciklama);

  return {
    example1Rows: ex1.map((r) => ({
      start: r.startISO ?? "",
      end: r.endISO ?? "",
      weeks: Number(r.weeks) || 0,
      deduction: Boolean((r as { yillikIzinAciklama?: string }).yillikIzinAciklama),
    })),
    example1NormalWeeks: Number(ex1Normal?.weeks) || 0,
    example2DeductionRowCount: ex2.filter((r) => (r as { yillikIzinAciklama?: string }).yillikIzinAciklama)
      .length,
    example2NormalWeeks: Number(ex2Normal?.weeks) || 0,
    example3DeductionUnits: (ded3 as { excludedDays?: number })?.excludedDays ?? 0,
  };
}
