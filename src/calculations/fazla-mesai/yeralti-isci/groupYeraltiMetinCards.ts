/**
 * Yeraltı — Metin Hesaplaması (Tanıklı Standart düzeni):
 * Davacı için 1 kart, her tanık için 1 kart; kişi başına tek özet metin.
 */

export type YeraltiMetinWitnessInput = {
  id: string;
  name?: string;
  dateIn?: string;
  dateOut?: string;
  in?: string;
  out?: string;
  weeklyDays?: number | string;
};

export type YeraltiMetinKarti = {
  key: string;
  label: string;
  text: string;
};

const WEEKLY_LIMIT_Y = 37.5;
const STANDARD_DAILY_REF = 6.25;

function normalizeHm(t: string): string {
  const clean = String(t || "").trim().replace(".", ":");
  const [hs, ms] = clean.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return clean;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function applyYargitayRounding(decimalHours: number): number {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  if (minutes === 0) return hours;
  if (minutes <= 30) return hours + 0.5;
  return hours + 1;
}

function yeraltiBreakHours(brut: number): number {
  if (!Number.isFinite(brut) || brut <= 0) return 0;
  if (brut <= 4) return 0.25;
  if (brut <= 7.5) return 0.5;
  if (brut <= 11) return 1;
  if (brut < 14) return 1.5;
  if (brut < 15) return 2;
  return 3;
}

/** Saat değerini metinde göster (tam sayı: "10", kesirli: "6,25"). */
function fmtSaat(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
    return String(Math.round(rounded));
  }
  const s = rounded.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
  return s;
}

function fmtFm(n: number): string {
  return Number(n).toFixed(2).replace(".", ",");
}

function resolveWitnessWeeklyDays(witnessHg: number | string | undefined, davaciHg: number): number {
  if (witnessHg === "" || witnessHg == null) return davaciHg;
  const n = Number(witnessHg);
  return Number.isFinite(n) && n >= 1 && n <= 7 ? Math.floor(n) : davaciHg;
}

function buildMetinText(params: {
  giris: string;
  cikis: string;
  brut: number;
  brk: number;
  net: number;
  weeklyDays: number;
  activeTab: "tatilli" | "tatilsiz";
}): string {
  const { giris, cikis, brut, brk, net, weeklyDays, activeTab } = params;
  const inFmt = normalizeHm(giris);
  const outFmt = normalizeHm(cikis);
  const hg = weeklyDays || 6;

  const lines: string[] = [
    `${inFmt} - ${outFmt} = ${fmtSaat(brut)} saat çalışma`,
    ` - ${fmtSaat(brk)} saat ara dinlenme`,
    `= ${fmtSaat(net)} saat günlük çalışma`,
  ];

  let netHaftalik: number;

  if (hg === 7 && activeTab === "tatilli") {
    const weeklyNormal = 6 * net;
    const extra = Math.max(0, net - STANDARD_DAILY_REF);
    const weeklyCalc = weeklyNormal + extra;
    netHaftalik = applyYargitayRounding(weeklyCalc);
    lines.push(`6 × ${fmtSaat(net)} = ${fmtSaat(weeklyNormal)} saat`);
    lines.push(`${fmtSaat(net)} - 6:15 = ${fmtSaat(extra)} saat hafta tatili mesaisi`);
    lines.push(`= ${fmtSaat(weeklyCalc)} saat → Net haftalık: ${fmtSaat(netHaftalik)} saat`);
  } else {
    const days = hg === 7 && activeTab === "tatilsiz" ? 7 : hg;
    const weeklyCalc = net * days;
    netHaftalik = applyYargitayRounding(weeklyCalc);
    lines.push(`${days} × ${fmtSaat(net)} = ${fmtSaat(weeklyCalc)} saat → Net haftalık: ${fmtSaat(netHaftalik)} saat`);
  }

  const fm = Math.max(0, netHaftalik - WEEKLY_LIMIT_Y);
  lines.push(`${fmtSaat(netHaftalik)} saat - 37:30 saat = ${fmtFm(fm)} saat haftalık fazla mesai`);

  return lines.join("\n");
}

function buildDavaciText(
  davaciIn: string,
  davaciOut: string,
  weeklyDays: number,
  activeTab: "tatilli" | "tatilsiz",
): string | null {
  if (!davaciIn?.trim() || !davaciOut?.trim()) return null;

  const toMin = (t: string) => {
    const [h, m] = normalizeHm(t).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const brut = Math.max(0, (toMin(davaciOut) - toMin(davaciIn)) / 60);
  const brk = yeraltiBreakHours(brut);
  const net = Math.max(0, brut - brk);

  return buildMetinText({
    giris: davaciIn,
    cikis: davaciOut,
    brut,
    brk,
    net,
    weeklyDays,
    activeTab,
  });
}

function buildWitnessText(
  w: YeraltiMetinWitnessInput,
  davaciIn: string,
  davaciOut: string,
  weeklyDays: number,
  activeTab: "tatilli" | "tatilsiz",
): string | null {
  if (!w.dateIn || !w.dateOut || !w.in?.trim() || !w.out?.trim()) return null;

  const toMin = (t: string) => {
    const [h, m] = normalizeHm(t).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const dIn = toMin(davaciIn);
  const dOut = toMin(davaciOut);
  let tIn = toMin(w.in);
  let tOut = toMin(w.out);
  tIn = Math.max(tIn, dIn);
  tOut = Math.min(tOut, dOut);

  const brut = Math.max(0, (tOut - tIn) / 60);
  const brk = yeraltiBreakHours(brut);
  const net = Math.max(0, brut - brk);
  const kesikGir = normalizeHm(
    `${String(Math.floor(tIn / 60)).padStart(2, "0")}:${String(tIn % 60).padStart(2, "0")}`,
  );
  const kesikCik = normalizeHm(
    `${String(Math.floor(tOut / 60)).padStart(2, "0")}:${String(tOut % 60).padStart(2, "0")}`,
  );

  const hg = resolveWitnessWeeklyDays(w.weeklyDays, weeklyDays || 6);

  return buildMetinText({
    giris: kesikGir,
    cikis: kesikCik,
    brut,
    brk,
    net,
    weeklyDays: hg,
    activeTab,
  });
}

/** Tanıklı Standart ile aynı: davacı + tanıklar için kişi başına tek metin kartı. */
export function buildYeraltiMetinKartlari(params: {
  davaciIn: string;
  davaciOut: string;
  weeklyDays: number;
  activeTab: "tatilli" | "tatilsiz";
  witnesses: YeraltiMetinWitnessInput[];
}): YeraltiMetinKarti[] {
  const { davaciIn, davaciOut, weeklyDays, activeTab, witnesses } = params;
  const cards: YeraltiMetinKarti[] = [];

  const davaciText = buildDavaciText(davaciIn, davaciOut, weeklyDays, activeTab);
  if (davaciText) {
    cards.push({ key: "davaci", label: "DAVACI", text: davaciText });
  }

  witnesses.forEach((w, idx) => {
    const text = buildWitnessText(w, davaciIn, davaciOut, weeklyDays, activeTab);
    if (!text) return;
    const label = (w.name?.trim() || `TANIK ${idx + 1}`).toUpperCase();
    cards.push({ key: `witness:${w.id}`, label, text });
  });

  return cards;
}
