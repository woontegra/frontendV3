import { apiPost } from "@/utils/apiClient";
import type { KotuCalculateApiResponse, KotuTotals } from "./contract";

const ROUTES = {
  CALCULATE: "/api/kotu-niyet/calculate",
} as const;

export async function calculateKotuNiyetApi(
  totals: KotuTotals,
  year: number
): Promise<KotuCalculateApiResponse> {
  const response = await apiPost(ROUTES.CALCULATE, { totals, year });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error:
        (errorData as { error?: string; message?: string }).error ||
        (errorData as { message?: string }).message ||
        `HTTP ${response.status}`,
    };
  }

  return (await response.json()) as KotuCalculateApiResponse;
}
