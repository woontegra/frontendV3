import { apiClient } from "@/utils/apiClient";
import type { BostaTotals, BostaCalculation } from "./contract";

export async function calculateBostaGecenSureApi(
  totals: BostaTotals,
  year: number,
  signal?: AbortSignal
): Promise<{ success: boolean; data?: BostaCalculation; error?: string }> {
  const res = await apiClient("/api/bosta-gecen-sure/calculate", {
    method: "POST",
    body: JSON.stringify({ totals, year }),
    signal,
  });

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return { success: false, error: "Geçersiz yanıt" };
  }

  const data = await res.json();
  if (!data.success || !data.data) {
    return { success: false, error: data.error || "Hesaplama yapılamadı" };
  }

  const d = data.data;
  return {
    success: true,
    data: {
      brutAmount: Number(d.brutAmount) || 0,
      sgk: Number(d.sgk) || 0,
      issizlik: Number(d.issizlik) || 0,
      gelirVergisi: Number(d.gelirVergisi) || 0,
      gelirVergisiDilimleri: String(d.gelirVergisiDilimleri || ""),
      damgaVergisi: Number(d.damgaVergisi) || 0,
      netAmount: Number(d.netAmount) || 0,
    },
  };
}
