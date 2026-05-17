/**
 * 24 Saat Vardiya — UBGT / yıllık izin düşüm satırı köprüsü.
 * Tarih: deductionPeriodEngine.
 * Düşüm FM: kalan çalışma günü × 3 (4→12, 3→9; 1 gün düşüm 4'lük haftada → 9 saat).
 */

import type { ExcludedDay } from "@/utils/exclusionStorage";
import {
  buildDeductionPeriodsForFm,
  type FmPeriodSegment,
} from "@/shared/utils/fazlaMesai/deductionPeriodEngine";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import { generateWorkDays24 } from "../../../utils/fazlaMesai/vardiya24/generateWorkDays24";
import {
  getAnchorWeekBucketKey,
  groupWeeks24,
} from "../../../utils/fazlaMesai/vardiya24/groupWeeks24";

/** 24 saat vardiya: haftalık 12 veya 9 saat → gün başı 3 saat FM. */
export const VARDIYA24_FM_HOURS_PER_WORK_DAY = 3;

/** 24 Saat Vardiya cetvel satırı (köprü — sayfa ile uyumlu). */
export type Vardiya24ExpandRow = {
  id?: string;
  isManual?: boolean;
  rangeLabel?: string;
  weeks: number;
  brut: number;
  katsayi?: number;
  fmHours: number;
  calc225?: number;
  factor?: number;
  fm?: number;
  net?: number;
  startISO: string;
  endISO: string;
  yillikIzinAciklama?: string;
  weekTypeLabel?: string;
};

export type ExpandVardiya24RowsForDeductionsOptions = {
  anchorStartDate: string;
  anchorIsWorkDay: boolean;
  segmentStart: string;
  segmentEnd: string;
};

const LEGACY_ONLY_EXCLUSION_TYPES = new Set(["Rapor", "Diğer", "Puantaj/Bordro"]);

const MOTOR_EXCLUSION_TYPES = new Set(["UBGT", "Yıllık İzin"]);

const EPS = 1e-7;

export function exclusionsNeedLegacySplit(exclusions: ExcludedDay[]): boolean {
  if (!exclusions?.length) return false;
  return exclusions.some((ex) => LEGACY_ONLY_EXCLUSION_TYPES.has(String(ex.type || "").trim()));
}

export function partitionVardiya24Exclusions(exclusions: ExcludedDay[] | null | undefined): {
  motor: ExcludedDay[];
  legacy: ExcludedDay[];
} {
  const motor: ExcludedDay[] = [];
  const legacy: ExcludedDay[] = [];
  for (const ex of exclusions || []) {
    const t = String(ex.type || "").trim();
    if (MOTOR_EXCLUSION_TYPES.has(t)) motor.push(ex);
    else legacy.push(ex);
  }
  return { motor, legacy };
}

