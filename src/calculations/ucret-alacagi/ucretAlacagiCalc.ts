/** Ücret Alacağı cetvel satır ve toplam hesapları (brüt/net aynı formül). */

export interface CetvelRowLike {
  ucret: number;
  katsayi: number;
  gunSayisi: number;
  ayGunSayisi: number;
  odenenUcret?: number;
}

export function calcRowUcretBase(row: CetvelRowLike): number {
  const isFullMonth = row.gunSayisi === row.ayGunSayisi;
  return isFullMonth
    ? row.ucret * row.katsayi
    : (row.ucret / 30) * row.gunSayisi * row.katsayi;
}

export function calcRowUcretTotal(row: CetvelRowLike): number {
  return Math.max(0, calcRowUcretBase(row) - (row.odenenUcret || 0));
}

export function calcCetvelGrandTotal(rows: CetvelRowLike[]): number {
  const ucretToplam = rows.reduce((acc, row) => acc + calcRowUcretBase(row), 0);
  const odenenToplam = rows.reduce((acc, row) => acc + (row.odenenUcret || 0), 0);
  return Math.max(0, ucretToplam - odenenToplam);
}

export type HesaplamaTab = "brut" | "net";

export const NET_ALACAK_LABEL = "Net Ücret Alacağı";
export const NET_CETVEL_FOOTER = "Toplam Net Ücret:";
