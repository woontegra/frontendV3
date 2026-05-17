import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./MetinHesaplamasiAccordion.module.css";

type Props = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Fazla mesai sayfalarında ortak "Metin Hesaplaması" bölümü — varsayılan kapalı, kapalıyken hafif kırmızı vurgu.
 */
export function MetinHesaplamasiAccordion({ children, className, contentClassName }: Props) {
  return (
    <section className={cn(styles.section, className)}>
      <details className={styles.details}>
        <summary className={styles.summary}>
          <span className={styles.summaryText}>
            <span className={styles.title}>Metin Hesaplaması</span>
            <span className={styles.hint}>Metin üzerinden hesaplama yapmak için tıklayın</span>
          </span>
          <ChevronDown className={styles.chevron} aria-hidden />
        </summary>
        <div className={cn(styles.content, contentClassName)}>{children}</div>
      </details>
    </section>
  );
}
