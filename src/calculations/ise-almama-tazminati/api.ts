import { apiClient } from "@/utils/apiClient";
import type { IseAlmamaRow } from "./contract";

/** Backend: iseAlmamaTazminati.service — 4–8 aylık katsayılar */
export async function calculateIseAlmama(
  brutUcret: number,
  signal?: AbortSignal
): Promise<IseAlmamaRow[]> {
  const res = await apiClient("/api/ise-almama/calculate", {
    method: "POST",
    body: JSON.stringify({ brutUcret }),
    signal,
  });

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Beklenmeyen yanıt formatı");
  }

  const data = await res.json();
  if (!data.success || !data.data?.rows) {
    throw new Error(data.error || "Hesaplama yapılamadı");
  }

  return data.data.rows as IseAlmamaRow[];
}