export function sumDeductionDayUnits(segment: FmPeriodSegment): number {
  return segment.deductions.reduce((s, d) => s + d.dayWeight, 0);
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

export function resolveExcludedDaysForDeductionSegment(segment: FmPeriodSegment): number {
  const fromDeductions = sumDeductionDayUnits(segment);
  if (fromDeductions > EPS) return fromDeductions;
  return parseExcludedUnitsFromCaption(segment.caption) ?? 0;
}

/** Geçiş satırı (4→3 gün) — legacy calculate24System; motor UBGT/yıllık izin değil. */
export function isVardiya24TransitionDeductionNote(note?: string): boolean {
  return /\(\d+\s*->\s*\d+\s*gün\)/i.test(String(note || ""));
}

/** Köprü + motor düşüm satırı (UBGT/yıllık izin caption). */
export function isVardiya24MotorDeductionNote(note?: string): boolean {
  const n = String(note || "").trim();
  if (!n) return false;
  return !isVardiya24TransitionDeductionNote(n);
}

export function parseWeekTypeLabelDays(row: Vardiya24ExpandRow): number {
  const m = /^([\d]+(?:[.,]5)?)\s*gün/i.exec(String(row.weekTypeLabel || "").trim());
  if (m) {
    const n = parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fm = Number(row.fmHours) || 0;
  if (fm > EPS) return Math.round(fm / VARDIYA24_FM_HOURS_PER_WORK_DAY);
  return 0;
}

/** Normal satır hafta tipi: 4 gün→12 saat, 3 gün→9 saat (düşüm satırı kalan günü değil). */
export function rowBaseWeekDaysFromFm(row: Vardiya24ExpandRow): number {
  const fromLabel = parseWeekTypeLabelDays(row);
  if (fromLabel === 3 || fromLabel === 4) return fromLabel;
  const fm = Math.round(Number(row.fmHours) || 0);
  if (fm === 12) return 4;
  if (fm === 9) return 3;
  if (fm > EPS) {
    const inferred = Math.round(fm / VARDIYA24_FM_HOURS_PER_WORK_DAY);
    if (inferred === 3 || inferred === 4) return inferred;
  }
  return fromLabel;
}

/**
 * Düşüm penceresinin denk geldiği haftanın çalışma günü (4 veya 3).
 * calculate24System ile aynı: generateWorkDays24 + groupWeeks24.
 */
export function resolveBaseWeekDaysForDeductionSegment(
  segment: FmPeriodSegment,
  opts: ExpandVardiya24RowsForDeductionsOptions,
  normalRows: Vardiya24ExpandRow[],
): number {
  const triggerDate =
    segment.deductions.find((d) => d.dateISO)?.dateISO?.slice(0, 10) ||
    segment.startISO.slice(0, 10);

  const generated = generateWorkDays24({
    startDate: opts.segmentStart,
    endDate: opts.segmentEnd,
    anchorIsWorkDay: opts.anchorIsWorkDay,
  });

  const weeks = groupWeeks24(generated, {
    periodStart: opts.anchorStartDate,
    periodEnd: opts.segmentEnd,
  });

  const bucketKey = getAnchorWeekBucketKey(triggerDate, opts.anchorStartDate);
  let workDayCount = 0;
  if (bucketKey) {
    const byBucket = weeks.find((w) => w.weekStartMonday === bucketKey);
    if (byBucket) workDayCount = byBucket.workDayCount;
  }
  if (workDayCount <= 0) {
    const byRange = weeks.find(
      (w) => triggerDate >= w.startDate.slice(0, 10) && triggerDate <= w.endDate.slice(0, 10),
    );
    if (byRange) workDayCount = byRange.workDayCount;
  }

  const standardWeek = weeks.find(
    (w) =>
      w.workDayCount >= 3 &&
      w.workDayCount <= 4 &&
      triggerDate >= w.startDate.slice(0, 10) &&
      triggerDate <= w.endDate.slice(0, 10),
  );
  if (standardWeek) return standardWeek.workDayCount;

  if (workDayCount >= 3 && workDayCount <= 4) return workDayCount;

  const fmTarget = workDayCount > 0 ? workDayCount * VARDIYA24_FM_HOURS_PER_WORK_DAY : 0;
  const matchRow = normalRows.find((r) => {
    const days = rowBaseWeekDaysFromFm(r);
    if (workDayCount > 0 && days === workDayCount) return true;
    if (fmTarget > 0 && Math.round(Number(r.fmHours) || 0) === fmTarget) return true;
    return false;
  });
  if (matchRow) return rowBaseWeekDaysFromFm(matchRow);

  const four = normalRows.find((r) => rowBaseWeekDaysFromFm(r) === 4);
  if (four) return 4;
  const three = normalRows.find((r) => rowBaseWeekDaysFromFm(r) === 3);
  if (three) return 3;

  return workDayCount > 0 ? Math.min(4, Math.max(3, workDayCount)) : 4;
}

/** Kalan günlük çalışma → haftalık FM (düşüm satırı gösterimi). */
export function vardiya24DeductionWeeklyFmHours(baseWeekDays: number, excludedDays: number): number {
  const base = Math.max(0, Number(baseWeekDays) || 0);
  const excl = Math.max(0, Number(excludedDays) || 0);
  const remaining = Math.max(0, base - excl);
  return Number((remaining * VARDIYA24_FM_HOURS_PER_WORK_DAY).toFixed(2));
}

function formatRemainingDayLabel(remainingDays: number): string {
  const n = Math.round(remainingDays * 100) / 100;
  if (Math.abs(n - Math.round(n)) < 0.001) {
    return `${Math.round(n)} gün`;
  }
  return `${String(n).replace(".", ",")} gün`;
}

function periodKey(row: Vardiya24ExpandRow): string {
  return `${(row.startISO || "").slice(0, 10)}|${(row.endISO || "").slice(0, 10)}`;
}

function isDeductionLikeRow(row: Vardiya24ExpandRow): boolean {
  return !!(row.yillikIzinAciklama || "").trim();
}

function subtractOneWeekFromWeekType(
  rows: Vardiya24ExpandRow[],
  baseWeekDays: number,
): Vardiya24ExpandRow[] {
  const targetFm = baseWeekDays * VARDIYA24_FM_HOURS_PER_WORK_DAY;
  const out = rows.map((r) => ({ ...r }));

  let idx = out.findIndex((r) => rowBaseWeekDaysFromFm(r) === baseWeekDays);
  if (idx < 0) {
    idx = out.findIndex((r) => Math.round(Number(r.fmHours) || 0) === targetFm);
  }
  if (idx < 0) {
    idx = out.reduce((best, r, i) => {
      if (best < 0) return i;
      if (rowBaseWeekDaysFromFm(r) === baseWeekDays) return i;
      if (rowBaseWeekDaysFromFm(out[best]) === baseWeekDays) return best;
      return (Number(r.weeks) || 0) > (Number(out[best].weeks) || 0) ? i : best;
    }, -1);
  }

  if (idx >= 0) {
    const prev = Math.round(Number(out[idx].weeks) || 0);
    out[idx] = {
      ...out[idx],
      weeks: Math.max(0, prev - 1),
    };
  }

  return out.filter((r) => (Number(r.weeks) || 0) > 0);
}

function mapDeductionSegmentToVardiyaRow(
  segment: FmPeriodSegment,
  template: Vardiya24ExpandRow,
  baseWeekDays: number,
  excludedDays: number,
  rowIdx: number,
  segIdx: number,
): Vardiya24ExpandRow | null {
  const remainingDays = Math.max(0, baseWeekDays - excludedDays);
  if (remainingDays <= EPS) return null;

  const fmHours = vardiya24DeductionWeeklyFmHours(baseWeekDays, excludedDays);
  const brut = getAsgariUcretByDate(segment.startISO) ?? template.brut ?? 0;

  return {
    ...template,
    id: `v24-ded-${rowIdx}-${segIdx}-${segment.startISO}`,
    isManual: false,
    startISO: segment.startISO,
    endISO: segment.endISO,
    rangeLabel: `${segment.startISO} – ${segment.endISO}`,
    weeks: 1,
    brut,
    katsayi: template.katsayi ?? 1,
    fmHours,
    calc225: template.calc225 ?? 225,
    factor: template.factor ?? 1.5,
    fm: 0,
    net: 0,
    weekTypeLabel: formatRemainingDayLabel(remainingDays),
    yillikIzinAciklama: segment.caption || undefined,
  };
}

function expandPeriodGroup(
  groupRows: Vardiya24ExpandRow[],
  exclusions: ExcludedDay[],
  opts: ExpandVardiya24RowsForDeductionsOptions,
  rowIdx: number,
): Vardiya24ExpandRow[] {
  const normalRows = groupRows.filter((r) => !isDeductionLikeRow(r));
  if (!normalRows.length) return groupRows;

  const periodStart = normalRows[0].startISO;
  const periodEnd = normalRows[0].endISO;
  if (!periodStart || !periodEnd) return groupRows;

  const periodResult = buildDeductionPeriodsForFm({
    periodStart,
    periodEnd,
    exclusions,
  });

  const deductionSegments = periodResult.segments.filter((s) => s.containsDeduction);
  if (!deductionSegments.length) return groupRows;

  const template = normalRows[0];
  let workingNormals = normalRows.map((r) => ({ ...r }));
  const deductionRows: Vardiya24ExpandRow[] = [];

  deductionSegments
    .sort((a, b) => a.startISO.localeCompare(b.startISO))
    .forEach((segment, segIdx) => {
      const baseWeekDays = resolveBaseWeekDaysForDeductionSegment(segment, opts, normalRows);
      const excludedDays = resolveExcludedDaysForDeductionSegment(segment);

      workingNormals = subtractOneWeekFromWeekType(workingNormals, baseWeekDays);

      const dedRow = mapDeductionSegmentToVardiyaRow(
        segment,
        template,
        baseWeekDays,
        excludedDays,
        rowIdx,
        segIdx,
      );
      if (dedRow) deductionRows.push(dedRow);
    });

  return [...workingNormals, ...deductionRows];
}

/**
 * Ücret dönemi: düşüm haftası ilgili hafta tipinden düşülür;
 * düşüm satırı FM = (baseWeekDays − excludedDays) × 3.
 */
export function expandVardiya24RowsForDeductions(
  rows: Vardiya24ExpandRow[],
  exclusions: ExcludedDay[] | null | undefined,
  options: ExpandVardiya24RowsForDeductionsOptions,
): Vardiya24ExpandRow[] {
  if (!rows.length || !exclusions?.length) return rows;

  const manual = rows.filter((r) => r.isManual);
  const auto = rows.filter((r) => !r.isManual);
  if (!auto.length) return rows;

  const groups = new Map<string, Vardiya24ExpandRow[]>();
  auto.forEach((r) => {
    const key = periodKey(r);
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  });

  const expanded: Vardiya24ExpandRow[] = [];
  let rowIdx = 0;
  groups.forEach((groupRows) => {
    expanded.push(...expandPeriodGroup(groupRows, exclusions, options, rowIdx));
    rowIdx += 1;
  });

  expanded.sort((a, b) => {
    const c = (a.startISO || "").localeCompare(b.startISO || "");
    if (c !== 0) return c;
    const an = (a.yillikIzinAciklama || "").length > 0 ? 1 : 0;
    const bn = (b.yillikIzinAciklama || "").length > 0 ? 1 : 0;
    if (an !== bn) return an - bn;
    return (Number(b.weekTypeLabel?.split(" ")[0]) || 0) - (Number(a.weekTypeLabel?.split(" ")[0]) || 0);
  });

  return [...expanded, ...manual];
}
