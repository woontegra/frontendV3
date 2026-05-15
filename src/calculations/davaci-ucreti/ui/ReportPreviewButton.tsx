import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { copyTableForWord } from "../report/copyTableForWord";
import { downloadPdfFromDOM } from "../report/pdfExport";
import { printFromModal } from "../report/printReport";
import ReportExportButtons from "./ReportExportButtons";
import styles from "./ReportPreviewButton.module.css";

type Props = {
  title: string;
  renderContent: () => ReactNode;
  copyTargetId: string;
  buttonClassName?: string;
  onPdf?: () => Promise<void> | void;
};

function PreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 7h6m-6 4h6m-6 4h4M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
      />
    </svg>
  );
}

export default function ReportPreviewButton({
  title,
  renderContent,
  copyTargetId,
  buttonClassName,
  onPdf,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handlePrint = () => {
    printFromModal(title, copyTargetId);
  };

  const handleCopyForWord = async () => {
    await copyTableForWord(copyTargetId);
  };

  const handleDownloadPdf = async () => {
    try {
      setPdfBusy(true);
      if (onPdf) {
        await onPdf();
        return;
      }
      await downloadPdfFromDOM(title, copyTargetId);
    } catch (error) {
      console.error("PDF generation error:", error);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <PreviewIcon />
        <span>Önizleme</span>
      </button>

      {open
        ? createPortal(
            <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
              <div className={styles.modal}>
                <div className={styles.header}>
                  <h2>{title}</h2>
                  <ReportExportButtons
                    onPrint={handlePrint}
                    onCopyForWord={handleCopyForWord}
                    onPdf={handleDownloadPdf}
                    onClose={() => setOpen(false)}
                    pdfBusy={pdfBusy}
                  />
                </div>
                <div className={styles.body}>
                  <div id="report-modal-content" className={styles.content}>
                    {renderContent()}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
