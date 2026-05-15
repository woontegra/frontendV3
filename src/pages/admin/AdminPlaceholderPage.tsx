import styles from "./AdminPlaceholderPage.module.css";

type Props = {
  title: string;
  description?: string;
};

export default function AdminPlaceholderPage({ title, description }: Props) {
  return (
    <section className={styles.page}>
      <h1>{title}</h1>
      <p>{description ?? `${title} yönetim sayfası V3'e taşınacak.`}</p>
    </section>
  );
}
