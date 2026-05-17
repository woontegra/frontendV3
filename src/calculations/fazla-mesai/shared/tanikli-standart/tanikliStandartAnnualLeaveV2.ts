/**
 * Tanıklı Standart — yıllık izin V2 (davacı haftası hg; 7 günde tatilli/tatilsiz davacı seçimiyle uyumlu).
 * hg 7'den küçükse: ham haftalık saat yaklaşık (hg − izin) × günlük_net. hg = 7 tatilsiz: (7 − izin) × günlük_net.
 * hg = 7 tatilli: 6×net + fazla (net − 7,5) − izin×net (davacı FM metniyle aynı mantık). Sonra bilirkişi yuvarlama ve −45.
 *
 * Satırda `annualLeaveHg` / `annualLeaveSevenDay` varsa (Haftalık Karma, Tanıklı Standart cetveli),
 * o satır için bu değerler kullanılır; yoksa çağrıdaki `hg` ve `davaciSevenDay` uygulanır.
 */

import { addDays, differenceInCalendarDays, startOfDay, startOfWeek } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { countAnnualLeaveCalendarDaysInWindow } from "@/shared/utils/fazlaMesai/annualLeaveCalendarDays";
import type { FazlaMesaiRowBase } from "@modules/fazla-mesai/shared";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import {
  FAZLA_MESAI_DENOMINATOR,
  FAZLA_MESAI_KATSAYI,
  STANDARD_DAILY_REFERENCE_HOURS,
  WEEKLY_WORK_LIMIT,
} from "../../standart/constants";
import {
  bilirkisiRoundWeeklyTotalHours,
  collapseNormalChunksAroundDeductions,
  type AnnualLeaveWeekChunk,
} from "../../standart/annualLeaveSixDayRowSplit";
import { DAMGA_VERGISI_ORANI, GELIR_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { isStandartFmDebugEnabled, logAnnualLeaveV2Expand } from "../../standart/standartFmDebugLog";

/** FM haftalık düşümünde takvim olarak sayılan dışlama türleri. */
const FM_EXCLUSION_TYPES: string[] = ["Yıllık İzin", "UBGT", "Rapor", "Diğer"];

function dateMax(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function dateMin(a: Date, b: Date): Date {
  return a < b ? a : b;
}

/** Yerel takvim günü (UTC toISOString kayması yok — TR saat diliminde 01.01 gibi günler için). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFmDeductionCaption(
  hg: number,
  leaveDaysInt: number,
  exclusions: ExcludedDay[],
  clipStart: Date,
  clipEnd: Date,
  weeklyOffDay: number | null
): string {
  const n = Math.min(hg, Math.max(0, Math.floor(leaveDaysInt)));
  const nIzin = countAnnualLeaveCalendarDaysInWindow(clipStart, clipEnd, exclusions, weeklyOffDay, ["Yıllık İzin"]);
  const nUbgt = countAnnualLeaveCalendarDaysInWindow(clipStart, clipEnd, exclusions, weeklyOffDay, ["UBGT"]);
  const nOther = countAnnualLeaveCalendarDaysInWindow(clipStart, clipEnd, exclusions, weeklyOffDay, [
    "Rapor",
    "Diğer",
  ]);
  if (nUbgt === 0 && nOther === 0) return `(${n} gün yıllık izin düşülmüştür)`;
  if (nIzin === 0 && nOther === 0) return `(${n} gün UBGT düşülmüştür)`;
  if (nIzin === 0 && nUbgt === 0) return `(${n} gün dışlama düşülmüştür)`;
  return `(${n} gün dışlama düşülmüştür: yıllık izin / UBGT / diğer)`;
}

/**
 * Düşümlü hafta FM saati — hg ve 7 gün tatilli seçimine göre (Standart cetvel metniyle uyumlu).
 * `leaveDaysInPeriod`: pencere içindeki dışlama günü (en fazla hg).
 */
function computeV2DeductionFmHours(
  hgSafe: number,
  dailyNet: number,
  leaveDaysInPeriod: number,
  davaciSevenDay: "tatilli" | "tatilsiz",
): number {
  const cap = Math.max(1, Math.min(7, Math.floor(hgSafe)));
  const leave = Math.min(cap, Math.max(0, Math.floor(leaveDaysInPeriod)));

  if (cap >= 7) {
    if (davaciSevenDay === "tatilli") {
      const weeklyWork = dailyNet * 6;
      const extraHT = Math.max(0, dailyNet - STANDARD_DAILY_REFERENCE_HOURS);
      const rawTotal = Math.max(0, weeklyWork + extraHT - leave * dailyNet);
      return Math.max(0, bilirkisiRoundWeeklyTotalHours(rawTotal) - WEEKLY_WORK_LIMIT);
    }
    const rawTotal = Math.max(0, (7 - leave) * dailyNet);
    return Math.max(0, bilirkisiRoundWeeklyTotalHours(rawTotal) - WEEKLY_WORK_LIMIT);
  }

  const workedDays = Math.max(0, cap - leave);
  const rawTotal = dailyNet * workedDays;
  return Math.max(0, bilirkisiRoundWeeklyTotalHours(rawTotal) - WEEKLY_WORK_LIMIT);
}

function buildRowBits(
  id: string,
  startISO: string,
  endISO: string,
  weeks: number,
  brut: number,
  kats: number,
  fmHours: number,
  yillikIzinAciklama?: string,
  dailyNet?: number,
  workedDays?: number,
  totalDays?: number,
  excludedDays?: number
): FazlaMesaiRowBase {
  const fm = Number(
    (((brut * kats * weeks * fmHours) / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI).toFixed(2)
  );
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
  return {
    id,
    startISO,
    endISO,
    rangeLabel: `${startISO} – ${endISO}`,
    weeks,
    originalWeekCount: weeks,
    brut,
    katsayi: kats,
    fmHours,
    ...(dailyNet != null ? { dailyNet } : {}),
    ...(workedDays != null ? { workedDays } : {}),
    ...(totalDays != null ? { totalDays } : {}),
    ...(excludedDays != null ? { excludedDays } : {}),
    fm,
    net,
    wage: brut,
    overtimeAmount: fm,
    ...(yillikIzinAciklama ? { yillikIzinAciklama } : {}),
  } as FazlaMesaiRowBase;
}

function expandOnePeriodRow(
  row: FazlaMesaiRowBase & { dailyNet?: number },
  exclusions: ExcludedDay[],
  rowIdx: number,
  hg: number,
  weeklyOffDay: number | null,
  davaciSevenDay: "tatilli" | "tatilsiz"
): FazlaMesaiRowBase[] {
  let dailyNet = row.dailyNet;
  const startISO = row.startISO;
  const endISO = row.endISO;
  const W0 = row.weeks ?? 0;
  if (!startISO || !endISO || W0 <= 0) return [row];

  /** Dönemsel vb.: satırın kendi desenine göre takvimden çıkarılacak hafta günü; yoksa formdaki `weeklyOffDay` (Tanıklı Standart). */
  const rowWithWeekly = row as FazlaMesaiRowBase & {
    annualLeaveWeeklyIgnoredWeekday?: number | null;
  };
  const effectiveWeeklyOff =
    "annualLeaveWeeklyIgnoredWeekday" in rowWithWeekly
      ? rowWithWeekly.annualLeaveWeeklyIgnoredWeekday ?? null
      : weeklyOffDay;

  const segStartRaw = new Date(startISO);
  const segEndRaw = new Date(endISO);
  if (Number.isNaN(+segStartRaw) || Number.isNaN(+segEndRaw)) return [row];
  // ISO tarih stringleri UTC gece yarısı parse edilir; hafta sınırları yerel 00:00. startOfDay ile
  // aynı takvim gününde clipStart > clipEnd oluşması engellenir (ör. 01.01 Pazar UBGT atlanması).
  const segStart = startOfDay(segStartRaw);
  const segEnd = startOfDay(segEndRaw);
  if (segEnd < segStart) return [row];

  const kats = row.katsayi ?? 1;
  const baselineFm = row.fmHours ?? 0;
  const brutPeriod = row.brut ?? getAsgariUcretByDate(startISO) ?? 0;
  const brutPeriodManual = (row as { brutManual?: boolean }).brutManual === true;
  const hgFromCaller = Math.max(1, Math.min(7, Math.floor(Number(hg)) || 6));
  const rowHgRaw = (row as { annualLeaveHg?: number }).annualLeaveHg;
  const hgSafe =
    rowHgRaw != null && Number.isFinite(rowHgRaw)
      ? Math.max(1, Math.min(7, Math.floor(Number(rowHgRaw))))
      : hgFromCaller;
  if (dailyNet == null || !Number.isFinite(dailyNet) || dailyNet <= 0) {
    // Güvenli fallback: günlük net verilmemişse haftalık FM bilgisinden türet.
    const weeklyFm = Math.max(0, Number(row.fmHours) || 0);
    dailyNet = (weeklyFm + WEEKLY_WORK_LIMIT) / hgSafe;
  }
  if (!Number.isFinite(dailyNet) || dailyNet <= 0) return [row];

  const scopedExclusions: ExcludedDay[] = [];
  for (const ex of exclusions) {
    if (!FM_EXCLUSION_TYPES.includes(ex.type ?? "")) continue;
    const exStartRaw = startOfDay(new Date(ex.start));
    const exEndRaw = startOfDay(new Date(ex.end));
    if (Number.isNaN(+exStartRaw) || Number.isNaN(+exEndRaw) || exStartRaw > exEndRaw) continue;
    const clippedStart = dateMax(segStart, exStartRaw);
    const clippedEnd = dateMin(segEnd, exEndRaw);
    if (clippedStart > clippedEnd) continue;
    /** Paneldeki "Gün" alanı: >0 ise sadece bu kadar çalışma günü dışlanır; 0 ise eski davranış (tüm aralık). */
    const explicitDayCap =
      Number(ex.days) > 0 && Number.isFinite(Number(ex.days)) ? Math.floor(Number(ex.days)) : null;
    let usedFromCap = 0;
    let cur = new Date(clippedStart);
    while (cur <= clippedEnd) {
      if (explicitDayCap != null && usedFromCap >= explicitDayCap) break;
      if (effectiveWeeklyOff == null || cur.getDay() !== effectiveWeeklyOff) {
        const day = toISODate(cur);
        scopedExclusions.push({
          id: `${ex.id || "ex"}-${day}`,
          type: ex.type || "Diğer",
          start: day,
          end: day,
          days: 1,
        });
        if (explicitDayCap != null) usedFromCap += 1;
      }
      cur = addDays(cur, 1);
    }
  }

  const countSource = scopedExclusions.length > 0 ? scopedExclusions : exclusions;
  const chunks: AnnualLeaveWeekChunk[] = [];
  let weekMon = startOfWeek(segStart, { weekStartsOn: 1 });
  const lastMon = startOfWeek(segEnd, { weekStartsOn: 1 });

  while (weekMon <= lastMon) {
    const weekSun = addDays(weekMon, 6);
    const clipStart = dateMax(segStart, weekMon);
    const clipEnd = dateMin(segEnd, weekSun);
    if (clipStart <= clipEnd) {
      const clipStartISO = toISODate(clipStart);
      const clipEndISO = toISODate(clipEnd);
      const leaveDaysInt = Math.min(
        hgSafe,
        countAnnualLeaveCalendarDaysInWindow(
          clipStart,
          clipEnd,
          countSource,
          effectiveWeeklyOff,
          FM_EXCLUSION_TYPES,
        ),
      );
      const clipCalendarDays = differenceInCalendarDays(clipEnd, clipStart) + 1;
      const brutW = getAsgariUcretByDate(clipStartISO) || brutPeriod;
      const affected = leaveDaysInt >= 1;

      if (affected) {
        const fmHours = computeV2DeductionFmHours(hgSafe, dailyNet, leaveDaysInt, davaciSevenDay);
        chunks.push({
          startISO: clipStartISO,
          endISO: clipEndISO,
          weeks: 1,
          brut: brutW,
          fmHours,
          yillikIzinAciklama: formatFmDeductionCaption(
            hgSafe,
            leaveDaysInt,
            exclusions,
            clipStart,
            clipEnd,
            effectiveWeeklyOff,
          ),
          workedDays: Math.max(0, Math.min(hgSafe, clipCalendarDays) - leaveDaysInt),
          totalDays: Math.min(hgSafe, clipCalendarDays),
          excludedDays: leaveDaysInt,
        });
      } else {
        chunks.push({
          startISO: clipStartISO,
          endISO: clipEndISO,
          weeks: 1,
          brut: brutW,
          fmHours: baselineFm,
        });
      }
    }
    weekMon = addDays(weekMon, 7);
  }

  const deductionWeeks = chunks.filter((c) => c.yillikIzinAciklama).length;
  if (deductionWeeks === 0) return [row];

  const merged = collapseNormalChunksAroundDeductions(chunks, W0);

  const out = merged.map((c, j) => {
    const weeks = c.weeks;
    const rowBits = buildRowBits(
      c.yillikIzinAciklama
        ? `auto-yl2-${rowIdx}-${j}-${c.startISO}`
        : `auto-yl2-base-${rowIdx}-${c.startISO}`,
      c.startISO,
      c.endISO,
      weeks,
      c.brut,
      kats,
      c.fmHours,
      c.yillikIzinAciklama,
      dailyNet,
      c.workedDays,
      c.totalDays,
      c.excludedDays,
    );
    return {
      ...rowBits,
      ...(brutPeriodManual ? { brutManual: true } : {}),
    } as FazlaMesaiRowBase;
  });

  if (out.length === 0) return [];

  if (isStandartFmDebugEnabled()) {
    const baseChunk = merged.find((c) => !c.yillikIzinAciklama);
    logAnnualLeaveV2Expand({
      rowIndex: rowIdx,
      startISO,
      endISO,
      hgSafe,
      davaciSevenDay,
      W0,
      dailyNet,
      baselineFm,
      excludedBlocks: deductionWeeks,
      weeklyClipDeductionWeeks: deductionWeeks,
      excludedWeekCount: deductionWeeks,
      baseWeeks: baseChunk?.weeks ?? 0,
      scopedExclusionDays: scopedExclusions.length,
      leaveRowCount: merged.filter((c) => c.yillikIzinAciklama).length,
      leaveRows: merged
        .filter((c) => c.yillikIzinAciklama)
        .map((c) => ({
          aralik: `${c.startISO} – ${c.endISO}`,
          weeks: c.weeks,
          fmHours: c.fmHours,
          workedDays: c.workedDays,
          excludedDays: c.excludedDays,
          aciklama: c.yillikIzinAciklama,
        })),
    });
  }

  return out;
}

/**
 * Tanık satırlarında dailyNet varken yıllık izin V2 uygular; hg = haftalık çalışma günü (form).
 */
export function expandTanikliStandartRowsAnnualLeaveV2(
  rows: Array<FazlaMesaiRowBase & { dailyNet?: number }>,
  exclusions: ExcludedDay[] | null | undefined,
  hg: number,
  weeklyOffDay: number | null,
  davaciSevenDay: "tatilli" | "tatilsiz"
): FazlaMesaiRowBase[] {
  if (!exclusions?.length) return rows as FazlaMesaiRowBase[];

  const out: FazlaMesaiRowBase[] = [];
  rows.forEach((row, i) => {
    if (row.dailyNet != null) {
      const expanded = expandOnePeriodRow(row, exclusions, i, hg, weeklyOffDay, davaciSevenDay);
      if (expanded.length) out.push(...expanded);
      else out.push(row);
    } else {
      out.push(row);
    }
  });
  return out;
}
