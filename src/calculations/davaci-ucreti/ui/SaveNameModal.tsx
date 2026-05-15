import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./SaveNameModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
  isLoading?: boolean;
  title: string;
  description?: string;
  fieldLabel?: string;
  placeholder?: string;
  saveLabel?: string;
  loadingLabel?: string;
};

export default function SaveNameModal({
  open,
  onClose,
  onSave,
  isLoading = false,
  title,
  description,
  fieldLabel,
  placeholder,
  saveLabel = "Kaydet",
  loadingLabel = "Kaydediliyor...",
}: Props) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isLoading, onClose, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isLoading) {
      return;
    }
    void onSave(trimmed);
  };

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <form
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-name-modal-title"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="save-name-modal-title">{title}</h2>
          {description ? <p>{description}</p> : null}
        </header>

        <div className={styles.fieldBlock}>
          {fieldLabel ? <label htmlFor="save-name-input">{fieldLabel}</label> : null}
          <input
            id="save-name-input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={placeholder}
            autoFocus
            disabled={isLoading}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isLoading}>
            İptal
          </button>
          <button type="submit" className={styles.saveButton} disabled={!name.trim() || isLoading}>
            {isLoading ? loadingLabel : saveLabel}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
