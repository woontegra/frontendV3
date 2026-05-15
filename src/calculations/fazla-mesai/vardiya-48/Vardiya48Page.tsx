/**
 * 48 saat (24/48) vardiya fazla mesai — calculate48System; tanık yoksa tüm davacı dönemi tek aralıkta hesaplanır.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { startOfDay } from "date-fns";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { yukleHesap } from "@/core/kaydet/kaydetServisi";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi, calculateWeeksBetweenDates, isoToTR } from "@/utils/dateUtils";
import {
  buildWordTable,
  adaptToWordTable,
  clampToLastDayOfMonth,
  copySectionForWord,
  getAsgariUcretByDate,
  buildMergedWitnessSegments,
  type FazlaMesaiRowBase,
} from "@modules/fazla-mesai/shared";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { ZamanasimiModal } from "../standart/ZamanasimiModal";
import { ZamanasimiCetvelBanner } from "../standart/ZamanasimiCetvelBanner";
import { KatsayiModal } from "../standart/KatsayiModal";
import { MahsuplasamaModal } from "../standart/MahsuplasamaModal";
import { NotlarAccordion } from "../standart/NotlarAccordion";
import { Copy, Plus, Trash2 } from "lucide-react";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { buildStyledReportTable } from "@/utils/styledReportTable";
import { useTanikliStandartState } from "../tanikli-standart/state";
import { fmt, fmtCurrency } from "../standart/calculations";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";
import { calculate48System } from "../../../utils/fazlaMesai/vardiya24/calculate48System";
import { isV48TransitionMotorNote } from "../../../utils/fazlaMesai/vardiya24/vardiya48TransitionNotes";
import {
  applyResolvedManualBrutToRows,
  clearAllManualBrutFromRowOverrides,
  mergeManualWageBrutsIntoRowOverrides,
  reduceRowOverridesWithManualBrut,
} from "@/shared/utils/fazlaMesai/fmManualWageRowOverrides";
import { ManualBrutWageApplyControls } from "@/features/manual-brut-wage/ManualBrutWageApplyControls";
import styles from "../standart/StandartFazlaMesaiPage.module.css";

const RECORD_TYPE = "fazla_mesai_vardiya_48";
const PAGE_TITLE = "48 Saat Çalışma Hesaplama";
const REDIRECT_BASE_PATH = "/fazla-mesai/vardiya-48";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const tableInputCls =
  "w-full min-w-0 px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

export type VardiyaRow = {
  id?: string;
  isManual?: boolean;
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  calc225?: number;
  factor?: number;
  fm: number;
  net: number;
  startISO: string;
  endISO: string;
  yillikIzinAciklama?: string;
  weekTypeLabel?: string;
};

function genVardiyaRowId(): string {
  return `vrd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function recalcVardiyaRow48(row: VardiyaRow): Pick<VardiyaRow, "fm" | "net"> {
  const calc225 = row.calc225 ?? 225;
  const factor = row.factor ?? 1.5;
  const step1 = Number((row.weeks * row.brut).toFixed(6));
  const step2 = Number((step1 * row.katsayi).toFixed(6));
  const step3 = Number((step2 * row.fmHours).toFixed(6));
  const step4 = Number((step3 / calc225).toFixed(6));
  const step5 = Number((step4 * factor).toFixed(6));
  const fm = Number(step5.toFixed(2));
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - 0.15)).toFixed(2));
  return { fm, net };
}

function normalizeDateInput(iso: string): string {
  if (!iso) return "";
  const s = String(iso).trim();
  if (s.includes(".")) {
    const [g, a, y] = s.split(".");
    if (!y || !a || !g) return s;
    return `${y}-${String(a).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
  }
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function formatDateTR(iso: string | undefined): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

function buildWitnessSegments(
  dStart: string,
  dEnd: string,
  taniklar: Array<{ dateIn: string; dateOut: string }>
): Array<{ start: string; end: string }> {
  const parseLocalDayToMs = (raw: string): number => {
    const s = String(raw || "").trim();
    if (!s) return Number.NaN;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return Date.UTC(y || 0, (m || 1) - 1, d || 1);
    }
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
      const [d, m, y] = s.split(".").map(Number);
      return Date.UTC(y || 0, (m || 1) - 1, d || 1);
    }
    const n = new Date(s).getTime();
    return Number.isNaN(n) ? Number.NaN : n;
  };

  const dStartMs = parseLocalDayToMs(normalizeDateInput(dStart));
  const dEndMs = parseLocalDayToMs(normalizeDateInput(dEnd));
  if (Number.isNaN(dStartMs) || Number.isNaN(dEndMs) || dStartMs > dEndMs) return [];

  const witnesses = taniklar
    .filter((t) => t.dateIn && t.dateOut)
    .map((t, idx) => ({
      startMs: parseLocalDayToMs(normalizeDateInput(t.dateIn)),
      endMs: parseLocalDayToMs(normalizeDateInput(t.dateOut)),
      // Ortak segmentleyici bitişik parçaları fmHours'a göre birleştirir;
      // bu yüzden tanık önceliği değişimlerini korumak için ayırt edici değer veriyoruz.
      fmHours: idx + 1,
    }))
    .filter((w) => !Number.isNaN(w.startMs) && !Number.isNaN(w.endMs) && w.startMs <= w.endMs);

  if (witnesses.length === 0) return [];

  return buildMergedWitnessSegments(dStart, dEnd, witnesses).map((seg) => ({
    start: seg.start,
    end: seg.end,
  }));
}

function vardiya24_48DebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const u = new URL(window.location.href);
    const q = u.searchParams.get("vardiyaDebug") ?? u.searchParams.get("debug48");
    if (q === "1" || String(q || "").toLowerCase() === "true") return true;
  } catch {
    /* ignore */
  }
  const w = window as unknown as { __VARDIYA_DEBUG__?: unknown };
  const v = w.__VARDIYA_DEBUG__;
  return (
    v === true ||
    v === 1 ||
    v === "1" ||
    (typeof v === "string" && ["true", "yes", "on"].includes(v.trim().toLowerCase()))
  );
}

