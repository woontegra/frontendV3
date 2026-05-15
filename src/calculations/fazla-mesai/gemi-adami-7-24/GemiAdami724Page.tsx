/**
 * Gemi adamı — 7×24 tam gemi adamı fazla mesai. API: /api/fm/gemi-full-crew24.
 * Tanık tarihi yoksa veya hiç geçerli tanık yoksa davacı dönemi tek segment olarak kullanılır.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { yukleHesap } from "@/core/kaydet/kaydetServisi";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi, calculateWeeksBetweenDates, isoToTR } from "@/utils/dateUtils";
import { apiPost } from "@/utils/apiClient";
import {
  buildWordTable,
  adaptToWordTable,
  copySectionForWord,
  clampToLastDayOfMonth,
  type FazlaMesaiRowBase,
} from "@modules/fazla-mesai/shared";
import { YillikIzinPanel } from "../standart/YillikIzinPanel";
import { UbgtFmDayPicker } from "../standart/UbgtFmDayPicker";
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
import { expandGemiRowsAnnualLeaveUbgt, type GemiExpandSourceRow } from "../gemi-adami-gunluk/gemiAnnualLeaveUbgtExpand";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";
import {
  applyResolvedManualBrutToRows,
  clearAllManualBrutFromRowOverrides,
  mergeManualWageBrutsIntoRowOverrides,
  reduceRowOverridesWithManualBrut,
} from "@/shared/utils/fazlaMesai/fmManualWageRowOverrides";
import { ManualBrutWageApplyControls } from "@/features/manual-brut-wage/ManualBrutWageApplyControls";
import { FazlaMesaiCetvelToolbar } from "../shared/FazlaMesaiCetvelToolbar";
import styles from "../standart/StandartFazlaMesaiPage.module.css";

const REDIRECT_BASE_724 = "/fazla-mesai/gemi-adami-7-24";
const RECORD_724 = "fazla_mesai_gemi_7_24";
const HAFTALIK_FM_724 = 35;
/** 7/24 tam gemi adamı — standart hesap metni (arayüz metin kutusu) */
const GEMI_724_METIN_SABLON =
  "7/24 çalışan hesabı:\n" +
  "7 gün × 24 saat = 168 saat (toplam)\n" +
  "168 - 77 saat (dinlenme molası) = 91 saat (net çalışma)\n" +
  "91 - 48 saat (yasal haftalık çalışma) - 8 saat (hafta tatili izni) = 35 saat haftalık fazla mesai";
const FAZLA_MESAI_DENOMINATOR = 240;
const FAZLA_MESAI_KATSAYI = 1.25;
const GELIR_VERGISI_BIRINCI_DILIM_ORANI = 0.15;

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const tableInputCls =
  "w-full min-w-0 px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

export type GemiRow = {
  id?: string;
  isManual?: boolean;
  rangeLabel?: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fmManual?: boolean;
  calc225?: number;
  factor?: number;
  fm: number;
  net: number;
  startISO: string;
  endISO: string;
  text?: string;
  /** UBGT / izin hafta bölmesi (Tanıklı Standart) */
  dailyNet?: number;
  annualLeaveHg?: number;
  annualLeaveSevenDay?: "tatilli" | "tatilsiz";
  yillikIzinAciklama?: string;
};

