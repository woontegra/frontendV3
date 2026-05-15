import styles from "./ReportExportButtons.module.css";

type Props = {
  onPrint?: () => void;
  onCopyForWord?: () => Promise<void> | void;
  onPdf?: () => Promise<void> | void;
  onClose?: () => void;
  pdfBusy?: boolean;
};

export default function ReportExportButtons({
  onPrint,
  onCopyForWord,
  onPdf,
  onClose,
  pdfBusy = false,
}: Props) {
  return (
    <div className={styles.toolbar}>
      {onCopyForWord ? (
        <button type="button" className={styles.copyButton} onClick={() => void onCopyForWord()}>
          Word&apos;e Kopyala
        </button>
      ) : null}
      {onPrint ? (
        <button type="button" className={styles.printButton} onClick={onPrint}>
          Yazdır
        </button>
      ) : null}
      {onPdf ? (
        <button type="button" className={styles.pdfButton} onClick={() => void onPdf()} disabled={pdfBusy}>
          {pdfBusy ? "Oluşturuluyor..." : "PDF İndir"}
        </button>
      ) : null}
      {onClose ? (
        <button type="button" className={styles.closeButton} onClick={onClose}>
          Kapat
        </button>
      ) : null}
    </div>
  );
}
