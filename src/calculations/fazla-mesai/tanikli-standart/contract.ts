/** Tanıklı Standart Fazla Mesai - tipler */
import type { ExcludedDay } from "@/utils/exclusionStorage";

export type Mode270 = "none" | "simple" | "detailed";

export interface Witness {
  id: string;
  name?: string;
  dateIn: string;
  dateOut: string;
  in: string;
  out: string;
  /** Boş = davacı ile aynı (FM / metin; 7 günde tatilli–tatilsiz davacı Metin sekmesinden). */
  weeklyDays?: number | string | "";
}

export interface DavaciBeyan {
  dateIn: string;
  dateOut: string;
  in: string;
  out: string;
}

export interface CalculationRow {
  id: string;
  startISO: string;
  endISO: string;
  rangeLabel: string;
  weeks: number;
  originalWeekCount: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fm: number;
  net: number;
  isManual?: boolean;
}

export const RECORD_TYPE = "tanikli_standart_fazla_mesai";
export const REDIRECT_BASE_PATH = "/fazla-mesai/tanikli-standart";

export interface FormValues {
  iseGiris: string;
  istenCikis: string;
  weeklyDays: number | string;
  haftaTatiliGunu?: number | "";
  davaci: DavaciBeyan;
  taniklar: Witness[];
  mode270: Mode270;
  katSayi: number;
  mahsuplasmaMiktari: string;
  exclusions: ExcludedDay[];
  zamanasimi: {
    davaTarihi: string;
    arabuluculukBaslangic: string;
    arabuluculukBitis: string;
    nihaiBaslangic: string;
  } | null;
}
