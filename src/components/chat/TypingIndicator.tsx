import styles from "./TypingIndicator.module.css";

type Props = {
  label: string;
  className?: string;
};

export default function TypingIndicator({ label, className }: Props) {
  return (
    <p className={[styles.typing, className].filter(Boolean).join(" ")} aria-live="polite">
      <span>{label}</span>
      <span className={styles.dots} aria-hidden>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </span>
    </p>
  );
}
