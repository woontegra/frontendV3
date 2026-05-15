import { apiClient } from "@/api/apiClient";
import type { DavaciUcretiSaveData } from "../contract";
import { DAVACI_UCRETI_TYPE as CALCULATION_TYPE } from "../contract";

export async function loadSavedCase(caseId: string): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  name?: string;
  error?: string;
}> {
  try {
    const result = await apiClient<{ type?: string; data?: Record<string, unknown>; name?: string }>(
      `/api/saved-cases/${caseId}`,
    );

    if (result.type && result.type !== CALCULATION_TYPE) {
      return {
        success: false,
        error: `Bu kayıt farklı bir hesap türüne ait (${result.type})`,
      };
    }

    return {
      success: true,
      data: result.data ?? (result as Record<string, unknown>),
      name: result.name,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kayıt yüklenemedi";
    return { success: false, error: message };
  }
}

export async function saveSavedCase(
  payload: DavaciUcretiSaveData,
  recordName: string,
  existingId?: string,
): Promise<{ id: number; name: string }> {
  const validId =
    existingId &&
    existingId !== "" &&
    existingId !== "undefined" &&
    !Number.isNaN(Number(existingId)) &&
    Number(existingId) > 0
      ? Number(existingId)
      : null;

  const endpoint = validId ? `/api/saved-cases/${validId}` : "/api/saved-cases";
  const method = validId ? "PUT" : "POST";

  const result = await apiClient<{ id: number; name?: string }>(endpoint, {
    method,
    body: JSON.stringify({
      name: recordName,
      type: CALCULATION_TYPE,
      data: {
        ...payload.data,
        brut_total: payload.brut_total,
        net_total: payload.net_total,
      },
    }),
  });

  return {
    id: result.id || validId || 0,
    name: result.name || recordName,
  };
}
