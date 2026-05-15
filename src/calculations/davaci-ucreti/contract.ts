export interface ExtraItem {
  id: string;
  name: string;
  value: string;
}

export interface NetFromGrossData {
  gross: number;
  sgk: number;
  issizlik: number;
  gelirVergisi: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  net: number;
  gelirVergisiBrut?: number;
  gelirVergisiIstisna?: number;
  damgaVergisiBrut?: number;
  damgaVergisiIstisna?: number;
}

export interface DavaciUcretiFormData {
  ciplakBrut?: string;
  extraItems?: ExtraItem[];
  selectedYear?: number;
  selectedPeriod?: 1 | 2;
  notes?: string;
}

export interface DavaciUcretiResultsData {
  totals?: {
    totalBrut: number;
  };
  brut?: number;
  net?: number;
}

export interface DavaciUcretiSavedData {
  data?: {
    form?: DavaciUcretiFormData;
    results?: DavaciUcretiResultsData;
    netFromGross?: NetFromGrossData;
  };
  form?: DavaciUcretiFormData;
  netFromGross?: NetFromGrossData;
  ciplakBrut?: string;
  extraItems?: ExtraItem[];
  selectedYear?: number;
  selectedPeriod?: 1 | 2;
  notes?: string;
}

export interface DavaciUcretiSaveData {
  data: {
    form: DavaciUcretiFormData;
    results: DavaciUcretiResultsData;
    netFromGross: NetFromGrossData;
  };
  brut_total: number;
  net_total: number;
}

export const DAVACI_UCRETI_TYPE = "davaci_ucreti" as const;
