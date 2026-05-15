import { useLocation } from "react-router-dom";
import { getCalculationModuleByPathname } from "@/calculations/registry";
import styles from "./CalculationMigrationPlaceholderPage.module.css";

export default function CalculationMigrationPlaceholderPage() {
  const { pathname } = useLocation();
  const mod = getCalculationModuleByPathname(pathname);
  const title = mod?.label ?? "Hesaplama";

  return (
    <section className={styles.page}>
      <h1>{title}</h1>
      <p>
        Bu modülün tam hesaplama ekranı henüz V3’e taşınmadı. Şu an V3’te tam ekran olan örnekler:{" "}
        <strong>Ayrımcılık Tazminatı</strong> ve <strong>Haksız Fesih Tazminatı</strong>. Diğer başlıklar sırayla
        eklenecek; gerekirse geçici olarak V2 arayüzünü kullanmaya devam edebilirsiniz.
      </p>
    </section>
  );
}
