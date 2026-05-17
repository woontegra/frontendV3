/**
 * Gemi Adamı 7/24 Çalışan — UBGT / yıllık izin düşüm satırı köprüsü.
 * Tarih: deductionPeriodEngine. FM: 7×24 formülü (91 net, gün başı 13 saat, 48+8 düşüm).
 */

import type { ExcludedDay } from "@/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import {
  buildDeductionPeriodsForFm,
  type FmPeriodSegment,
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

function mapDeductionSegmentToRow(
  segment: FmPeriodSegment,
  sourceRow: GemiExpandSourceRow,
  rowIdx: number,
  segIdx: number,
): GemiExpandSourceRow {
  const excludedDays = resolveExcludedUnitsForDeductionSegment(segment);
  const brut = getAsgariUcretByDate(segment.startISO) ?? sourceRow.brut;
  const kats = sourceRow.katsayi ?? 1;
  const fmHours = excludedDays > EPS ? gemi724FmHoursForDeduction(excludedDays) : sourceRow.fmHours ?? 0;
  const { fm, net } = gemi724FmNet(1, brut, kats, fmHours);

  return {
    ...sourceRow,
    id: `gemi724-ded-${rowIdx}-${segIdx}-${segment.startISO}-${segment.endISO}`,
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
      out.push(...enrichRowsWithoutDeductions([row]));
      return;
    }

    const originalWeeks = Math.max(0, Math.floor(Number(row.weeks) || 0));
    const deductionWeekCount = deductionSegments.length;
    const baseWeeks = Math.max(0, originalWeeks - deductionWeekCount);

    if (baseWeeks > 0) {
      out.push(buildCombinedNormalRow(row, rowIdx, startISO, endISO, baseWeeks));
    }

    deductionSegments
      .sort((a, b) => a.startISO.localeCompare(b.startISO))
      .forEach((segment, segIdx) => {
        const dedRow = mapDeductionSegmentToRow(segment, row, rowIdx, segIdx);
        if (dedRow.fmHours <= EPS) {
          return;
        }
        out.push(dedRow);
      });
  });

  return out.length > 0 ? out : rows;
}

/**
 * UBGT/yıllık izin: ortak motor + birleşik normal satır (7/24 FM formülü).
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
