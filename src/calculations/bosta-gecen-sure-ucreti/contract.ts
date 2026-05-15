export type BostaTotals = { toplam: number; yil: number; ay: number; gun: number };

export type BostaCalculation = {
  brutAmount: number;
  sgk: number;
  issizlik: number;
  gelirVergisi: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  netAmount: number;
};

export const EMPTY_CALC: BostaCalculation = {
  brutAmount: 0,
  sgk: 0,
  issizlik: 0,
  gelirVergisi: 0,
  gelirVergisiDilimleri: "",
  damgaVergisi: 0,
  netAmount: 0,
};
