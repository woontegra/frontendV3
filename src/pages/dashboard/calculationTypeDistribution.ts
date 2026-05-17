import { normalizePieType } from "./calculationTypeLabels";

export const SMALL_CATEGORY_SHARE = 0.03;
export const BAR_CHART_MIN_CATEGORIES = 5;

export type CalculationTypeDistributionItem = {
  name: string;
  value: number;
  percent: number;
  labelText: string;
};

type CaseLike = {
  type?: string | null;
  hesaplama_tipi?: string | null;
};

/**
 * Kayıtlı hesaplamalardan tür dağılımı: büyükten küçüğe, %3 altı → "Diğer".
 */
export function buildCalculationTypeDistribution(
  cases: CaseLike[],
): CalculationTypeDistributionItem[] {
  const counts: Record<string, number> = {};

  cases.forEach((item) => {
    const key = normalizePieType(item.type || item.hesaplama_tipi || "Diğer");
    counts[key] = (counts[key] || 0) + 1;
  });

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return [];
  }

  const sorted = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const kept: Array<{ name: string; value: number }> = [];
  let otherSum = 0;

  for (const entry of sorted) {
    const share = entry.value / total;
    if (share < SMALL_CATEGORY_SHARE) {
      otherSum += entry.value;
    } else {
      kept.push(entry);
    }
  }

  if (otherSum > 0) {
    const otherIndex = kept.findIndex((row) => row.name === "Diğer");
    if (otherIndex >= 0) {
      kept[otherIndex] = {
        name: "Diğer",
        value: kept[otherIndex].value + otherSum,
      };
    } else {
      kept.push({ name: "Diğer", value: otherSum });
    }
    kept.sort((a, b) => b.value - a.value);
  }

  return kept.map(({ name, value }) => {
    const percent = (value / total) * 100;
    const countLabel = value.toLocaleString("tr-TR");
    return {
      name,
      value,
      percent,
      labelText: `${countLabel} adet`,
    };
  });
}

export function shouldUseDistributionBarChart(itemCount: number): boolean {
  return itemCount > BAR_CHART_MIN_CATEGORIES;
}

export function distributionChartHeight(itemCount: number, mode: "bar" | "donut"): number {
  if (mode === "donut") {
    return 280;
  }
  // Satır başına ~30px + üst/alt boşluk; fazla uzamadan okunaklı yükseklik
  return Math.min(360, Math.max(260, itemCount * 30 + 28));
}
