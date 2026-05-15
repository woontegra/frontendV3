import type {
  DavaciUcretiSaveData,
  DavaciUcretiSavedData,
  ExtraItem,
  NetFromGrossData,
} from "./contract";
import { loadSavedCase } from "./api/savedCases";

export async function handleLoadCalculation(caseId: string): Promise<{
  formData: DavaciUcretiSavedData;
  name: string;
} | null> {
  try {
    const result = await loadSavedCase(caseId);
    if (!result.success || !result.data) {
      return null;
    }

    return {
      formData: result.data,
      name: result.name ?? "",
    };
  } catch (error) {
    console.error("[Davacı Ücreti] Kayıt yüklenemedi:", error);
    return null;
  }
}

export function prepareSaveData(
  ciplakBrut: string,
  extraItems: ExtraItem[],
  selectedYear: number,
  selectedPeriod: 1 | 2,
  notes: string,
  totalBrut: number,
  netFromGross: NetFromGrossData,
): DavaciUcretiSaveData {
  const normalizedExtraItems = extraItems.map((item) => ({
    id: item.id || crypto.randomUUID(),
    name: String(item.name || ""),
    value: item.value === undefined || item.value === null ? "" : String(item.value),
  }));

  return {
    data: {
      form: {
        ciplakBrut: String(ciplakBrut || ""),
        extraItems: normalizedExtraItems,
        selectedYear,
        selectedPeriod,
        notes: String(notes || ""),
      },
      results: {
        totals: { totalBrut },
        brut: totalBrut,
        net: netFromGross.net || 0,
      },
      netFromGross: {
        gross: netFromGross.gross || 0,
        sgk: netFromGross.sgk || 0,
        issizlik: netFromGross.issizlik || 0,
        gelirVergisi: netFromGross.gelirVergisi || 0,
        gelirVergisiDilimleri: String(netFromGross.gelirVergisiDilimleri || ""),
        damgaVergisi: netFromGross.damgaVergisi || 0,
        net: netFromGross.net || 0,
        gelirVergisiBrut: netFromGross.gelirVergisiBrut,
        gelirVergisiIstisna: netFromGross.gelirVergisiIstisna,
        damgaVergisiBrut: netFromGross.damgaVergisiBrut,
        damgaVergisiIstisna: netFromGross.damgaVergisiIstisna,
      },
    },
    brut_total: totalBrut,
    net_total: netFromGross.net || 0,
  };
}