function logVardiyaDebug(label: string, payload: unknown) {
  // Gürültüyü azaltmak için genel debug kapalı.
  // Açmak: URL ?vardiyaDebug=1 veya konsolda window.__VARDIYA_DEBUG__ = true
  if (!vardiya24_48DebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(`[Vardiya24/48][DEBUG] ${label}`, payload);
}

function logDebugLines(label: string, lines: string[]) {
  if (!vardiya24_48DebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(`[Vardiya24/48][DEBUG] ${label} (count=${lines.length})`);
  lines.forEach((line, idx) => {
    // eslint-disable-next-line no-console
    console.info(`[Vardiya24/48][DEBUG] ${label}[${idx}] ${line}`);
  });
}

function summarizeCalcRows(
  rows: Array<{ startDate: string; endDate: string; weekType: string | number; weekCount: number; weeklyFmHours: number; note?: string }>
) {
  return rows.map((r) => ({
    start: (r.startDate || "").slice(0, 10),
    end: (r.endDate || "").slice(0, 10),
    type: String(r.weekType),
    weeks: Number(r.weekCount) || 0,
    fmH: Number(r.weeklyFmHours) || 0,
    note: String(r.note || ""),
  }));
}

function summarizeUiRows(rows: VardiyaRow[]) {
  return rows.map((r) => ({
    start: (r.startISO || "").slice(0, 10),
    end: (r.endISO || "").slice(0, 10),
    type: String(r.weekTypeLabel || ""),
    weeks: Number(r.weeks) || 0,
    fmH: Number(r.fmHours) || 0,
    fm: Number(r.fm) || 0,
    note: String(r.yillikIzinAciklama || ""),
  }));
}

function formatCalcRowsForLog(
  rows: Array<{ startDate: string; endDate: string; weekType: string | number; weekCount: number; weeklyFmHours: number; note?: string }>
): string[] {
  return summarizeCalcRows(rows).map(
    (r) =>
      `start=${r.start} end=${r.end} type=${r.type} weeks=${r.weeks} fmH=${r.fmH} note=${r.note || "-"}`
  );
}

function formatUiRowsForLog(rows: VardiyaRow[]): string[] {
  return summarizeUiRows(rows).map(
    (r) =>
      `start=${r.start} end=${r.end} type=${r.type} weeks=${r.weeks} fmH=${r.fmH} fm=${r.fm} note=${r.note || "-"}`
  );
}

/**
 * Bilirkişi kuralı:
 * Aynı dönemde 3+3+1 gibi tek kalan 1 haftayı ayrı satır bırakma;
 * fazla FM saatli bloğa ekleyip 4+3 yap.
 */
function rebalanceSingletonWeekRows(rows: VardiyaRow[]): VardiyaRow[] {
  const autoRows = rows.filter((r) => !r.isManual);
  if (autoRows.length <= 2) return rows;

  const toDrop = new Set<string>();
  const patched = new Map<string, VardiyaRow>();

  // Dinamik kural: 1 haftalık otomatik ve notsuz satırı,
  // aynı ücret parametrelerindeki en yüksek FM saatli bloğa taşı.
  autoRows.forEach((singleton) => {
    if (Math.round(Number(singleton.weeks) || 0) !== 1) return;
    if ((singleton.yillikIzinAciklama || "").trim().length > 0) return;

    const targets = autoRows.filter((r) => {
      if ((r.id || "") === (singleton.id || "")) return false;
      if (toDrop.has(r.id || "")) return false;
      if ((r.yillikIzinAciklama || "").trim().length > 0) return false;
      // Kritik güvenlik: 1 haftalık satır başka tarih aralığına taşınamaz.
      // Aksi halde tanık kesişiminden çıkan kısa dönem satırları (örn. 01.01–14.01)
      // hatalı şekilde sonraki döneme emilir.
      if ((r.startISO || "").slice(0, 10) !== (singleton.startISO || "").slice(0, 10)) return false;
      if ((r.endISO || "").slice(0, 10) !== (singleton.endISO || "").slice(0, 10)) return false;
      if ((Number(r.brut) || 0) !== (Number(singleton.brut) || 0)) return false;
      if ((Number(r.katsayi) || 0) !== (Number(singleton.katsayi) || 0)) return false;
      if ((Number(r.calc225 ?? 225) || 0) !== (Number(singleton.calc225 ?? 225) || 0)) return false;
      if ((Number(r.factor ?? 1.5) || 0) !== (Number(singleton.factor ?? 1.5) || 0)) return false;
      return (Number(r.weeks) || 0) >= 1;
    });
    if (!targets.length) return;

    let best = targets[0];
    targets.forEach((r) => {
      const fmH = Number(r.fmHours) || 0;
      const bestFmH = Number(best.fmHours) || 0;
      if (fmH > bestFmH) best = r;
    });

    const base = patched.get(best.id || "") || best;
    const next: VardiyaRow = { ...base, weeks: (Number(base.weeks) || 0) + 1 };
    const recalced = recalcVardiyaRow48(next);
    patched.set(best.id || "", { ...next, ...recalced });
    toDrop.add(singleton.id || "");
  });

  if (toDrop.size === 0 && patched.size === 0) return rows;
  return rows.filter((r) => !toDrop.has(r.id || "")).map((r) => patched.get(r.id || "") || r);
}

function anchorForSegment(globalStart: string, segmentStart: string, baseAnchorIsWorkDay: boolean): boolean {
  const gs = new Date(globalStart);
  const ss = new Date(segmentStart);
  if (Number.isNaN(+gs) || Number.isNaN(+ss)) return baseAnchorIsWorkDay;
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((startOfDay(ss).getTime() - startOfDay(gs).getTime()) / dayMs);
  if (diffDays <= 0) return baseAnchorIsWorkDay;
  // 24/24 desende her gün faz değişir; segment başlangıcında global fazı koru.
  return diffDays % 2 === 0 ? baseAnchorIsWorkDay : !baseAnchorIsWorkDay;
}

export default function Vardiya48Page() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  const {
    formValues,
    setFormValues,
    exclusions,
    setExclusions,
    currentRecordName,
    setCurrentRecordName,
    addWitness,
    removeWitness,
    updateWitness,
    rowOverrides,
    setRowOverrides,
  } = useTanikliStandartState();

  const [rows, setRows] = useState<VardiyaRow[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [localIseGiris, setLocalIseGiris] = useState("");
  const [localIstenCikis, setLocalIstenCikis] = useState("");
  const [anchorIsWorkDay, setAnchorIsWorkDay] = useState(true);
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const { iseGiris, istenCikis, taniklar, katSayi, mahsuplasmaMiktari } = formValues;
  const zamanasimiBaslangic = formValues.zamanasimi?.nihaiBaslangic || null;

  const exclusionsFor48 = useMemo(
    () =>
      Array.isArray(exclusions)
        ? (exclusions as ExcludedDay[]).filter((e) => {
            const t = String(e.type || "").trim();
            return t !== "UBGT" && t !== "Yıllık İzin";
          })
        : [],
    [exclusions],
  );

  const pageTitle = PAGE_TITLE;
  const recordType = RECORD_TYPE;
  const redirectBase = REDIRECT_BASE_PATH;
  const videoLink = getVideoLink("fazla-vardiya48");

  const bilirkisiDefaultText = [
    "24/48 (48 saat dinlenmeli) — bilirkişi özeti:",
    "• Günlük 11 saatlik üst sınır; vardiyada fiilen kabul edilen çalışma 14 saat → vardiya başına 3 saat FM.",
    "• Her 7 günlük blokta (faz / işe girişe göre) vardiya çalışma günü × 3 saat = blok FM;",
    "  tipik olarak blok başına 2 veya 3 vardiya günü → 6 veya 9 saat.",
    `• 24/48 vardiya fazı işe girişe göre; ilk gün: ${anchorIsWorkDay ? "çalıştı" : "dinlendi"}.`,
    "• Üç günlük vardiya ritmi: bir vardiya çalışma günü, ardından iki tam dinlence günü.",
    "• Geçerli tanık tarih aralığı yoksa hesaplama davacı işe giriş–çıkış dönemi üzerinden yapılır.",
  ].join("\n");

  useEffect(() => {
    setLocalIseGiris(iseGiris || "");
    setLocalIstenCikis(istenCikis || "");
  }, [iseGiris, istenCikis]);

  useEffect(
    () => () => {
      if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
    },
    []
  );

  useEffect(() => {
    if (!effectiveId) return;
    let mounted = true;
    yukleHesap(effectiveId, RECORD_TYPE)
      .then((res) => {
        if (!mounted) return;
        if (!res.success) {
          showToastError(res.error || "Kayıt yüklenemedi");
          return;
        }
        if (!res.data) return;
        const raw = res.data.form || res.data.formValues || res.data;
        const inner = raw?.data?.form || raw;
        setFormValues((p) => ({
          ...p,
          ...(inner.iseGiris != null && { iseGiris: inner.iseGiris }),
          ...(inner.istenCikis != null && { istenCikis: inner.istenCikis }),
          ...(inner.weeklyDays != null && { weeklyDays: String(inner.weeklyDays) }),
          ...(inner.davaci && { davaci: { ...p.davaci, ...inner.davaci } }),
          ...(Array.isArray(inner.taniklar) && { taniklar: inner.taniklar }),
          ...(inner.katSayi != null && { katSayi: inner.katSayi }),
          ...(inner.mahsuplasmaMiktari != null && { mahsuplasmaMiktari: inner.mahsuplasmaMiktari }),
          ...(Array.isArray(inner.exclusions) && { exclusions: inner.exclusions }),
          ...(inner.zamanasimi != null && { zamanasimi: inner.zamanasimi }),
        }));
        const ro = raw.rowOverrides ?? inner.rowOverrides;
        if (ro && typeof ro === "object") setRowOverrides(ro);
        const loadedRows = inner.rows ?? raw.rows;
        if (Array.isArray(loadedRows) && loadedRows.length > 0) {
          setRows(
            loadedRows.map((r: VardiyaRow) => ({
              ...r,
              id: r.id ?? genVardiyaRowId(),
            }))
          );
        }
        if (typeof inner.anchorIsWorkDay === "boolean") setAnchorIsWorkDay(inner.anchorIsWorkDay);
        if (res.name) setCurrentRecordName(res.name);
        success("Kayıt yüklendi");
      })
      .catch((err) => {
        if (mounted) showToastError(err.message || "Kayıt yüklenemedi");
      });
    return () => {
      mounted = false;
    };
  }, [effectiveId, setFormValues, setCurrentRecordName, setRowOverrides, success, showToastError]);

  const debouncedSetDate = useCallback(
    (field: "iseGiris" | "istenCikis", value: string) => {
      if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
      dateDebounceRef.current = setTimeout(() => {
        setFormValues((p) => ({
          ...p,
          [field]: value,
          davaci: {
            ...p.davaci,
            dateIn: field === "iseGiris" ? value : p.davaci.dateIn,
            dateOut: field === "istenCikis" ? value : p.davaci.dateOut,
          },
        }));
        dateDebounceRef.current = null;
      }, 350);
    },
    [setFormValues]
  );

  const diff = useMemo(() => calcWorkPeriodBilirKisi(iseGiris, istenCikis), [iseGiris, istenCikis]);

  const handleFormChange = useCallback(
    (updates: Partial<typeof formValues>) => {
      setFormValues((p) => {
        const next = { ...p, ...updates };
        if (updates.davaci) next.davaci = { ...p.davaci, ...updates.davaci };
        return next;
      });
    },
    [setFormValues]
  );

  const handleZamanasimiIptal = useCallback(() => {
    setFormValues((p) => ({ ...p, zamanasimi: null }));
    success("Zamanaşımı kaldırıldı.");
  }, [success, setFormValues]);

  const runBackend = useCallback(async () => {
    const dStart = normalizeDateInput(iseGiris);
    const dEnd = normalizeDateInput(istenCikis);
    if (!dStart || !dEnd) {
      setRows([]);
      return;
    }
    const rid = ++reqIdRef.current;
    setIsCalculating(true);
    try {
      logVardiyaDebug("input.48", {
        dStart,
        dEnd,
        taniklar: taniklar.map((t, i) => ({
          idx: i,
          dateIn: t.dateIn,
          dateOut: t.dateOut,
          in: t.in,
          out: t.out,
        })),
      });
      let witnessIntervals48 = buildWitnessSegments(dStart, dEnd, taniklar);
      logVardiyaDebug("witnessSegments.48", witnessIntervals48);
      logDebugLines(
        "witnessSegments.48.lines",
        witnessIntervals48.map((s) => `start=${s.start} end=${s.end}`),
      );
      if (witnessIntervals48.length === 0) {
        witnessIntervals48 = [{ start: dStart, end: dEnd }];
      }
      const zNorm48 = zamanasimiBaslangic ? normalizeDateInput(zamanasimiBaslangic) : null;
      const summaryRows48 = witnessIntervals48.flatMap((seg) => {
        const segAnchor = anchorForSegment(dStart, seg.start, anchorIsWorkDay);
        return calculate48System({
          witnessSegments: [{ start: seg.start, end: seg.end }],
          anchorStartDate: dStart,
          weekBucketAnchorDate: dStart,
          anchorIsWorkDay: segAnchor,
          exclusions: exclusionsFor48 as ExcludedDay[],
          zNorm: zNorm48,
          davaStart: seg.start,
          davaEnd: seg.end,
        });
      });
      logVardiyaDebug("summaryRowsRaw.48", summaryRows48);
      logVardiyaDebug("summaryRowsRaw.48.compact", summarizeCalcRows(summaryRows48));
      logDebugLines("summaryRowsRaw.48.lines", formatCalcRowsForLog(summaryRows48));
      setRows((prev) => {
        const prevApi = prev.filter((r) => !r.isManual);
        const manualRows = prev.filter((r) => r.isManual);
        const visibleRows48 = summaryRows48.filter((w) => {
          if ((Number(w.weekCount) || 0) <= 0) return false;
          const wt = Number(w.weekType) || 0;
          const fmH = Number(w.weeklyFmHours) || 0;
          return !(wt === 0 && fmH === 0);
        });
        const apiRowsRaw: VardiyaRow[] = visibleRows48.map((w, idx) => {
          const row: VardiyaRow = {
            id: prevApi[idx]?.id ?? genVardiyaRowId(),
            isManual: false,
            rangeLabel: `${formatDateTR(w.startDate)}–${formatDateTR(w.endDate)}`,
            weeks: w.weekCount,
            brut: getAsgariUcretByDate(w.startDate) || 0,
            katsayi: katSayi || 1,
            fmHours: w.weeklyFmHours,
            calc225: 225,
            factor: 1.5,
            fm: 0,
            net: 0,
            startISO: w.startDate,
            endISO: w.endDate,
            weekTypeLabel: `${w.weekType} gün`,
            yillikIzinAciklama: w.note,
          };
          const { fm, net } = recalcVardiyaRow48(row);
          return { ...row, fm, net };
        });
        let apiRows = rebalanceSingletonWeekRows(apiRowsRaw);
        let nextRows = apiRows.map((r) => ({ ...r, weeks: Math.max(0, Math.round(Number(r.weeks) || 0)) }));
        const byPeriod = new Map<string, number[]>();
        nextRows.forEach((r, idx) => {
          const key = `${(r.startISO || "").slice(0, 10)}|${(r.endISO || "").slice(0, 10)}`;
          const arr = byPeriod.get(key) || [];
          arr.push(idx);
          byPeriod.set(key, arr);
        });

        byPeriod.forEach((idxs, key) => {
          const [ps, pe] = key.split("|");
          if (!ps || !pe) return;

          const transitionRowsInWindow = nextRows.filter((r) => {
            const note = String(r.yillikIzinAciklama || "");
            if (!isV48TransitionMotorNote(note)) return false;
            const rs = (r.startISO || "").slice(0, 10);
            const re = (r.endISO || "").slice(0, 10);
            return rs >= ps && re <= pe;
          });
          if (transitionRowsInWindow.length > 0) return;

          const expectedRoundedWeeks = Math.max(0, Math.round(calculateWeeksBetweenDates(ps, pe)));
          const currentWeeks = idxs.reduce((acc, i) => acc + Math.max(0, Math.round(Number(nextRows[i].weeks) || 0)), 0);
          let deltaWeeks = expectedRoundedWeeks - currentWeeks;
          if (deltaWeeks === 0) return;
          if (exclusionsFor48.length > 0 && deltaWeeks > 0) return;

          while (deltaWeeks > 0) {
            let targetIdx = idxs[0];
            for (let k = 1; k < idxs.length; k += 1) {
              const i = idxs[k];
              const w = Number(nextRows[i].weeks) || 0;
              const t = Number(nextRows[targetIdx].weeks) || 0;
              if (w < t) targetIdx = i;
            }
            nextRows[targetIdx] = { ...nextRows[targetIdx], weeks: (Number(nextRows[targetIdx].weeks) || 0) + 1 };
            deltaWeeks -= 1;
          }

          while (deltaWeeks < 0) {
            let targetIdx = -1;
            for (let k = 0; k < idxs.length; k += 1) {
              const i = idxs[k];
              const w = Number(nextRows[i].weeks) || 0;
              if (w <= 0) continue;
              if (targetIdx < 0 || w > (Number(nextRows[targetIdx].weeks) || 0)) targetIdx = i;
            }
            if (targetIdx < 0) break;
            nextRows[targetIdx] = { ...nextRows[targetIdx], weeks: Math.max(0, (Number(nextRows[targetIdx].weeks) || 0) - 1) };
            deltaWeeks += 1;
          }
        });

        apiRows = nextRows.map((r) => {
          const { fm, net } = recalcVardiyaRow48(r);
          return { ...r, fm, net };
        });
        logVardiyaDebug("apiRows.final.48", apiRows);
        logVardiyaDebug("apiRows.final.48.compact", summarizeUiRows(apiRows));
        logDebugLines("apiRows.final.48.lines", formatUiRowsForLog(apiRows));
        return [...apiRows, ...manualRows];
      });
    } catch (e) {
      if (rid === reqIdRef.current) {
        setRows([]);
        console.error("[Vardiya48]", e);
      }
    } finally {
      if (rid === reqIdRef.current) setIsCalculating(false);
    }
  }, [iseGiris, istenCikis, taniklar, anchorIsWorkDay, exclusionsFor48, katSayi, zamanasimiBaslangic]);

  useEffect(() => {
    const t = setTimeout(() => {
      void runBackend();
    }, 400);
    return () => clearTimeout(t);
  }, [runBackend]);

  const mergedCetvelRows = useMemo(() => {
    return applyResolvedManualBrutToRows(rows as FazlaMesaiRowBase[], rowOverrides).map((base) => {
      const r = base as VardiyaRow;
      const { fm, net } = recalcVardiyaRow48(r);
      return { ...r, fm, net };
    }) as VardiyaRow[];
  }, [rows, rowOverrides]);

  const totalBrut = useMemo(() => mergedCetvelRows.reduce((a, r) => a + (r.fm || 0), 0), [mergedCetvelRows]);

  const tableDisplayRows = useMemo(
    () =>
      mergedCetvelRows.filter((r) => {
        if (r.isManual) return true;
        const fmH = Number(r.fmHours) || 0;
        const w = Number(r.weeks) || 0;
        const fmAmt = Number(r.fm) || 0;
        return fmH !== 0 && w !== 0 && fmAmt !== 0;
      }),
    [mergedCetvelRows],
  );

  const manualBrutActive = useMemo(
    () => Object.values(rowOverrides).some((o) => (o as { brutManual?: boolean }).brutManual),
    [rowOverrides],
  );

  const handleDeactivateManualBrut = useCallback(() => {
    setRowOverrides((prev) => clearAllManualBrutFromRowOverrides(prev));
    success("Manuel brüt ücret kuralı kapatıldı.");
  }, [setRowOverrides, success]);

  const handleApplyManualWageBruts = useCallback(
    (brutById: Record<string, number>) => {
      setRowOverrides((prev) => mergeManualWageBrutsIntoRowOverrides(prev, brutById, rows as FazlaMesaiRowBase[]));
      success("Manuel brüt ücretler uygulandı.");
    },
    [rows, setRowOverrides, success],
  );

  const exitYear = istenCikis ? new Date(istenCikis).getFullYear() : new Date().getFullYear();
  const brutNetResult = useMemo(() => {
    if (totalBrut <= 0) return { gelirVergisi: 0, damgaVergisi: 0, netYillik: 0, gelirVergisiDilimleri: "" };
    const sgk = Math.round(totalBrut * SSK_ORAN * 100) / 100;
    const issizlik = Math.round(totalBrut * ISSIZLIK_ORAN * 100) / 100;
    const matrah = Math.max(0, totalBrut - sgk - issizlik);
    const gvResult = calculateIncomeTaxWithBrackets(exitYear, matrah);
    const gelirVergisi = Math.round(gvResult.tax * 100) / 100;
    const damgaVergisi = Math.round(totalBrut * DAMGA_VERGISI_ORANI * 100) / 100;
    const netYillik = Math.round((totalBrut - sgk - issizlik - gelirVergisi - damgaVergisi) * 100) / 100;
    return {
      gelirVergisi,
      damgaVergisi,
      netYillik,
      gelirVergisiDilimleri: gvResult.brackets,
    };
  }, [totalBrut, exitYear]);

  const mahsupNum = useMemo(() => {
    const s = String(mahsuplasmaMiktari || "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }, [mahsuplasmaMiktari]);

  const hakkaniyetIndirimi = totalBrut / 3;
  const sonNet = Math.max(0, totalBrut - hakkaniyetIndirimi - mahsupNum);
  const hasCustomKatsayi = (katSayi ?? 1) !== 1 && (katSayi ?? 1) > 0;

  const handleSave = useCallback(() => {
    kaydetAc({
      hesapTuru: recordType,
      veri: {
        data: {
          form: {
            ...formValues,
            vardiyaMode: "48",
            anchorIsWorkDay,
            rows,
            pageType: "vardiya-48",
            route: redirectBase,
          },
          results: { rows: tableDisplayRows, totalBrut, totalNet: brutNetResult.netYillik },
        },
        formValues: { ...formValues, vardiyaMode: "48", anchorIsWorkDay, rows },
        totals: { toplam: totalBrut, yil: diff.years, ay: diff.months, gun: diff.days },
        brut_total: totalBrut,
        net_total: brutNetResult.netYillik,
        exclusions,
        mode270: "none",
        katSayi,
        mahsuplasmaMiktari,
        rowOverrides,
      },
      mevcutId: effectiveId || undefined,
      mevcutKayitAdi: currentRecordName || undefined,
      redirectPath: `${redirectBase}/:id`,
    });
  }, [
    kaydetAc,
    recordType,
    formValues,
    anchorIsWorkDay,
    rows,
    tableDisplayRows,
    totalBrut,
    brutNetResult.netYillik,
    diff,
    exclusions,
    katSayi,
    mahsuplasmaMiktari,
    rowOverrides,
    currentRecordName,
    effectiveId,
    redirectBase,
  ]);

  const handleNew = useCallback(() => {
    if (effectiveId) navigate(redirectBase);
  }, [effectiveId, navigate, redirectBase]);

  const applyRowPatch = useCallback(
    (rowId: string, patch: Partial<VardiyaRow>) => {
      if (patch.brut !== undefined) {
        const v = parseFloat(String(patch.brut).replace(",", "."));
        setRowOverrides((prev) =>
          reduceRowOverridesWithManualBrut(prev, rowId, { brut: Number.isNaN(v) ? 0 : Math.max(0, v) } as Partial<FazlaMesaiRowBase>),
        );
        return;
      }
      if (patch.startISO !== undefined || patch.endISO !== undefined) {
        setRowOverrides((prev) =>
          reduceRowOverridesWithManualBrut(prev, rowId, {
            startISO: patch.startISO,
            endISO: patch.endISO,
          } as Partial<FazlaMesaiRowBase>),
        );
      }
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const next: VardiyaRow = { ...r, ...patch };
          const s = (next.startISO || "").slice(0, 10);
          const e = (next.endISO || "").slice(0, 10);
          if ((patch.startISO != null || patch.endISO != null) && s.length >= 10 && e.length >= 10) {
            next.weeks = Math.max(1, calculateWeeksBetweenDates(s, e) || 1);
            next.rangeLabel = `${formatDateTR(s)}–${formatDateTR(e)}`;
            next.brut = getAsgariUcretByDate(s) || 0;
          }
          return next;
        }),
      );
    },
    [setRowOverrides],
  );

  const addRow = useCallback(
    (afterRowId?: string) => {
      const newRow: VardiyaRow = {
        id: genVardiyaRowId(),
        isManual: true,
        rangeLabel: "",
        weeks: 0,
        brut: 0,
        katsayi: katSayi ?? 1,
        fmHours: 0,
        calc225: 225,
        factor: 1.5,
        fm: 0,
        net: 0,
        startISO: "",
        endISO: "",
      };
      const { fm, net } = recalcVardiyaRow48(newRow);
      newRow.fm = fm;
      newRow.net = net;
      setRows((prev) => {
        if (!afterRowId) return [...prev, newRow];
        const idx = prev.findIndex((r) => r.id === afterRowId);
        if (idx < 0) return [...prev, newRow];
        const out = [...prev];
        out.splice(idx + 1, 0, newRow);
        return out;
      });
    },
    [katSayi],
  );

  const removeRow = useCallback(
    (rowId: string) => {
      setRowOverrides((prev) => {
        const n = { ...prev };
        delete n[rowId];
        return n;
      });
      setRows((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((r) => r.id !== rowId);
      });
    },
    [setRowOverrides],
  );

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış", "Çalışma Süresi", "Mod"],
      rows: [[isoToTR(iseGiris), isoToTR(istenCikis), diff.label, "48 saat (24/48)"]],
    });
    s.push({
      id: "ust",
      title: "Genel Bilgiler",
      html: buildWordTable(n1.headers, n1.rows),
      htmlForPdf: buildStyledReportTable(n1.headers, n1.rows),
    });
    const cetvelHeaders = ["Dönem", "Hafta Tipi", "Toplam Hafta", "Ücret (BRÜT)", "Katsayı", "Fazla Mesai Saati", "225", "1,5", "Fazla Mesai"];
    const cetvelRows = mergedCetvelRows.map((r) => {
      const periodLabel = r.rangeLabel || `${formatDateTR(r.startISO)}–${formatDateTR(r.endISO)}`;
      const periodWithNote = r.yillikIzinAciklama ? `${periodLabel} ${r.yillikIzinAciklama}` : periodLabel;
      return [
        periodWithNote,
        r.weekTypeLabel || "-",
        r.weeks,
        fmt(r.brut),
        r.katsayi,
        Number(r.fmHours || 0).toFixed(2),
        (r.calc225 ?? 225).toLocaleString("tr-TR"),
        (r.factor ?? 1.5).toLocaleString("tr-TR"),
        fmt(r.fm),
      ];
    });
    cetvelRows.push(["", "", "", "", "", "", "", "Toplam", fmt(totalBrut)]);
    const n2 = adaptToWordTable({ headers: cetvelHeaders, rows: cetvelRows });
    s.push({
      id: "cetvel",
      title: "Fazla Mesai Cetveli",
      html: buildWordTable(n2.headers, n2.rows),
      htmlForPdf: buildStyledReportTable(n2.headers, n2.rows, { lastRowBg: "blue" }),
    });
    const brutNetRows: { label: string; value: string }[] = [
      { label: "Brüt Fazla Mesai", value: fmtCurrency(totalBrut) },
      { label: "SGK (%14)", value: `-${fmtCurrency(totalBrut * SSK_ORAN)}` },
      { label: "İşsizlik (%1)", value: `-${fmtCurrency(totalBrut * ISSIZLIK_ORAN)}` },
      { label: `Gelir Vergisi ${brutNetResult.gelirVergisiDilimleri}`, value: `-${fmtCurrency(brutNetResult.gelirVergisi)}` },
      { label: "Damga Vergisi", value: `-${fmtCurrency(brutNetResult.damgaVergisi)}` },
      { label: "Net Fazla Mesai", value: fmtCurrency(brutNetResult.netYillik) },
    ];
    const n3 = adaptToWordTable(brutNetRows);
    s.push({
      id: "brutnet",
      title: "Brüt'ten Net'e",
      html: buildWordTable(n3.headers, n3.rows),
      htmlForPdf: buildStyledReportTable(n3.headers, n3.rows, { lastRowBg: "green" }),
    });
    {
      const mahsupRows: { label: string; value: string }[] = [
        { label: "Toplam Fazla Mesai (Brüt)", value: fmtCurrency(totalBrut) },
        { label: "1/3 Hakkaniyet İndirimi", value: `-${fmtCurrency(hakkaniyetIndirimi)}` },
        ...(mahsupNum > 0 ? [{ label: "Mahsuplaşma Miktarı", value: `-${fmtCurrency(mahsupNum)}` }] : []),
        { label: "Son Net Alacak", value: fmtCurrency(sonNet) },
      ];
      const n4 = adaptToWordTable(mahsupRows);
      s.push({
        id: "mahsup",
        title: "Mahsuplaşma",
        html: buildWordTable(n4.headers, n4.rows),
        htmlForPdf: buildStyledReportTable(n4.headers, n4.rows, { lastRowBg: "green" }),
      });
    }
    return s;
  }, [iseGiris, istenCikis, diff.label, mergedCetvelRows, totalBrut, brutNetResult, hakkaniyetIndirimi, mahsupNum, sonNet]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content-vardiya");
    if (!el) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${pageTitle}</title><style>@page{size:A4 portrait;margin:12mm}body{font-family:Inter,Arial,sans-serif;font-size:10px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px}</style></head><body>${el.outerHTML}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          /* ignore */
        }
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {
            /* ignore */
          }
        }, 400);
      };
    }
  }, [pageTitle]);

  return (
    <div className={styles.workspace} data-page="fazla-mesai-vardiya-48">
      <div className={styles.accent} aria-hidden />
      <div className={styles.inner}>
        {videoLink && (
          <div className="flex justify-end mb-4">
            <a
              href={videoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Kullanım Videosu İzle
            </a>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
          <div className="p-4 sm:p-5 space-y-5">
            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <h2 className={sectionTitleCls}>Dava dönemi</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                <div>
                  <label className={labelCls}>İşe giriş</label>
                  <input
                    type="date"
                    value={localIseGiris}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLocalIseGiris(v);
                      debouncedSetDate("iseGiris", v);
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>İşten çıkış</label>
                  <input
                    type="date"
                    value={localIstenCikis}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLocalIstenCikis(v);
                      debouncedSetDate("istenCikis", v);
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Başlangıç vardiya günü</label>
                  <select
                    value={anchorIsWorkDay ? "work" : "rest"}
                    onChange={(e) => setAnchorIsWorkDay(e.target.value === "work")}
                    className={inputCls}
                  >
                    <option value="work">İlk gün çalıştı</option>
                    <option value="rest">İlk gün dinlendi</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className={sectionTitleCls}>Tanık beyanları (tarih aralığı)</h2>
                <button
                  type="button"
                  onClick={addWitness}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                >
                  <Plus className="w-4 h-4" />
                  Tanık ekle
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Tanık tarihleri davacı dönemine göre kırpılır. Geçerli tanık aralığı yoksa hesaplama yalnızca davacı işe giriş–çıkış tarihleri üzerinden yapılır.
              </p>
              <div className="space-y-3">
                {taniklar.map((t, idx) => (
                  <div key={t.id} className="flex flex-wrap gap-2 items-end p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                    <div className="w-full sm:w-36">
                      <label className={labelCls}>İsim</label>
                      <input
                        type="text"
                        value={t.name ?? ""}
                        onChange={(e) => updateWitness(t.id, { name: e.target.value })}
                        placeholder={`Tanık ${idx + 1}`}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className={labelCls}>Başlangıç</label>
                      <input type="date" value={t.dateIn} onChange={(e) => updateWitness(t.id, { dateIn: e.target.value })} className={inputCls} />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className={labelCls}>Bitiş</label>
                      <input type="date" value={t.dateOut} onChange={(e) => updateWitness(t.id, { dateOut: e.target.value })} className={inputCls} />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWitness(t.id)}
                      disabled={taniklar.length <= 1}
                      className="p-2 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <details open className="group">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 list-none">
                  Metin Hesaplaması
                </summary>
                <div className="p-4">
                  {isCalculating && <p className="text-xs text-gray-500 mb-2">Hesaplanıyor…</p>}
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-800 dark:text-gray-200">
                    {bilirkisiDefaultText}
                  </pre>
                </div>
              </details>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => (zamanasimiBaslangic ? handleZamanasimiIptal() : setShowZamanaModal(true))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    zamanasimiBaslangic ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı itirazı"}
                </button>
                <button
                  type="button"
                  onClick={() => (hasCustomKatsayi ? handleFormChange({ katSayi: 1 }) : setShowKatsayiModal(true))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    hasCustomKatsayi ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {hasCustomKatsayi ? `Katsayı ${katSayi?.toFixed(2)}` : "Kat sayı"}
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
                <h2 className={sectionTitleCls}>Fazla mesai cetveli</h2>
              </div>
              <ZamanasimiCetvelBanner nihaiBaslangic={zamanasimiBaslangic} />
              <ManualBrutWageApplyControls
                rows={tableDisplayRows as FazlaMesaiRowBase[]}
                manualBrutActive={manualBrutActive}
                onDeactivateManualBrut={handleDeactivateManualBrut}
                onApplyBrutsByRowId={handleApplyManualWageBruts}
                success={success}
                error={showToastError}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse text-gray-900 dark:text-gray-100">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-left">Dönem</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-left">Hafta tipi</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Toplam hafta</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Brüt ücret</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Kat</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">FM saat</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">225</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">1,5</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Ücret</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-1 py-1.5 w-14" aria-label="Satır işlemleri" />
                    </tr>
                  </thead>
                  <tbody>
                    {tableDisplayRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="border border-gray-200 dark:border-gray-600 px-2 py-6 text-center text-gray-500">
                          Tarih aralığını girin.
                        </td>
                      </tr>
                    ) : (
                      tableDisplayRows.map((r, i) => (
                        <tr key={r.id || `${r.startISO}-${r.endISO}-${i}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={r.startISO?.slice(0, 10) || ""}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  applyRowPatch(r.id!, { startISO: raw ? clampToLastDayOfMonth(raw) : "" });
                                }}
                                className={`${tableInputCls} flex-1 min-w-0 text-left`}
                              />
                              <span className="text-gray-400 shrink-0">–</span>
                              <input
                                type="date"
                                value={r.endISO?.slice(0, 10) || ""}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  applyRowPatch(r.id!, { endISO: raw ? clampToLastDayOfMonth(raw) : "" });
                                }}
                                className={`${tableInputCls} flex-1 min-w-0 text-left`}
                              />
                            </div>
                            {r.yillikIzinAciklama ? (
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                                {r.yillikIzinAciklama}
                              </div>
                            ) : null}
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-left">
                            {r.weekTypeLabel || "-"}
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r.weeks ?? 0}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                applyRowPatch(r.id!, { weeks: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.brut ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                applyRowPatch(r.id!, { brut: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              step={0.0001}
                              value={r.katsayi ?? 1}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                applyRowPatch(r.id!, { katsayi: Number.isNaN(v) || v <= 0 ? 1 : v });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.fmHours ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                applyRowPatch(r.id!, { fmHours: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">
                            {(r.calc225 ?? 225).toLocaleString("tr-TR")}
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">
                            {(r.factor ?? 1.5).toLocaleString("tr-TR")}
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right font-medium">{fmt(r.fm)}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1 align-middle">
                            <div className="flex items-center justify-center gap-1 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
                              <button
                                type="button"
                                onClick={() => addRow(r.id)}
                                className="w-6 h-6 rounded flex items-center justify-center text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 font-medium"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRow(r.id!)}
                                disabled={rows.length <= 1}
                                className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 font-medium"
                                aria-label="Satırı sil"
                              >
                                -
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                    {tableDisplayRows.length > 0 && (
                      <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-semibold">
                        <td colSpan={8} className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">
                          Toplam
                        </td>
                        <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                          {fmtCurrency(totalBrut)}
                        </td>
                        <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30">
              <h2 className={sectionTitleCls}>Brütten nete</h2>
              <div className="divide-y divide-gray-200 dark:divide-gray-600 text-xs mt-2">
                <div className="flex justify-between py-1.5">
                  <span>Brüt</span>
                  <span>{fmtCurrency(totalBrut)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600">
                  <span>SGK (%14)</span>
                  <span>-{fmtCurrency(totalBrut * SSK_ORAN)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600">
                  <span>İşsizlik (%1)</span>
                  <span>-{fmtCurrency(totalBrut * ISSIZLIK_ORAN)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600">
                  <span>Gelir vergisi {brutNetResult.gelirVergisiDilimleri}</span>
                  <span>-{fmtCurrency(brutNetResult.gelirVergisi)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600">
                  <span>Damga</span>
                  <span>-{fmtCurrency(brutNetResult.damgaVergisi)}</span>
                </div>
                <div className="flex justify-between py-1.5 pt-2 font-semibold text-green-700 dark:text-green-400">
                  <span>Net</span>
                  <span>{fmtCurrency(brutNetResult.netYillik)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-pink-200 dark:border-pink-800 p-4 sm:p-5 bg-pink-50/50 dark:bg-pink-900/10 shadow-sm">
              <h2 className="text-base font-semibold text-pink-900 dark:text-pink-300 mb-3">Hakkaniyet indirimi / mahsuplaşma</h2>
              <p className="text-xs text-pink-800/80 dark:text-pink-200/70 mb-3">
                Son net alacak, brüt fazla mesai üzerinden 1/3 hakkaniyet indirimi ve (varsa) mahsuplaşma düşülerek hesaplanır. Brütten nete bölümündeki vergi kesintileri ayrıdır.
              </p>
              <div className="divide-y divide-pink-200/80 dark:divide-pink-800/60 text-sm">
                <div className="flex justify-between py-1.5">
                  <span>Toplam fazla mesai (brüt)</span>
                  <span className="font-medium tabular-nums">{fmtCurrency(totalBrut)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                  <span>1/3 hakkaniyet indirimi</span>
                  <span className="tabular-nums">-{fmtCurrency(hakkaniyetIndirimi)}</span>
                </div>
                {mahsupNum > 0 && (
                  <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                    <span>Mahsuplaşma</span>
                    <span className="tabular-nums">-{fmtCurrency(mahsupNum)}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 items-end py-1.5">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Mahsuplaşma miktarı</label>
                    <input
                      type="text"
                      value={mahsuplasmaMiktari}
                      onChange={(e) => handleFormChange({ mahsuplasmaMiktari: e.target.value })}
                      placeholder="0"
                      className={`${inputCls} max-w-[160px]`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMahsuplasamaModal(true)}
                    className="px-3 py-2 text-sm rounded border border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/30 shrink-0 self-end"
                  >
                    Mahsuplaşma ekle
                  </button>
                </div>
                <div className="flex justify-between py-1.5 pt-2 font-semibold text-pink-950 dark:text-pink-100">
                  <span>Son net alacak</span>
                  <span className="tabular-nums">{fmtCurrency(sonNet)}</span>
                </div>
              </div>
            </section>

            <NotlarAccordion />
          </div>
        </div>
      </div>

      <div style={{ display: "none" }}>
        <div id="report-content-vardiya" style={{ fontFamily: "Inter, Arial", maxWidth: "16cm", padding: "8px" }}>
          <h1 style={{ fontSize: "14px" }}>{pageTitle}</h1>
          {wordTableSections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: "12px" }}>
              <h2 style={{ fontSize: "12px" }}>{sec.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: sec.html }} />
            </div>
          ))}
        </div>
      </div>

      <ZamanasimiModal
        isOpen={showZamanaModal}
        onClose={() => setShowZamanaModal(false)}
        onApply={(p) =>
          handleFormChange({
            zamanasimi: {
              davaTarihi: p.davaTarihi,
              arabuluculukBaslangic: p.arabuluculukBaslangic,
              arabuluculukBitis: p.arabuluculukBitis,
              nihaiBaslangic: p.nihaiBaslangic,
            },
          })
        }
        form={zForm}
        setForm={setZForm}
        showToastError={showToastError}
        iseGiris={iseGiris}
      />
      <KatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={(k) => handleFormChange({ katSayi: k })} />
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onClose={() => setShowMahsuplasamaModal(false)}
        onSave={(total) => handleFormChange({ mahsuplasmaMiktari: String(total.toFixed(2)) })}
        periodLabels={rows.map((r) => r.startISO).filter(Boolean)}
      />

      <FooterActions
        replacePrintWith={{ label: "Yeni hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveLabel={isSaving ? (effectiveId ? "Güncelleniyor…" : "Kaydediliyor…") : effectiveId ? "Güncelle" : "Kaydet"}
        saveButtonProps={{ disabled: isSaving }}
        onPrint={handlePrint}
        previewButton={{
          title: pageTitle,
          copyTargetId: "vardiya-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <div id="vardiya-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} data-section={sec.id} className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold">{sec.title}</span>
                      <button
                        type="button"
                        className="p-1 text-gray-500"
                        onClick={async () => {
                          const ok = await copySectionForWord(sec.id);
                          if (ok) success("Kopyalandı");
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(pageTitle, "report-content-vardiya"),
        }}
      />
    </div>
  );
}
