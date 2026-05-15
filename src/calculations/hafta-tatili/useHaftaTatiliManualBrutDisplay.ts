import { useCallback, useEffect, useMemo, useState } from "react";
import type { FazlaMesaiRowBase } from "@modules/fazla-mesai/shared";
import {
  applyResolvedManualBrutToRows,
  applyStoredManualBrutOverridesToRows,
  clearAllManualBrutFromRowOverrides,
  mergeManualWageBrutsIntoRowOverrides,
} from "@/utils/fazlaMesai/fmManualWageRowOverrides";
import type { HaftaTatiliTableRow } from "./state";
import { withHtRowIds, htRowToFmStub } from "./haftaTatiliRowUtils";

/**
 * Hafta tatili cetvel satırlarında manuel brüt (şablon) çözümlemesi — UBGT / FM ile aynı `rowOverrides` modeli.
 */
export function useHaftaTatiliManualBrutDisplay(
  haftaTatiliRows: HaftaTatiliTableRow[],
  recalcRow: (row: HaftaTatiliTableRow) => HaftaTatiliTableRow,
) {
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<FazlaMesaiRowBase>>>({});

  const fmStubs = useMemo(
    () => withHtRowIds(haftaTatiliRows).map(htRowToFmStub),
    [haftaTatiliRows],
  );

  const effectiveRowOverrides = useMemo(
    () => applyStoredManualBrutOverridesToRows(rowOverrides, fmStubs),
    [rowOverrides, fmStubs],
  );

  useEffect(() => {
    if (!fmStubs.length) return;
    setRowOverrides((prev) => applyStoredManualBrutOverridesToRows(prev, fmStubs));
  }, [fmStubs]);

  const resolvedFmRows = useMemo(
    () => applyResolvedManualBrutToRows(fmStubs, effectiveRowOverrides),
    [fmStubs, effectiveRowOverrides],
  );

  const displayHtRows = useMemo(() => {
    const base = withHtRowIds(haftaTatiliRows);
    return base.map((row, i) => {
      const w = Number(resolvedFmRows[i]?.wage ?? resolvedFmRows[i]?.brut ?? row.wage ?? 0) || 0;
      return recalcRow({ ...row, wage: w });
    });
  }, [haftaTatiliRows, resolvedFmRows, recalcRow]);

  const manualBrutActive = useMemo(
    () =>
      Object.values(rowOverrides).some(
        (v) =>
          v &&
          typeof v === "object" &&
          (v as { brutManual?: boolean }).brutManual === true &&
          typeof (v as { brut?: number }).brut === "number" &&
          (v as { brut: number }).brut > 0,
      ),
    [rowOverrides],
  );

  const handleDeactivateManualBrut = useCallback(() => {
    setRowOverrides((prev) => clearAllManualBrutFromRowOverrides(prev));
  }, []);

  const handleApplyManualWageBruts = useCallback(
    (brutById: Record<string, number>) => {
      setRowOverrides((prev) =>
        mergeManualWageBrutsIntoRowOverrides(prev, brutById, resolvedFmRows as FazlaMesaiRowBase[]),
      );
    },
    [resolvedFmRows],
  );

  return {
    rowOverrides,
    setRowOverrides,
    resolvedFmRows,
    displayHtRows,
    manualBrutActive,
    handleDeactivateManualBrut,
    handleApplyManualWageBruts,
  };
}
