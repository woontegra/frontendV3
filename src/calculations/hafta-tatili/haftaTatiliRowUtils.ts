import type { FazlaMesaiRowBase } from "@modules/fazla-mesai/shared";
import type { HaftaTatiliTableRow } from "./state";

export function parseTRDateToISO(value: string): string {
  const v = (value || "").trim();
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function extractPeriodISO(period: string): { startISO: string; endISO: string } {
  const [startPart, endPart] = String(period || "").split("-").map((s) => s.trim());
  return {
    startISO: parseTRDateToISO(startPart || ""),
    endISO: parseTRDateToISO(endPart || ""),
  };
}

export function newHtRowId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `ht-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function withHtRowIds(rows: HaftaTatiliTableRow[]): HaftaTatiliTableRow[] {
  return rows.map((r) => (r.id && String(r.id).length > 0 ? r : { ...r, id: newHtRowId() }));
}

export function htRowToFmStub(row: HaftaTatiliTableRow): FazlaMesaiRowBase {
  const inferred = extractPeriodISO(row.period);
  const startISO = String(row.startISO || inferred.startISO || "").slice(0, 10);
  const endISO = String(row.endISO || inferred.endISO || "").slice(0, 10);
  const brut = Number(row.wage ?? 0) || 0;
  return {
    id: String(row.id || ""),
    startISO,
    endISO,
    weeks: 1,
    brut,
    wage: brut,
    fmHours: 0,
  };
}
