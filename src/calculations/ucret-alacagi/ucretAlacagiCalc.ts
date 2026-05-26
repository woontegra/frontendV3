/** Ücret Alacağı cetvel satır ve toplam hesapları (brüt/net aynı formül). */

export interface CetvelRowLike {
  ucret: number;
  katsayi: number;
  gunSayisi: number;
  ayGunSayisi: number;
  odenenUcret?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcRowUcretBase(row: CetvelRowLike): number {
  const isFullMonth = row.gunSayisi === row.ayGunSayisi;
  return isFullMonth
    ? row.ucret * row.katsayi
    : (row.ucret / 30) * row.gunSayisi * row.katsayi;
}

/** Tablo ücret sütununda gösterilecek dönem hak edişi (aylık/30 × gün × katsayı) */
export function calcRowHakEdisDisplay(row: CetvelRowLike): number {
  return round2(calcRowUcretBase(row));
}

/** Dönem hak edişinden aylık ücret (state iç depolama) */
export function monthlyUcretFromHakEdis(hakEdis: number, row: CetvelRowLike): number {
  const katsayi = row.katsayi || 1;
  if (katsayi <= 0) return 0;
  const isFullMonth = row.gunSayisi === row.ayGunSayisi;
  if (isFullMonth) return round2(hakEdis / katsayi);
  const gun = row.gunSayisi || 0;
  if (gun <= 0) return 0;
  return round2((hakEdis * 30) / (gun * katsayi));
}

/**
 * Birikimli cari bakiye: o satıra kadar hak edişler − ödemeler.
 * kalan[i] = kalan[i-1] + hakEdiş[i] − ödenen[i]  (ilk satır: hakEdiş − ödenen)
 */
export function calcKalanRows(rows: CetvelRowLike[]): number[] {
  let running = 0;
  return rows.map((row) => {
    const hak = calcRowUcretBase(row);
    const odenen = row.odenenUcret || 0;
    running = round2(running + hak - odenen);
    return running;
  });
}

/** Dönem bazlı net etki (hak ediş − ödenen); brütten/nete vergi çevrimi için. */
export function calcPeriodSliceRows(rows: CetvelRowLike[]): number[] {
  return rows.map((row) => round2(calcRowUcretBase(row) - (row.odenenUcret || 0)));
}

export function calcRowKalan(rows: CetvelRowLike[], index: number): number {
  return calcKalanRows(rows)[index] ?? 0;
}

/** @deprecated calcRowKalan(rows, index) kullanın */
export function calcRowUcretTotal(row: CetvelRowLike, rows?: CetvelRowLike[], index?: number): number {
  if (rows != null && index != null) return calcRowKalan(rows, index);
  return round2(calcRowUcretBase(row) - (row.odenenUcret || 0));
}

/** Toplam alacak: tüm hak edişler − tüm ödemeler */
export function calcCetvelGrandTotal(rows: CetvelRowLike[]): number {
  const hakToplam = rows.reduce((acc, row) => acc + calcRowUcretBase(row), 0);
  const odenenToplam = rows.reduce((acc, row) => acc + (row.odenenUcret || 0), 0);
  return round2(hakToplam - odenenToplam);
}

export type HesaplamaTab = "brut" | "net";

export const NET_ALACAK_LABEL = "Net Ücret Alacağı";
export const NET_CETVEL_FOOTER = "Toplam Net Ücret:";
