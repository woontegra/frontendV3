/**
 * Gemi Adamı Günlük Çalışan — UBGT / yıllık izin düşüm satırı köprüsü.
 * Tarih: deductionPeriodEngine. FM: 48 saat sınırı; tutar: 240 / 1,25.
 */

import type { ExcludedDay } from "@/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import {
  buildDeductionPeriodsForFm,
  type FmPeriodSegment,
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

function sumDeductionDayUnits(segment: FmPeriodSegment): number {
  return segment.deductions.reduce((s, d) => s + d.dayWeight, 0);
}

function resolveExcludedUnitsForDeductionSegment(segment: FmPeriodSegment): number {
  const fromDeductions = sumDeductionDayUnits(segment);
  if (fromDeductions > EPS) return fromDeductions;
  return parseExcludedUnitsFromCaption(segment.caption) ?? 0;
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

function mapDeductionSegmentToRow(
  segment: FmPeriodSegment,
  sourceRow: GemiExpandSourceRow,
  rowIdx: number,
  segIdx: number,
  fmParams: GemiGunlukExpandFmParams | undefined,
): GemiExpandSourceRow {
  const excludedDays = resolveExcludedUnitsForDeductionSegment(segment);
  const brut = getAsgariUcretByDate(segment.startISO) ?? sourceRow.brut;
  const kats = sourceRow.katsayi ?? 1;

  let fmHours = sourceRow.fmHours ?? 0;
  if (fmParams && excludedDays > EPS) {
    fmHours = gemiFmHoursForDeductionWeek(fmParams, excludedDays);
  }

  const { fm, net } = gemiFmNet(1, brut, kats, fmHours);

  return {
    ...sourceRow,
    id: `gemi-ded-${rowIdx}-${segIdx}-${segment.startISO}-${segment.endISO}`,
    startISO: segment.startISO,
    endISO: segment.endISO,
    rangeLabel: `${segment.startISO} – ${segment.endISO}`,
    weeks: 1,
    brut,
    katsayi: kats,
    fmHours,
    fm,
    net,
    calc225: 240,
    factor: 1.25,
    yillikIzinAciklama: segment.caption || undefined,
  };
}

function expandWithMotor(
  rows: GemiExpandSourceRow[],
  exclusions: ExcludedDay[],
  weeklyOffDay: number | null,
  fmParams: GemiGunlukExpandFmParams | undefined,
): GemiExpandSourceRow[] {
  const out: GemiExpandSourceRow[] = [];

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

    const originalWeeks = Math.max(0, Math.floor(Number(row.weeks) || 0));
    const deductionWeekCount = deductionSegments.length;
    const baseWeeks = Math.max(0, originalWeeks - deductionWeekCount);

    if (baseWeeks > 0) {
      out.push(buildCombinedNormalRow(row, rowIdx, startISO, endISO, baseWeeks, originalWeeks));
    }

    deductionSegments
      .sort((a, b) => a.startISO.localeCompare(b.startISO))
      .forEach((segment, segIdx) => {
        const dedRow = mapDeductionSegmentToRow(segment, row, rowIdx, segIdx, fmParams);
        if (fmParams && dedRow.fmHours <= EPS) {
          return;
        }
        out.push(dedRow);
      });
  });

  return out.length > 0 ? out : rows;
}

/**
 * UBGT/yıllık izin: ortak motor + birleşik normal satır (48 saat FM sınırı).
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
