import type { ExtraItem } from "../contract";
import { parseNum } from "./format";

export function calculateTotalBrut(ciplakBrut: string, extraItems: ExtraItem[]): number {
  const base = parseNum(ciplakBrut);
  const extras = extraItems.reduce((sum, item) => sum + parseNum(item.value), 0);
  return base + extras;
}
