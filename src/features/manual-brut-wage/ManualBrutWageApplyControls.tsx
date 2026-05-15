import { useCallback, useMemo, useState } from "react";
import type { FazlaMesaiRowBase } from "@modules/fazla-mesai/shared";
import {
  applyManualWagePeriodsToRowBruts,
  countFilledPeriods,
  formatPeriodRangeLabelFromKey,
  getManualWageTemplateById,
  isManualWageTemplateNonEmpty,
  loadAllManualWageTemplates,
} from "@/utils/manualWageTemplateStorage";
import styles from "./ManualBrutWageApplyControls.module.css";

export type ManualBrutWageApplyControlsProps = {
  rows: FazlaMesaiRowBase[];
  onApplyBrutsByRowId: (brutById: Record<string, number>) => void;
  /** Şablondan uygulanmış manuel brüt aktifken ana düğüm tekrar tıklanınca kaldırılır. */
  manualBrutActive?: boolean;
  onDeactivateManualBrut?: () => void;
  success: (title: string, description?: string) => void;
  error?: (title: string, description?: string) => void;
};

export function ManualBrutWageApplyControls({
  rows,
  onApplyBrutsByRowId,
  manualBrutActive = false,
  onDeactivateManualBrut,
  success,
  error,
}: ManualBrutWageApplyControlsProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const templatesList = useMemo(() => (showModal ? loadAllManualWageTemplates() : []), [showModal]);

  const openModal = useCallback(() => {
    const list = loadAllManualWageTemplates();
    setSelectedTemplateId((prev) => (list.some((t) => t.id === prev) ? prev : list[0]?.id ?? ""));
    setShowModal(true);
  }, []);

  const handleMainButtonClick = useCallback(() => {
    if (manualBrutActive) {
      onDeactivateManualBrut?.();
      success("Manuel ücret kaldırıldı", "Brüt ücretler satır tarihlerine göre asgari ücrete döner.");
      return;
    }
    openModal();
  }, [manualBrutActive, onDeactivateManualBrut, success, openModal]);

  const handleApply = useCallback(() => {
    const tmpl = getManualWageTemplateById(selectedTemplateId);
    const periods = tmpl?.periods;
    if (!periods || !Object.keys(periods).length) {
      error?.("Manuel ücret şablonu bulunamadı.", "Silinmiş veya geçersiz şablon.");
      return;
    }
    const stubs = rows.map((r) => ({ id: r.id, startISO: r.startISO }));
    const { brutById, applied, skipped } = applyManualWagePeriodsToRowBruts(periods, stubs);
    onApplyBrutsByRowId(brutById);
    success(`${applied} satıra manuel ücret aktarıldı, ${skipped} satırda uygun ücret bulunamadı.`);
    setShowModal(false);
  }, [rows, selectedTemplateId, onApplyBrutsByRowId, success, error]);

  const previewRows = useMemo(() => {
    if (!showModal || !selectedTemplateId) {
      return [] as { key: string; label: string; amount: number }[];
    }
    const tmpl = getManualWageTemplateById(selectedTemplateId);
    const t = tmpl?.periods ?? {};
    return Object.entries(t)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v > 0)
      .map(([key, amount]) => ({
        key,
        label: formatPeriodRangeLabelFromKey(key),
        amount: amount as number,
      }));
  }, [showModal, selectedTemplateId]);

  return (
    <>
      <div className={styles.bar}>
        <p className={styles.hint}>
          Kayıtlı şablondaki dönem brüt ücretlerini tablodaki eşleşen satırlara uygular. Diğer alanlar değişince
          manuel ücretler korunur. Manuel brüt aktifken aynı düğmeye tekrar basarak asgari ücrete dönebilirsiniz.
        </p>
        <button
          type="button"
          onClick={handleMainButtonClick}
          className={`${styles.trigger} ${manualBrutActive ? styles.triggerActive : ""}`}
          title={manualBrutActive ? "Manuel brütü kaldır, asgari ücrete dön" : "Şablondan manuel brüt uygula"}
        >
          {manualBrutActive ? "Asgari ücrete dön" : "Manuel Ücret Kullan"}
        </button>
      </div>

      {showModal ? (
        <div className={styles.overlay} onClick={() => setShowModal(false)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <h2>Manuel Ücret Şablonu</h2>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                Tablodaki satır başlangıç tarihine göre asgari ücret dönemi eşleşir; yalnızca brüt ücret güncellenir.
              </p>
              {!isManualWageTemplateNonEmpty() ? (
                <p className={styles.empty}>
                  Önce Hızlı Araçlar {">"} Manuel Brüt Ücret Şablonu alanından ücretleri kaydedin.
                </p>
              ) : (
                <>
                  <label className={styles.fieldLabel} htmlFor="manual-wage-template-select">
                    İçe aktarılacak şablon
                  </label>
                  <select
                    id="manual-wage-template-select"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className={styles.select}
                  >
                    {templatesList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {previewRows.length === 0 ? (
                    <p className={styles.muted}>Bu şablonda tanımlı dönem ücreti yok.</p>
                  ) : (
                    <div className={styles.previewTableWrap}>
                      <table className={styles.previewTable}>
                        <thead>
                          <tr>
                            <th>Dönem</th>
                            <th>Brüt ücret (TL)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map(({ key, label, amount }) => (
                            <tr key={key}>
                              <td>{label}</td>
                              <td>
                                {amount.toLocaleString("tr-TR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                disabled={
                  !isManualWageTemplateNonEmpty() ||
                  !selectedTemplateId ||
                  countFilledPeriods(getManualWageTemplateById(selectedTemplateId)?.periods ?? {}) === 0
                }
                onClick={handleApply}
                className={styles.applyButton}
              >
                Tabloya Aktar
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setShowModal(false)} className={styles.closeButton}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
