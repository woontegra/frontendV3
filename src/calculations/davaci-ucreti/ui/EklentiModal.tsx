import { useEffect, useMemo, useState } from "react";
import styles from "./EklentiModal.module.css";
import { fmtCurrency, parseNum } from "../engine/format";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  onConfirm: (value: number) => void;
  months?: string[];
  onMonthsChange?: (index: number, value: string) => void;
};

export default function EklentiModal({
  open,
  title = "Eklenti hesaplama",
  onClose,
  onConfirm,
  months,
  onMonthsChange,
}: Props) {
  const [internalMonths, setInternalMonths] = useState<string[]>(Array.from({ length: 12 }, () => ""));
  const using = months ?? internalMonths;

  useEffect(() => {
    if (!open) {
      setInternalMonths(Array.from({ length: 12 }, () => ""));
    }
  }, [open]);

  const sum = useMemo(
    () => using.reduce((acc, value) => acc + parseNum(value), 0),
    [using],
  );
  const result = useMemo(() => (sum / 360) * 30, [sum]);

  const handleChange = (index: number, value: string) => {
    if (onMonthsChange) {
      onMonthsChange(index, value);
      return;
    }

    setInternalMonths((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.backdrop} onClick={onClose} aria-label="Kapat" />
      <div className={styles.card} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2>{title}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.grid}>
          {using.map((value, index) => (
            <label key={index} className={styles.monthField}>
              <span>{index + 1}. ay</span>
              <input
                value={value}
                onChange={(event) => handleChange(index, event.target.value)}
                placeholder="1.250,00"
              />
            </label>
          ))}
        </div>

        <p className={styles.formula}>Formül: (aylık toplam / 360) × 30</p>
        <p className={styles.result}>Sonuç: {fmtCurrency(result)} ₺</p>

        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            İptal
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              onConfirm(result || 0);
              onClose();
            }}
          >
            Uygula
          </button>
        </div>
      </div>
    </div>
  );
}
