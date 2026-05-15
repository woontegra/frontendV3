import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Plus, Save } from "lucide-react";
import ReportPreviewButton from "./ReportPreviewButton";
import styles from "./PageActionBar.module.css";

export type PagePreviewConfig = {
  title: string;
  copyTargetId: string;
  renderContent: () => ReactNode;
  onPdf?: () => Promise<void> | void;
};

type Props = {
  preview?: PagePreviewConfig;
  onNew: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveButtonProps?: Pick<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "title">;
  versionLabel?: string;
  productLabel?: string;
  previewLabel?: string;
  newLabel?: string;
  leftContent?: ReactNode;
  /** true iken sol marka sütunu gösterilmez (yan menüdeki footer ile tekrar etmesin) */
  hideBrandColumn?: boolean;
};

export default function PageActionBar({
  preview,
  onNew,
  onSave,
  saveLabel = "Kaydet",
  saveButtonProps,
  versionLabel = "Sürüm 3.0",
  productLabel = "Bilirkişi Hesaplama Araçları",
  previewLabel = "Önizleme",
  newLabel = "Yeni Hesapla",
  leftContent,
  hideBrandColumn = false,
}: Props) {
  const previewButtonClass = `${styles.actionButton} ${styles.previewButton}`;

  return (
    <footer className={styles.bar}>
      {!hideBrandColumn ? (
        <div className={styles.meta}>
          {leftContent ?? (
            <>
              <strong>{productLabel}</strong>
              <span>{versionLabel}</span>
            </>
          )}
        </div>
      ) : null}

      <div className={styles.actions}>
        {preview ? (
          <ReportPreviewButton
            title={preview.title}
            copyTargetId={preview.copyTargetId}
            renderContent={preview.renderContent}
            onPdf={preview.onPdf}
            buttonClassName={previewButtonClass}
          />
        ) : null}

        <button type="button" className={`${styles.actionButton} ${styles.newButton}`} onClick={onNew}>
          <Plus className={styles.icon} aria-hidden />
          <span>{newLabel}</span>
        </button>

        <button
          type="button"
          className={`${styles.actionButton} ${styles.saveButton}`}
          onClick={onSave}
          disabled={saveButtonProps?.disabled}
          title={saveButtonProps?.title ?? saveLabel}
        >
          <Save className={styles.icon} aria-hidden />
          <span>{saveLabel}</span>
        </button>
      </div>
    </footer>
  );
}
