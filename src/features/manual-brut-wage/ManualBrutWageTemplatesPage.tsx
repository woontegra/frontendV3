import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/context/ToastContext";
import {
  addManualWageTemplate,
  deleteManualWageTemplate,
  findManualWagePeriodFloorViolations,
  formatManualWageFloorViolationMessage,
  formatManualWagePeriodLabel,
  getManualWagePeriodCatalogByYear,
  getManualWageTemplateById,
  loadAllManualWageTemplates,
  type ManualWageCatalogPeriod,
  type ManualWagePeriodsMap,
  updateManualWageTemplate,
} from "@/utils/manualWageTemplateStorage";
import styles from "./ManualBrutWageTemplatesPage.module.css";

function parseMoneyInput(value: string): number {
  const normalized = String(value).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyInput(value: number): string {
  if (!value || !Number.isFinite(value)) {
    return "";
  }
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPeriodFloorError(
  year: number,
  indexInYear: number,
  totalInYear: number,
  floorBrut: number,
): string {
  const label = formatManualWagePeriodLabel(year, indexInYear, totalInYear);
  const floor = floorBrut.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${label} için brüt ücret ${floor} TL'den az olamaz.`;
}

function collectPeriodFloorErrors(
  catalog: ReturnType<typeof getManualWagePeriodCatalogByYear>,
  periodInputs: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const { year, periods } of catalog) {
    for (const period of periods) {
      const raw = periodInputs[period.key];
      if (!raw?.trim()) {
        continue;
      }
      const amount = parseMoneyInput(raw);
      if (amount > 0 && amount < period.floorBrut) {
        next[period.key] = formatPeriodFloorError(year, period.indexInYear, periods.length, period.floorBrut);
      }
    }
  }
  return next;
}

export default function ManualBrutWageTemplatesPage() {
  const { success, error } = useToast();
  const catalog = useMemo(() => getManualWagePeriodCatalogByYear(), []);
  const [templates, setTemplates] = useState(() => loadAllManualWageTemplates());
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);
  const [name, setName] = useState(templates[0]?.name ?? "");
  const [periodInputs, setPeriodInputs] = useState<Record<string, string>>({});
  const [periodErrors, setPeriodErrors] = useState<Record<string, string>>({});

  const reloadTemplates = useCallback(() => {
    const list = loadAllManualWageTemplates();
    setTemplates(list);
    return list;
  }, []);

  const loadEditor = useCallback((id: string | null) => {
    if (!id) {
      setName("");
      setPeriodInputs({});
      setPeriodErrors({});
      return;
    }
    const tmpl = getManualWageTemplateById(id);
    if (!tmpl) {
      setName("");
      setPeriodInputs({});
      setPeriodErrors({});
      return;
    }
    setName(tmpl.name);
    const next: Record<string, string> = {};
    for (const [key, amount] of Object.entries(tmpl.periods)) {
      next[key] = formatMoneyInput(amount);
    }
    setPeriodInputs(next);
    setPeriodErrors({});
  }, []);

  useEffect(() => {
    loadEditor(selectedId);
  }, [selectedId, loadEditor]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleNew = () => {
    setSelectedId(null);
    setName("");
    setPeriodInputs({});
    setPeriodErrors({});
  };

  const handlePeriodChange = (key: string, value: string) => {
    setPeriodInputs((prev) => ({ ...prev, [key]: value }));
    setPeriodErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handlePeriodBlur = (
    period: ManualWageCatalogPeriod,
    year: number,
    totalInYear: number,
    raw: string,
  ) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setPeriodErrors((prev) => {
        if (!prev[period.key]) {
          return prev;
        }
        const next = { ...prev };
        delete next[period.key];
        return next;
      });
      return;
    }
    const amount = parseMoneyInput(trimmed);
    if (amount <= 0) {
      return;
    }
    if (amount < period.floorBrut) {
      const message = formatPeriodFloorError(year, period.indexInYear, totalInYear, period.floorBrut);
      setPeriodErrors((prev) => ({ ...prev, [period.key]: message }));
      error("Asgari ücretin altında", message);
      return;
    }
    setPeriodErrors((prev) => {
      if (!prev[period.key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[period.key];
      return next;
    });
  };

  const buildPeriodsMap = (): ManualWagePeriodsMap => {
    const out: ManualWagePeriodsMap = {};
    for (const [key, raw] of Object.entries(periodInputs)) {
      const amount = parseMoneyInput(raw);
      if (amount > 0) {
        out[key] = amount;
      }
    }
    return out;
  };

  const handleSave = () => {
    const periods = buildPeriodsMap();
    const floorErrors = collectPeriodFloorErrors(catalog, periodInputs);
    if (Object.keys(floorErrors).length > 0) {
      setPeriodErrors(floorErrors);
      error("Asgari ücretin altında", Object.values(floorErrors)[0]);
      return;
    }
    setPeriodErrors({});
    if (!name.trim()) {
      error("Şablon adı gerekli", "Kaydetmeden önce bir isim verin.");
      return;
    }
    if (Object.keys(periods).length === 0) {
      error("En az bir dönem ücreti girin", "2010–2026 aralığından en az bir brüt değer doldurulmalı.");
      return;
    }
    const violations = findManualWagePeriodFloorViolations(periods);
    if (violations.length > 0) {
      error("Asgari ücretin altında", formatManualWageFloorViolationMessage(violations[0]));
      return;
    }

    if (selectedId) {
      const ok = updateManualWageTemplate(selectedId, name, periods);
      if (!ok) {
        error("Kaydedilemedi", "Aynı isimde başka şablon olabilir veya şablon silinmiş olabilir.");
        return;
      }
      success("Şablon güncellendi");
      reloadTemplates();
      return;
    }

    const created = addManualWageTemplate(name, periods);
    if (!created) {
      error("Kaydedilemedi", "Aynı isimde şablon var veya geçerli ücret girilmedi.");
      return;
    }
    const list = reloadTemplates();
    setSelectedId(created.id);
    loadEditor(created.id);
    success("Şablon kaydedildi");
  };

  const handleDelete = () => {
    if (!selectedId) {
      return;
    }
    deleteManualWageTemplate(selectedId);
    const list = reloadTemplates();
    const next = list[0]?.id ?? null;
    setSelectedId(next);
    loadEditor(next);
    success("Şablon silindi");
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Manuel Brüt Ücret Şablonları</h1>
        <p>
          Asgari ücret kullanmayan işçiler için 2010–2026 dönem brüt ücretlerini kaydedin. Altı aylık asgari dönemlerde
          yıl başına iki alan açılır.
        </p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            <h2>Kayıtlı şablonlar</h2>
            <button type="button" onClick={handleNew} className={styles.newButton}>
              Yeni
            </button>
          </div>
          {templates.length === 0 ? (
            <p className={styles.emptyList}>Henüz şablon yok.</p>
          ) : (
            <ul className={styles.templateList}>
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={selectedId === t.id ? styles.templateActive : styles.templateItem}
                    onClick={() => handleSelect(t.id)}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={styles.editor}>
          <label className={styles.fieldLabel} htmlFor="manual-wage-template-name">
            Şablon adı
          </label>
          <input
            id="manual-wage-template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.textInput}
            placeholder="Örn. Davacı A — fabrika ücretleri"
          />

          <div className={styles.periodGrid}>
            {catalog.map(({ year, periods }) => (
              <div key={year} className={styles.yearBlock}>
                <h3>{year}</h3>
                <div className={styles.yearInputs}>
                  {periods.map((period) => (
                    <label key={period.key} className={styles.periodField}>
                      <span>
                        {formatManualWagePeriodLabel(year, period.indexInYear, periods.length)}
                        <small>
                          Asgari: {period.floorBrut.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                        </small>
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={periodInputs[period.key] ?? ""}
                        onChange={(e) => handlePeriodChange(period.key, e.target.value)}
                        onBlur={(e) =>
                          handlePeriodBlur(period, year, periods.length, e.currentTarget.value)
                        }
                        className={
                          periodErrors[period.key]
                            ? `${styles.periodInput} ${styles.periodInputError}`
                            : styles.periodInput
                        }
                        placeholder="Brüt ücret"
                        aria-invalid={periodErrors[period.key] ? true : undefined}
                      />
                      {periodErrors[period.key] ? (
                        <span className={styles.periodErrorText}>{periodErrors[period.key]}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={handleSave} className={styles.saveButton}>
              {selectedId ? "Güncelle" : "Kaydet"}
            </button>
            {selectedId ? (
              <button type="button" onClick={handleDelete} className={styles.deleteButton}>
                Sil
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
