import type { ExtraItem, NetFromGrossData } from "../contract";
import {
  getAsgariUcretByYearAndPeriod,
  hasTwoPeriods,
} from "../engine/asgariWage";
import { fmtCurrency, parseNum } from "../engine/format";
import {
  calculateIncomeTaxWithBrackets,
  computeGrossFromNetSingle,
  computeNetFromGrossSingle,
} from "../engine/incomeTaxCore";
import { calculateTotalBrut } from "../engine/totals";

const emptyNetFromGross = (): NetFromGrossData => ({
  gross: 0,
  sgk: 0,
  issizlik: 0,
  gelirVergisi: 0,
  gelirVergisiDilimleri: "",
  damgaVergisi: 0,
  net: 0,
});

export function deriveTotalBrut(ciplakBrut: string, extraItems: ExtraItem[]): number {
  return calculateTotalBrut(ciplakBrut, extraItems);
}

export function deriveNetFromGross(
  totalBrut: number,
  selectedYear: number,
  selectedPeriod: 1 | 2,
): NetFromGrossData {
  if (totalBrut <= 0) {
    return emptyNetFromGross();
  }

  const result = computeNetFromGrossSingle(totalBrut, selectedYear, selectedPeriod);
  const matrah = totalBrut - result.totalSgk - result.totalIssizlik;
  const bracketResult = calculateIncomeTaxWithBrackets(selectedYear, matrah);

  return {
    gross: result.totalGross,
    sgk: result.totalSgk,
    issizlik: result.totalIssizlik,
    gelirVergisi: result.totalGelirVergisi,
    gelirVergisiDilimleri: bracketResult.summary,
    damgaVergisi: result.totalDamgaVergisi,
    net: result.totalNet,
    gelirVergisiBrut: result.totalGelirVergisiBrut,
    gelirVergisiIstisna: result.totalGelirVergisiIstisna,
    damgaVergisiBrut: result.totalDamgaVergisiBrut,
    damgaVergisiIstisna: result.totalDamgaVergisiIstisna,
  };
}

export function deriveGrossFromNet(
  netForGross: string,
  selectedYear: number,
  selectedPeriod: 1 | 2,
) {
  const netValue = parseNum(netForGross);
  if (netValue <= 0) {
    return {
      net: 0,
      gross: 0,
      sgk: 0,
      issizlik: 0,
      gelirVergisi: 0,
      gelirVergisiBrut: 0,
      gelirVergisiIstisna: 0,
      gelirVergisiDilimleri: "",
      damgaVergisi: 0,
      damgaVergisiBrut: 0,
      damgaVergisiIstisna: 0,
    };
  }

  const result = computeGrossFromNetSingle(netValue, selectedYear, selectedPeriod);
  const matrah = result.totalGross - result.totalSgk - result.totalIssizlik;
  const bracketResult = calculateIncomeTaxWithBrackets(selectedYear, matrah);

  return {
    net: result.totalNet,
    gross: result.totalGross,
    sgk: result.totalSgk,
    issizlik: result.totalIssizlik,
    gelirVergisi: result.totalGelirVergisi,
    gelirVergisiBrut: result.totalGelirVergisiBrut,
    gelirVergisiIstisna: result.totalGelirVergisiIstisna,
    gelirVergisiDilimleri: bracketResult.summary,
    damgaVergisi: result.totalDamgaVergisi,
    damgaVergisiBrut: result.totalDamgaVergisiBrut,
    damgaVergisiIstisna: result.totalDamgaVergisiIstisna,
  };
}

export function deriveAsgariUcretError(
  ciplakBrut: string,
  selectedYear: number,
  selectedPeriod: 1 | 2,
): string | null {
  if (!ciplakBrut || !selectedYear) {
    return null;
  }

  const brutValue = parseNum(ciplakBrut);
  if (!brutValue) {
    return null;
  }

  const minUcret = getAsgariUcretByYearAndPeriod(selectedYear, selectedPeriod);
  if (!minUcret) {
    return null;
  }

  const twoPeriods = hasTwoPeriods(selectedYear);
  const periodText = twoPeriods
    ? selectedPeriod === 1
      ? "1. dönem (Ocak-Haziran)"
      : "2. dönem (Temmuz-Aralık)"
    : "";

  if (brutValue < minUcret) {
    return `Girilen ücret, ${selectedYear} yılı${twoPeriods ? ` ${periodText}` : ""} asgari brüt ücretinden düşük olamaz (${fmtCurrency(minUcret)} ₺).`;
  }

  return null;
}
