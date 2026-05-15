import { apiClient } from "@/api/apiClient";
import type { ExtraItem } from "../contract";

export interface SavedExtraCalculationsSet {
  id: number;
  name: string;
  data: ExtraItem[];
  createdAt?: string;
}

export async function getAllExtraCalculationsSets(): Promise<SavedExtraCalculationsSet[]> {
  try {
    const data = await apiClient<SavedExtraCalculationsSet[]>("/api/extra-calculations-sets");
    return data ?? [];
  } catch (error) {
    console.error("Ekstra hesaplama setleri yüklenemedi:", error);
    return [];
  }
}

export async function saveExtraCalculationsSet(name: string, data: ExtraItem[]): Promise<boolean> {
  try {
    await apiClient("/api/extra-calculations-sets", {
      method: "POST",
      body: JSON.stringify({ name, data }),
    });
    return true;
  } catch (error) {
    console.error("Ekstra hesaplama seti kaydedilemedi:", error);
    return false;
  }
}

export async function loadExtraCalculationsSet(name: string): Promise<ExtraItem[]> {
  const sets = await getAllExtraCalculationsSets();
  return sets.find((set) => set.name === name)?.data ?? [];
}

export async function deleteExtraCalculationsSet(id: number): Promise<boolean> {
  try {
    await apiClient(`/api/extra-calculations-sets/${id}`, {
      method: "DELETE",
    });
    return true;
  } catch (error) {
    console.error("Ekstra hesaplama seti silinemedi:", error);
    return false;
  }
}
