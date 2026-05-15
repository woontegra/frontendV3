export function parseNum(value: string): number {
  return Number(String(value).replace(/\./g, "").replace(",", ".")) || 0;
}

export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}