function genGemiRowId(): string {
  return `gemi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
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

/** Sunucu satırları / tanık override sonrası FM ve net tutarını yeniden hesaplar */
function recalcGemiFmNet(row: GemiRow, fmHours: number, katOverride: number): Pick<GemiRow, "fm" | "net"> {
  const kats = Number.isFinite(katOverride) && katOverride > 0 ? katOverride : row.katsayi || 1;
  const step1 = Number((row.weeks * row.brut).toFixed(6));
  const step2 = Number((step1 * kats).toFixed(6));
  const step3 = Number((step2 * fmHours).toFixed(6));
  const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
  const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
  const fm = Number(step5.toFixed(2));
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_BIRINCI_DILIM_ORANI)).toFixed(2));
  return { fm, net };
}

export default function GemiAdami724Page() {
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

  const [rows, setRows] = useState<GemiRow[]>([]);
  const [textPeriods, setTextPeriods] = useState<
    Array<{ startDate?: string; endDate?: string; text?: string; witnessTitle?: string }>
  >([]);
  const [hoveredGemiRow, setHoveredGemiRow] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [haftalikMesaiDisplay, setHaftalikMesaiDisplay] = useState(HAFTALIK_FM_724);
  const [show270Dropdown, setShow270Dropdown] = useState(false);
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [localIseGiris, setLocalIseGiris] = useState("");
  const [localIstenCikis, setLocalIstenCikis] = useState("");
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backendRequestIdRef = useRef(0);

  const {
    iseGiris,
    istenCikis,
    taniklar,
    mode270,
    katSayi,
    mahsuplasmaMiktari,
    haftaTatiliGunu,
  } = formValues;
  const zamanasimiBaslangic = formValues.zamanasimi?.nihaiBaslangic || null;
  const include270 = mode270 !== "none";

  const recordType = RECORD_724;
  const redirectBase = REDIRECT_BASE_724;
  const pageTitle = "Gemi Adamı — 7×24 Tam Gemi Adamı Fazla Mesai";
  const videoLink = getVideoLink("fazla-gemi-7-24") || getVideoLink("fazla-gemi");

  useEffect(() => {
    setLocalIseGiris(iseGiris || "");
    setLocalIstenCikis(istenCikis || "");
  }, [iseGiris, istenCikis]);

  useEffect(() => () => {
    if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
  }, []);

  useEffect(() => {
    if (!effectiveId) return;
    let mounted = true;
    yukleHesap(effectiveId, RECORD_724)
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
          ...(inner.mode270 && { mode270: inner.mode270 }),
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
            (loadedRows as GemiRow[]).map((r) => ({
              ...r,
              id: r.id ?? genGemiRowId(),
            })),
          );
        }
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

  /** UBGT kataloğu: yalnızca cetvel satırlarının birleşik aralığı (davacı/tanık beyanına göre genişletilmez). */
  const ubgtFmCatalogRange = useMemo(() => {
    let start = "";
    let end = "";
    for (const r of rows) {
      const s = (r.startISO || "").slice(0, 10);
      const e = (r.endISO || "").slice(0, 10);
      if (!s || !e) continue;
      if (!start || s < start) start = s;
      if (!end || e > end) end = e;
    }
    if (!start || !end || start > end) return { start: "", end: "" };
    return { start, end };
  }, [rows]);

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

  useEffect(() => {
    if (rows.length > 0 && rows[0].fmHours != null) {
      setHaftalikMesaiDisplay(Number(rows[0].fmHours));
    } else {
      setHaftalikMesaiDisplay(HAFTALIK_FM_724);
    }
  }, [rows]);

  useEffect(() => {
    const dStart = normalizeDateInput(iseGiris);
    const dEnd = normalizeDateInput(istenCikis);
    if (!dStart || !dEnd) {
      setRows([]);
      setTextPeriods([]);
      return;
    }

    const t = setTimeout(() => {
      const requestId = ++backendRequestIdRef.current;
      (async () => {
        try {
          setIsCalculating(true);
          const exclusionsForApi = Array.isArray(exclusions)
            ? exclusions
                .filter((e) => e && (e.start || e.end))
                .map((e) => {
                  const s = String(e.start ?? "").trim();
                  const eStr = String(e.end ?? "").trim();
                  return {
                    start: s.length > 10 ? s.slice(0, 10) : s,
                    end: eStr.length > 10 ? eStr.slice(0, 10) : eStr,
                    days: Number(e.days) || 0,
                  };
                })
                .filter((e) => e.start.length >= 10 && e.end.length >= 10)
            : [];

          const zNorm = zamanasimiBaslangic ? normalizeDateInput(zamanasimiBaslangic) : null;

          const davaciPayload = {
            dateIn: dStart,
            dateOut: dEnd,
            in: "00:00",
            out: "00:00",
          };

          const witnessesPayloadRaw = taniklar.map((w) => ({
            id: w.id,
            name: (w.name || "").trim(),
            dateIn: normalizeDateInput(w.dateIn) || w.dateIn,
            dateOut: normalizeDateInput(w.dateOut) || w.dateOut,
            in: "00:00",
            out: "00:00",
          }));
          const witnessesValid = witnessesPayloadRaw.filter((w) => w.dateIn && w.dateOut);
          const witnessesPayload =
            witnessesValid.length > 0
              ? witnessesPayloadRaw
              : [
                  {
                    id: "synthetic-davaci-period",
                    name: "Davacı dönemi",
                    dateIn: dStart,
                    dateOut: dEnd,
                    in: "00:00",
                    out: "00:00",
                  },
                ];

          const payload = {
            davaci: davaciPayload,
            witnesses: witnessesPayload,
            exclusions: exclusionsForApi,
            katSayi: katSayi || 1,
            zamanasimiBaslangic: zNorm || null,
            include270,
            mode270,
            haftalikMesai: HAFTALIK_FM_724,
            iseGiris: dStart,
            istenCikis: dEnd,
          };
          const response = await apiPost("/api/fm/gemi-full-crew24", payload);

          if (!response.ok) {
            let msg = "Hesaplama başarısız";
            try {
              const errBody = await response.json();
              msg = errBody.error || errBody.message || msg;
            } catch {
              /* ignore */
            }
            throw new Error(msg);
          }

          const result = await response.json();
          if (requestId !== backendRequestIdRef.current) return;

          const fromBackend: GemiRow[] = (result.rows || []).map((r: Record<string, unknown>) => {
            const startISO = String(r.startISO ?? r.startDate ?? "");
            const endISO = String(r.endISO ?? r.endDate ?? "");
            const dailyNetRaw = r.dailyNet ?? r.dailyHours;
            const dailyNet =
              dailyNetRaw != null && Number.isFinite(Number(dailyNetRaw)) ? Number(dailyNetRaw) : undefined;
            const annualLeaveHgRaw = r.annualLeaveHg;
            const annualLeaveHg =
              annualLeaveHgRaw != null && Number.isFinite(Number(annualLeaveHgRaw))
                ? Number(annualLeaveHgRaw)
                : undefined;
            const sevenRaw = r.annualLeaveSevenDay;
            const annualLeaveSevenDay =
              sevenRaw === "tatilli" || sevenRaw === "tatilsiz" ? sevenRaw : undefined;
            return {
              rangeLabel: String(r.rangeLabel || ""),
              weeks: Number(r.weeks) || 0,
              brut: Number(r.brut) || 0,
              katsayi: Number(r.katsayi) || 1,
              fmHours: Number(r.fmHours) || 0,
              dailyNet,
              annualLeaveHg,
              annualLeaveSevenDay,
              calc225: Number(r.calc225) || 240,
              factor: Number(r.factor) || 1.25,
              fm: Number(r.fm) || 0,
              net: Number(r.net) || 0,
              startISO,
              endISO,
              text: typeof r.text === "string" ? r.text : undefined,
            };
          });

          // 7×24: FM sunucuda sabit; günlük moddaki tanık FM override burada uygulanmaz.
          const withBestFM = fromBackend;

          const merged: GemiRow[] = [];
          for (const row of withBestFM) {
            const last = merged[merged.length - 1];
            if (last && last.fmHours === row.fmHours && last.brut === row.brut && last.katsayi === row.katsayi) {
              const mergedStart = (last.startISO || "").slice(0, 10);
              const mergedEnd = (row.endISO || "").slice(0, 10);
              let totalWeeks =
                mergedStart.length >= 10 && mergedEnd.length >= 10
                  ? Math.max(1, calculateWeeksBetweenDates(mergedStart, mergedEnd) || 1)
                  : (last.weeks || 0) + (row.weeks || 0);
              const spanMs = new Date(mergedEnd).getTime() - new Date(mergedStart).getTime();
              const spanDays = Math.floor(spanMs / 86400000) + 1;
              if (Number.isFinite(spanDays) && spanDays > 0 && spanDays <= 370) {
                totalWeeks = Math.min(52, totalWeeks);
              }
              const { fm, net } = recalcGemiFmNet({ ...last, weeks: totalWeeks }, last.fmHours, katSayi || 1);
              merged[merged.length - 1] = {
                ...last,
                endISO: row.endISO,
                rangeLabel: `${last.rangeLabel?.split(" – ")[0] ?? ""} – ${row.rangeLabel?.split(" – ")[1] ?? ""}`,
                weeks: totalWeeks,
                fm,
                net,
              };
            } else {
              merged.push({ ...row });
            }
          }
          let pipeRows: GemiRow[] = merged;
          if (exclusions.length > 0) {
            const weeklyOffNum =
              haftaTatiliGunu === "" || haftaTatiliGunu == null ? null : Number(haftaTatiliGunu);
            pipeRows = expandGemiRowsAnnualLeaveUbgt(merged as GemiExpandSourceRow[], exclusions, {
              hg: 7,
              weeklyOffDay: Number.isInteger(weeklyOffNum) ? weeklyOffNum : null,
              davaciSevenDay: "tatilsiz",
              applyYargitay270FmDeduction: include270 && mode270 === "simple",
            }) as GemiRow[];
          }
          const processedFromBackend = pipeRows;

          setRows((prev) => {
            const manualRows = prev.filter((r) => r.isManual);
            const prevApi = prev.filter((r) => !r.isManual);
            if (processedFromBackend.length === 0) return manualRows;
            const apiRows = processedFromBackend.map((backendRow, idx) => ({
              ...backendRow,
              id: prevApi[idx]?.id ?? genGemiRowId(),
            }));
            return [...apiRows, ...manualRows];
          });
          setTextPeriods(result.textPeriods || []);
        } catch (e) {
          if (requestId === backendRequestIdRef.current) {
            setRows([]);
            setTextPeriods([]);
            console.error("[Gemi724]", e);
          }
        } finally {
          if (requestId === backendRequestIdRef.current) setIsCalculating(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [
    iseGiris,
    istenCikis,
    taniklar,
    exclusions,
    katSayi,
    zamanasimiBaslangic,
    include270,
    mode270,
    haftaTatiliGunu,
  ]);

  const mergedCetvelRows = useMemo(() => {
    return applyResolvedManualBrutToRows(rows as FazlaMesaiRowBase[], rowOverrides).map((base) => {
      const r = base as GemiRow;
      const { fm, net } = recalcGemiFmNet(r, Number(r.fmHours) || 0, katSayi || 1);
      return { ...r, fm, net };
    }) as GemiRow[];
  }, [rows, rowOverrides, katSayi]);

  const stepsText = useMemo(() => {
    const parts = textPeriods.map((p) => p.text || "").filter(Boolean);
    if (parts.length > 0) return parts.join("\n\n");
    const fromRows = rows.map((r) => r.text || "").filter(Boolean);
    return fromRows.join("\n\n");
  }, [textPeriods, rows]);

  const totalBrut = useMemo(() => mergedCetvelRows.reduce((a, r) => a + (Number(r.fm) || 0), 0), [mergedCetvelRows]);

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

  const applyGemiRowPatch = useCallback(
    (rowId: string, patch: Partial<GemiRow>) => {
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
          if ((r.id || "") !== rowId) return r;
          const next: GemiRow = { ...r, ...patch };
          const s = (next.startISO || "").slice(0, 10);
          const e = (next.endISO || "").slice(0, 10);
          if ((patch.startISO != null || patch.endISO != null) && s.length >= 10 && e.length >= 10) {
            let w = Math.max(1, calculateWeeksBetweenDates(s, e) || 1);
            const spanMs = new Date(e).getTime() - new Date(s).getTime();
            const spanDays = Math.floor(spanMs / 86400000) + 1;
            if (Number.isFinite(spanDays) && spanDays > 0 && spanDays <= 370) {
              w = Math.min(52, w);
            }
            next.weeks = w;
            next.rangeLabel = `${formatDateTR(s)}–${formatDateTR(e)}`;
          }
          return next;
        }),
      );
    },
    [setRowOverrides],
  );

  const addGemiRow = useCallback(
    (afterRowId?: string) => {
      const blank: GemiRow = {
        id: genGemiRowId(),
        isManual: true,
        rangeLabel: "",
        weeks: 0,
        brut: 0,
        katsayi: katSayi ?? 1,
        fmHours: 0,
        calc225: 240,
        factor: 1.25,
        fm: 0,
        net: 0,
        startISO: "",
        endISO: "",
      };
      const { fm, net } = recalcGemiFmNet(blank, 0, katSayi || 1);
      const newRow: GemiRow = { ...blank, fm, net };
      setRows((prev) => {
        if (!afterRowId) return [...prev, newRow];
        const idx = prev.findIndex((x) => x.id === afterRowId);
        if (idx < 0) return [...prev, newRow];
        const out = [...prev];
        out.splice(idx + 1, 0, newRow);
        return out;
      });
    },
    [katSayi]
  );

  const removeGemiRow = useCallback((rowId: string) => {
    setRowOverrides((prev) => {
      const n = { ...prev };
      delete n[rowId];
      return n;
    });
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== rowId);
    });
  }, [setRowOverrides]);

  const handleSave = useCallback(() => {
    kaydetAc({
      hesapTuru: recordType,
      veri: {
        data: {
          form: {
            ...formValues,
            gemiMode: "724" as const,
            rows,
            pageType: "gemi-adami-7-24",
            route: redirectBase,
          },
          results: {
            rows: tableDisplayRows,
            totalBrut,
            totalNet: brutNetResult.netYillik,
            weeklyFMHours: haftalikMesaiDisplay,
          },
        },
        formValues: { ...formValues, gemiMode: "724", rows },
        totals: { toplam: totalBrut, yil: diff.years, ay: diff.months, gun: diff.days },
        brut_total: totalBrut,
        net_total: brutNetResult.netYillik,
        exclusions,
        mode270,
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
    rows,
    tableDisplayRows,
    totalBrut,
    brutNetResult.netYillik,
    haftalikMesaiDisplay,
    diff,
    exclusions,
    mode270,
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

  const modeBlurb =
    "7×24 tam gemi adamı: haftalık fazla mesai saati sabit 35 saattir (bölücü 240, çarpan 1,25). Tanık zorunlu değildir; tanık tarihi yoksa hesaplama davacı işe giriş–işten çıkış dönemiyle yapılır.";

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış", "Süre", "Mod", "Haftalık FM saat"],
      rows: [
        [
          isoToTR(iseGiris),
          isoToTR(istenCikis),
          diff.label,
          "7×24",
          haftalikMesaiDisplay.toFixed(2),
        ],
      ],
    });
    s.push({
      id: "ust",
      title: "Genel Bilgiler",
      html: buildWordTable(n1.headers, n1.rows),
      htmlForPdf: buildStyledReportTable(n1.headers, n1.rows),
    });

    const cetvelHeaders = ["Dönem", "Hafta", "Ücret", "Kat", "FM Saat", "240", "1,25", "FM"];
    const cetvelRows = mergedCetvelRows.map((r) => {
      const periodLabel = r.rangeLabel || `${formatDateTR(r.startISO)} – ${formatDateTR(r.endISO)}`;
      const periodWithNote = r.yillikIzinAciklama ? `${periodLabel} ${r.yillikIzinAciklama}` : periodLabel;
      return [
      periodWithNote,
      r.weeks ?? 0,
      fmt(r.brut ?? 0),
      r.katsayi ?? 1,
      (r.fmHours ?? 0).toFixed(2),
      "240",
      "1,25",
      fmt(r.fm ?? 0),
    ];
    });
    cetvelRows.push(["", "", "", "", "", "", "Toplam", fmt(totalBrut)]);
    const n2 = adaptToWordTable({ headers: cetvelHeaders, rows: cetvelRows });
    s.push({
      id: "cetvel",
      title: "Fazla Mesai Cetveli (Gemi)",
      html: buildWordTable(n2.headers, n2.rows),
      htmlForPdf: buildStyledReportTable(n2.headers, n2.rows, { lastRowBg: "blue" }),
    });

    if (exclusions.length > 0) {
      const yillikIzinHeaders = ["Tür", "Başlangıç", "Bitiş", "Gün"];
      const yillikIzinRows = exclusions.map((ex) => [
        ex.type || "Yıllık İzin",
        formatDateTR(ex.start),
        formatDateTR(ex.end),
        ex.days ?? 0,
      ]);
      const nY = adaptToWordTable({ headers: yillikIzinHeaders, rows: yillikIzinRows });
      s.push({
        id: "yillikizin",
        title: "Yıllık İzin Düşümü",
        html: buildWordTable(nY.headers, nY.rows),
        htmlForPdf: buildStyledReportTable(nY.headers, nY.rows),
      });
    }

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
  }, [
    iseGiris,
    istenCikis,
    diff.label,
    haftalikMesaiDisplay,
    mergedCetvelRows,
    totalBrut,
    brutNetResult,
    exclusions,
    mahsupNum,
    hakkaniyetIndirimi,
    sonNet,
  ]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content-gemi-adami-724");
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
    <div className={styles.workspace} data-page="fazla-mesai-gemi-adami-7-24">
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
            <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/20 p-3">
              <p className="text-xs text-sky-900 dark:text-sky-200 m-0 leading-relaxed">{modeBlurb}</p>
            </div>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <h2 className={sectionTitleCls}>Dava dönemi</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 w-full">
                <div className="min-w-0">
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
                <div className="min-w-0">
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
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                7×24 modda yalnızca işe giriş ve işten çıkış tarihleri zorunludur. Haftalık fazla mesai saati sabit 35 saattir.
              </p>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className={sectionTitleCls}>Tanık beyanları (isteğe bağlı)</h2>
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
                Tanık için yalnızca isim ve çalıştığı dönem (başlangıç–bitiş tarihleri) girilir; saat alanı yoktur. Hiç tanık yoksa veya hiçbir tanıkta tarih yoksa hesaplama yalnızca davacı dönemiyle yapılır.
              </p>
              <div className="space-y-3">
                {taniklar.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap gap-2 items-end p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
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
              <details className="group" open>
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between list-none">
                  <span>Metin Hesaplaması</span>
                  <svg
                    className="w-4 h-4 transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="p-4">
                  {isCalculating && <p className="text-xs text-gray-500 mb-2">Hesaplanıyor…</p>}
                  <div className="bg-[#f1f3f5] dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200 m-0 font-sans">
                      {GEMI_724_METIN_SABLON}
                    </pre>
                    {stepsText ? (
                      <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600 text-xs leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                        {stepsText}
                      </div>
                    ) : null}
                  </div>
                </div>
              </details>
            </section>

            <div className="space-y-3">
              <YillikIzinPanel exclusions={exclusions} setExclusions={setExclusions} success={success} showToastError={showToastError} />
              <UbgtFmDayPicker
                rangeStart={ubgtFmCatalogRange.start}
                rangeEnd={ubgtFmCatalogRange.end}
                exclusions={exclusions}
                setExclusions={setExclusions}
                showToastError={showToastError}
              />
            </div>

            <p className="text-[11px] sm:text-xs text-red-600 dark:text-red-400 leading-relaxed">
              Son haftaya isabet eden izin/UBGT düşümlerinde, tabloda görülen tarih aralığı 7 günden kısa olsa dahi hesaplama bu süre üzerinden yapılmaz. İlgili düşüm, üst satırdaki toplam haftadan 1 hafta eksiltilerek ayrı bir satırda 1 hafta olarak dikkate alınmıştır.
            </p>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
                <h2 className={sectionTitleCls}>Fazla Mesai Hesaplama Cetveli</h2>
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
              <div className="px-4 py-2.5 sm:py-3 border-t border-b border-gray-200 dark:border-gray-600 bg-gray-50/90 dark:bg-gray-900/40">
                <FazlaMesaiCetvelToolbar
                  mode270={mode270}
                  show270Dropdown={show270Dropdown}
                  setShow270Dropdown={setShow270Dropdown}
                  onSelectMode270={(m) => handleFormChange({ mode270: m })}
                  zamanasimiBaslangic={zamanasimiBaslangic}
                  onZamanaButtonClick={() =>
                    zamanasimiBaslangic ? handleZamanasimiIptal() : setShowZamanaModal(true)
                  }
                  hasCustomKatsayi={hasCustomKatsayi}
                  katSayi={katSayi ?? 1}
                  onKatsayiButtonClick={() =>
                    hasCustomKatsayi ? handleFormChange({ katSayi: 1 }) : setShowKatsayiModal(true)
                  }
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-0">
                  270 ve zamanaşımı sunucuda uygulanır: Yargıtay seçeneğinde hafta değişmez, FM saatinden 5 saat 12 dakika düşülür; Şirket seçeneğinde hafta düşümü uygulanır.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table
                  className="w-full text-xs border-collapse font-sans table-fixed text-gray-900 dark:text-gray-100"
                  style={{ minWidth: "640px" }}
                >
                  <colgroup>
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "6%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="px-2 py-1.5 text-left border border-gray-200 dark:border-gray-600 font-semibold">
                        Tarih Aralığı
                      </th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Hafta</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Ücret</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Kat</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">FM Saati</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">240</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">1,25</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Fazla Mesai</th>
                      <th className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" aria-label="Satır işlemleri" />
                    </tr>
                  </thead>
                  <tbody>
                    {tableDisplayRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-2 py-4 border border-gray-200 dark:border-gray-600 text-center text-gray-500">
                          {rows.length === 0
                            ? !iseGiris || !istenCikis
                              ? "İşe giriş ve işten çıkış tarihlerini girin."
                              : "Hesaplanıyor veya sunucudan cetvel alınamadı."
                            : "Cetvelde gösterilecek satır yok (FM saati veya hafta sıfır olan satırlar gizlenir)."}
                        </td>
                      </tr>
                    ) : (
                      tableDisplayRows.map((r, i) => (
                        <tr
                          key={r.id || `${r.startISO}-${r.endISO}-${i}`}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          onMouseEnter={() => setHoveredGemiRow(i)}
                          onMouseLeave={() => setHoveredGemiRow(null)}
                        >
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600 align-top">
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={(r.startISO || "").slice(0, 10)}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  if (!r.id) return;
                                  applyGemiRowPatch(r.id, { startISO: raw ? clampToLastDayOfMonth(raw) : "" });
                                }}
                                className={`${tableInputCls} flex-1 min-w-0 text-left`}
                              />
                              <span className="text-gray-400 shrink-0">–</span>
                              <input
                                type="date"
                                value={(r.endISO || "").slice(0, 10)}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  if (!r.id) return;
                                  applyGemiRowPatch(r.id, { endISO: raw ? clampToLastDayOfMonth(raw) : "" });
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
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r.weeks ?? 0}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!r.id) return;
                                applyGemiRowPatch(r.id, { weeks: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.brut ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                if (!r.id) return;
                                applyGemiRowPatch(r.id, { brut: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.0001}
                              value={r.katsayi ?? 1}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                if (!r.id) return;
                                applyGemiRowPatch(r.id, { katsayi: Number.isNaN(v) || v <= 0 ? 1 : v });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={r.fmHours ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                if (!r.id) return;
                                applyGemiRowPatch(r.id, { fmHours: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">240</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">1,25</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right font-medium whitespace-nowrap">
                            {fmt(Number(r.fm) || 0)}
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600">
                            {hoveredGemiRow === i && r.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => addGemiRow(r.id)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 font-medium"
                                  aria-label="Satır ekle"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeGemiRow(r.id)}
                                  disabled={rows.length <= 1}
                                  className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 font-medium"
                                  aria-label="Satırı sil"
                                >
                                  −
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                    {tableDisplayRows.length > 0 && (
                      <tr className="bg-indigo-50 dark:bg-indigo-900/30 font-semibold">
                        <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600">Toplam Fazla Mesai:</td>
                        <td colSpan={6} className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                        <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600 text-right whitespace-nowrap">
                          {fmtCurrency(totalBrut)}
                        </td>
                        <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
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

            <section className="rounded-xl border border-pink-200 dark:border-pink-800 p-4 sm:p-5 bg-pink-50/50 dark:bg-pink-900/10">
              <h2 className="text-base font-semibold text-pink-900 dark:text-pink-300 mb-3">Hakkaniyet / mahsuplaşma</h2>
              <div className="flex flex-wrap gap-2 items-end text-sm">
                <div>
                  <label className={labelCls}>Mahsuplaşma</label>
                  <input
                    type="text"
                    value={mahsuplasmaMiktari}
                    onChange={(e) => handleFormChange({ mahsuplasmaMiktari: e.target.value })}
                    className={`${inputCls} max-w-[160px]`}
                  />
                </div>
                <button type="button" onClick={() => setShowMahsuplasamaModal(true)} className="px-3 py-2 rounded border border-pink-300 text-pink-700 text-sm">
                  Mahsuplaşma ekle
                </button>
              </div>
              <div className="divide-y divide-pink-200/70 dark:divide-pink-800/60 text-xs sm:text-sm mt-3">
                <div className="flex justify-between py-1.5">
                  <span>Toplam fazla mesai (brüt)</span>
                  <span>{fmtCurrency(totalBrut)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-700 dark:text-red-300">
                  <span>1/3 hakkaniyet indirimi</span>
                  <span>-{fmtCurrency(hakkaniyetIndirimi)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-700 dark:text-red-300">
                  <span>Mahsuplaşma miktarı</span>
                  <span>-{fmtCurrency(mahsupNum)}</span>
                </div>
                <div className="flex justify-between py-2 font-semibold text-emerald-700 dark:text-emerald-300">
                  <span>Son net</span>
                  <span>{fmtCurrency(sonNet)}</span>
                </div>
              </div>
            </section>

            <NotlarAccordion />
          </div>
        </div>
      </div>

      <div style={{ display: "none" }}>
        <div id="report-content-gemi-adami-724" style={{ fontFamily: "Inter, Arial", maxWidth: "16cm", padding: "8px" }}>
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
        periodLabels={mergedCetvelRows.map((r) => r.startISO).filter(Boolean)}
      />

      <FooterActions
        replacePrintWith={{ label: "Yeni hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveLabel={isSaving ? (effectiveId ? "Güncelleniyor…" : "Kaydediliyor…") : effectiveId ? "Güncelle" : "Kaydet"}
        saveButtonProps={{ disabled: isSaving }}
        onPrint={handlePrint}
        previewButton={{
          title: pageTitle,
          copyTargetId: "gemi-adami-724-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <div id="gemi-adami-724-word-copy">
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
          onPdf: () => downloadPdfFromDOM(pageTitle, "report-content-gemi-adami-724"),
        }}
      />
    </div>
  );
}
