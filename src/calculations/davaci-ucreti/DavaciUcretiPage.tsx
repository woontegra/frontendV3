import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { handleLoadCalculation, prepareSaveData } from "./actions";
import {
  deleteExtraCalculationsSet,
  getAllExtraCalculationsSets,
  loadExtraCalculationsSet,
  saveExtraCalculationsSet,
} from "./api/extraSets";
import { buildReportSections } from "./report/buildReportSections";
import { copySectionForWord } from "./report/copyTableForWord";
import { downloadPdfFromDOM } from "./report/pdfExport";
import { saveSavedCase } from "./api/savedCases";
import { hasTwoPeriods } from "./engine/asgariWage";
import { fmtCurrency } from "./engine/format";
import {
  deriveAsgariUcretError,
  deriveGrossFromNet,
  deriveNetFromGross,
  deriveTotalBrut,
} from "./model/deriveResults";
import { useDavaciUcretiState } from "./state";
import EklentiModal from "./ui/EklentiModal";
import PageActionBar from "./ui/PageActionBar";
import SaveNameModal from "./ui/SaveNameModal";
import { DeductionBreakdown } from "./ui/DeductionBreakdown";
import { ToastProvider, useToast } from "./ui/toast";
import styles from "./DavaciUcretiPage.module.css";

const PAGE_TITLE = "Davacı Ücreti Hesaplama";

function DavaciUcretiPageContent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const { success, error: showError } = useToast();

  const {
    ciplakBrut,
    setCiplakBrut,
    extraItems,
    setExtraItems,
    notes,
    setNotes,
    currentRecordName,
    setCurrentRecordName,
    selectedYear,
    setSelectedYear,
    selectedPeriod,
    setSelectedPeriod,
    showImportModal,
    setShowImportModal,
    showSaveModal,
    setShowSaveModal,
    savedSets,
    setSavedSets,
    activeModal,
    setActiveModal,
    eklentiValues,
    setEklentiValues,
    netForGross,
    setNetForGross,
    isSaving,
    setIsSaving,
    currentYear,
    createDefaultExtraItems,
  } = useDavaciUcretiState();

  const [showCaseSaveModal, setShowCaseSaveModal] = useState(false);

  const totalBrut = useMemo(
    () => deriveTotalBrut(ciplakBrut, extraItems),
    [ciplakBrut, extraItems],
  );
  const netFromGross = useMemo(
    () => deriveNetFromGross(totalBrut, selectedYear, selectedPeriod),
    [totalBrut, selectedYear, selectedPeriod],
  );
  const grossFromNet = useMemo(
    () => deriveGrossFromNet(netForGross, selectedYear, selectedPeriod),
    [netForGross, selectedYear, selectedPeriod],
  );
  const asgariUcretHatasi = useMemo(
    () => deriveAsgariUcretError(ciplakBrut, selectedYear, selectedPeriod),
    [ciplakBrut, selectedYear, selectedPeriod],
  );
  const hasTwoPeriodsForYear = useMemo(() => hasTwoPeriods(selectedYear), [selectedYear]);
  const wordTableSections = useMemo(
    () =>
      buildReportSections({
        selectedYear,
        ciplakBrut,
        extraItems,
        totalBrut,
        netFromGross,
        grossFromNet,
        notes,
      }),
    [ciplakBrut, extraItems, grossFromNet, netFromGross, notes, selectedYear, totalBrut],
  );

  const renderPreviewContent = useCallback(
    () => (
      <div id="davaci-word-copy">
        {wordTableSections.map((section) => (
          <div key={section.id} className="report-section-copy report-section" data-section={section.id}>
            <div className="section-header">
              <span className="section-title">{section.title}</span>
              <button
                type="button"
                className="copy-icon-btn"
                onClick={async () => {
                  const copied = await copySectionForWord(section.id);
                  if (copied) {
                    success("Kopyalandı");
                  }
                }}
                title="Word'e kopyala"
              >
                <Copy size={14} aria-hidden />
              </button>
            </div>
            <div
              className="section-content"
              dangerouslySetInnerHTML={{ __html: section.html }}
            />
          </div>
        ))}
      </div>
    ),
    [success, wordTableSections],
  );

  const loadCalculation = useCallback(
    async (caseId: string) => {
      const result = await handleLoadCalculation(caseId);
      if (!result) {
        return;
      }

      const formData = result.formData;
      const form = formData.data?.form || formData.form || formData;

      if (form.ciplakBrut) {
        setCiplakBrut(String(form.ciplakBrut));
      }

      if (form.extraItems && Array.isArray(form.extraItems)) {
        setExtraItems(
          form.extraItems.map((item) => ({
            id: item.id || crypto.randomUUID(),
            name: String(item.name || ""),
            value: item.value === undefined || item.value === null ? "" : String(item.value),
          })),
        );
      }

      if (form.selectedYear) {
        const year = Number(form.selectedYear);
        setSelectedYear(year);
        if (!hasTwoPeriods(year)) {
          setSelectedPeriod(2);
        } else if (form.selectedPeriod) {
          setSelectedPeriod(Number(form.selectedPeriod) as 1 | 2);
        }
      } else if (form.selectedPeriod) {
        setSelectedPeriod(Number(form.selectedPeriod) as 1 | 2);
      }

      if (form.notes) {
        setNotes(String(form.notes));
      }

      setCurrentRecordName(result.name || null);
      success("Kayıt yüklendi");
    },
    [
      setCiplakBrut,
      setCurrentRecordName,
      setExtraItems,
      setNotes,
      setSelectedPeriod,
      setSelectedYear,
      success,
    ],
  );

  useEffect(() => {
    if (effectiveId) {
      void loadCalculation(effectiveId);
    }
  }, [effectiveId, loadCalculation]);

  const persistCase = async (recordName: string) => {
    setIsSaving(true);
    try {
      const payload = prepareSaveData(
        ciplakBrut,
        extraItems,
        selectedYear,
        selectedPeriod,
        notes,
        totalBrut,
        netFromGross,
      );
      const saved = await saveSavedCase(payload, recordName, effectiveId);
      success(effectiveId ? "Kayıt güncellendi" : "Kayıt oluşturuldu");
      setCurrentRecordName(saved.name);
      if (!effectiveId && saved.id) {
        navigate(`/davaci-ucreti/${saved.id}`, { replace: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kayıt başarısız";
      showError(message);
    } finally {
      setIsSaving(false);
      setShowCaseSaveModal(false);
    }
  };

  const handleSaveCase = () => {
    if (currentRecordName) {
      void persistCase(currentRecordName);
      return;
    }
    setShowCaseSaveModal(true);
  };

  const handleNew = () => {
    if (effectiveId) {
      navigate("/davaci-ucreti");
    }
    setCiplakBrut("");
    setExtraItems(createDefaultExtraItems());
    setSelectedYear(currentYear);
    setSelectedPeriod(2);
    setNotes("");
    setNetForGross("");
    setCurrentRecordName(null);
  };

  const handleSaveExtra = async (setNameValue: string) => {
    if (!setNameValue.trim()) {
      showError("Lütfen bir isim girin");
      return;
    }
    if (extraItems.length === 0) {
      showError("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }

    const saved = await saveExtraCalculationsSet(setNameValue.trim(), extraItems);
    if (saved) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSavedSets(await getAllExtraCalculationsSets());
      return;
    }
    showError("Kaydetme başarısız");
  };

  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      setExtraItems(data);
      success("Ekstra hesaplamalar yüklendi");
      setShowImportModal(false);
      return;
    }
    showError("Yüklenecek veri bulunamadı");
  };

  const handleDeleteExtra = async (setId: number) => {
    if (!window.confirm("Bu seti silmek istediğinize emin misiniz?")) {
      return;
    }
    const deleted = await deleteExtraCalculationsSet(setId);
    if (deleted) {
      success("Set silindi");
      setSavedSets(await getAllExtraCalculationsSets());
      return;
    }
    showError("Silme başarısız");
  };

  const handleRequestEklenti = (itemId: string) => {
    const fieldKey = `extra:${itemId}`;
    if (!eklentiValues[fieldKey]) {
      setEklentiValues((prev) => ({ ...prev, [fieldKey]: Array(12).fill("") }));
    }
    setActiveModal(fieldKey);
  };

  const handleApplyEklenti = (value: number, fieldKey: string) => {
    const itemId = fieldKey.replace("extra:", "");
    setExtraItems((items) =>
      items.map((item) =>
        item.id === itemId
          ? { ...item, value: String(value.toFixed(2)).replace(".", ",") }
          : item,
      ),
    );
    setActiveModal(null);
  };

  return (
    <div className={styles.workspace}>
      <div className={styles.accent} aria-hidden="true" />

      <div className={styles.inner}>
        {currentRecordName ? <p className={styles.recordName}>{currentRecordName}</p> : null}

        <div className={styles.card}>
        <section className={styles.section}>
          <h2>Temel Bilgiler</h2>
          <div
            className={`${styles.basicGrid} ${
              hasTwoPeriodsForYear ? styles.basicGridWithPeriod : styles.basicGridWithoutPeriod
            }`}
          >
            <label className={styles.field}>
              <span>Yıl</span>
              <select
                value={selectedYear}
                onChange={(event) => {
                  const year = Number(event.target.value);
                  setSelectedYear(year);
                  if (!hasTwoPeriods(year)) {
                    setSelectedPeriod(2);
                  }
                }}
              >
                {Array.from({ length: currentYear - 2009 }, (_, index) => currentYear - index).map(
                  (year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ),
                )}
              </select>
            </label>

            {hasTwoPeriodsForYear ? (
              <label className={styles.field}>
                <span>Dönem</span>
                <select
                  value={selectedPeriod}
                  onChange={(event) => setSelectedPeriod(Number(event.target.value) as 1 | 2)}
                >
                  <option value={1}>Oca-Haz</option>
                  <option value={2}>Tem-Ara</option>
                </select>
              </label>
            ) : null}

            <label
              className={`${styles.field} ${
                hasTwoPeriodsForYear ? styles.ciplakFieldWithPeriod : styles.ciplakFieldWithoutPeriod
              }`}
            >
              <span>Çıplak Brüt (₺)</span>
              <input
                value={ciplakBrut}
                onChange={(event) => setCiplakBrut(event.target.value)}
                placeholder="25.000,00"
                className={asgariUcretHatasi ? styles.inputError : undefined}
              />
              {asgariUcretHatasi ? <p className={styles.errorText}>{asgariUcretHatasi}</p> : null}
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Ekstra Hesaplamalar</h2>
            <div className={styles.inlineActions}>
              <button
                type="button"
                onClick={() => {
                  void getAllExtraCalculationsSets().then((sets) => {
                    setSavedSets(sets);
                    setShowImportModal(true);
                  });
                }}
              >
                İçe Aktar
              </button>
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                disabled={extraItems.length === 0}
              >
                Kaydet
              </button>
            </div>
          </div>

          <div className={styles.extraList}>
            {extraItems.map((item) => (
              <div key={item.id} className={styles.extraRow}>
                <input
                  className={styles.extraNameInput}
                  value={item.name}
                  onChange={(event) =>
                    setExtraItems((items) =>
                      items.map((row) =>
                        row.id === item.id ? { ...row, name: event.target.value } : row,
                      ),
                    )
                  }
                  placeholder="Kalem"
                />
                <input
                  className={styles.extraValueInput}
                  value={item.value}
                  onChange={(event) =>
                    setExtraItems((items) =>
                      items.map((row) =>
                        row.id === item.id ? { ...row, value: event.target.value } : row,
                      ),
                    )
                  }
                  placeholder="0"
                />
                <button type="button" className={styles.eklentiButton} onClick={() => handleRequestEklenti(item.id)}>
                  Eklenti
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => setExtraItems((items) => items.filter((row) => row.id !== item.id))}
                  aria-label="Kalemi sil"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.addRowButton}
              onClick={() =>
                setExtraItems((items) => [
                  ...items,
                  { id: crypto.randomUUID(), name: "", value: "" },
                ])
              }
            >
              + Kalem ekle
            </button>
          </div>
        </section>

        <div className={styles.totalBox}>
          <span>Giydirilmiş Brüt</span>
          <strong>{fmtCurrency(totalBrut)} ₺</strong>
        </div>

        <div className={styles.splitPanels}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Brütten Nete</h3>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.line}>
                <span>Brüt Ücret</span>
              <span>{totalBrut > 0 ? `${fmtCurrency(netFromGross.gross)} ₺` : "0,00 ₺"}</span>
            </div>
              {totalBrut > 0 ? (
                <>
                  <DeductionBreakdown mode="gross-to-net" data={netFromGross} styles={styles} />
                  <div className={`${styles.line} ${styles.netLine}`}>
                    <span>Net Ücret</span>
                    <span>{fmtCurrency(netFromGross.net)} ₺</span>
                  </div>
                </>
              ) : null}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Netten Brüte</h3>
            </div>
            <div className={styles.panelBody}>
            <label className={styles.field}>
              <span>Net (₺)</span>
              <div className={styles.netInputRow}>
                <input
                  value={netForGross}
                  onChange={(event) => setNetForGross(event.target.value)}
                  placeholder="18.000"
                />
                {netFromGross.net > 0 ? (
                  <button type="button" onClick={() => setNetForGross(fmtCurrency(netFromGross.net))}>
                    Net kullan
                  </button>
                ) : null}
              </div>
            </label>
            <div className={styles.line}>
              <span>Net Ücret</span>
              <span>{grossFromNet.net > 0 ? `${fmtCurrency(grossFromNet.net)} ₺` : "0,00 ₺"}</span>
            </div>
            {grossFromNet.gross > 0 ? (
              <>
                <DeductionBreakdown mode="net-to-gross" data={grossFromNet} styles={styles} />
                <div className={`${styles.line} ${styles.netLine}`}>
                  <span>Brüt Ücret</span>
                  <span>{fmtCurrency(grossFromNet.gross)} ₺</span>
                </div>
              </>
            ) : null}
            </div>
          </article>
        </div>

        <section className={styles.section}>
          <h2>Notlar</h2>
          <div className={styles.noteBox}>
            <p className={styles.noteInfo}>
              Çıplak Brüt Ücret işçinin işi yapmak için aldığı eklentisiz maaşından ibarettir. Prim,
              İkramiye gibi ücretlerin hesaplanmasında son 12 aylık bordroda yer alan tüm kalemler
              toplanır, toplam 360&apos;a bölünür, 30 ile çarpılır.
            </p>
            {notes.trim() ? <p className={styles.savedNote}>{notes}</p> : null}
          </div>
        </section>
      </div>
      </div>

      <PageActionBar
        hideBrandColumn
        preview={{
          title: PAGE_TITLE,
          copyTargetId: "davaci-word-copy",
          renderContent: renderPreviewContent,
          onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "report-content"),
        }}
        onNew={handleNew}
        onSave={handleSaveCase}
        saveLabel={
          isSaving
            ? effectiveId
              ? "Güncelleniyor..."
              : "Kaydediliyor..."
            : effectiveId
              ? "Güncelle"
              : "Kaydet"
        }
        saveButtonProps={{ disabled: isSaving }}
      />

      <SaveNameModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveExtra}
        title="Ekstra Hesaplamaları Kaydet"
        placeholder="Set adı"
      />

      {showImportModal ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h2>Kaydedilmiş setler</h2>
            {savedSets.length === 0 ? (
              <p className={styles.emptyText}>Kaydedilmiş set yok</p>
            ) : (
              <div className={styles.setList}>
                {savedSets.map((set) => (
                  <div key={set.id} className={styles.setRow}>
                    <div>
                      <strong>{set.name}</strong>
                      <p>{set.data?.length ?? 0} kalem</p>
                    </div>
                    <div className={styles.inlineActions}>
                      <button type="button" onClick={() => void handleImportExtra(set.name)}>
                        İçe Aktar
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => void handleDeleteExtra(set.id)}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setShowImportModal(false)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SaveNameModal
        open={showCaseSaveModal}
        onClose={() => setShowCaseSaveModal(false)}
        onSave={persistCase}
        isLoading={isSaving}
        title="Hesaplamayı Kaydet"
        description="Kaydedilen hesaplamalarınızda görünecek bir isim girin."
        fieldLabel="Hesaplama Adı"
        placeholder="Örn: Hesaplama adı"
        loadingLabel={effectiveId ? "Güncelleniyor..." : "Kaydediliyor..."}
      />

      {activeModal ? (
        <EklentiModal
          open
          onClose={() => setActiveModal(null)}
          months={eklentiValues[activeModal] || Array(12).fill("")}
          onMonthsChange={(index, value) => {
            setEklentiValues((prev) => ({
              ...prev,
              [activeModal]:
                prev[activeModal]?.map((item, itemIndex) => (itemIndex === index ? value : item)) ||
                Array(12).fill(""),
            }));
          }}
          onConfirm={(value) => handleApplyEklenti(value, activeModal)}
        />
      ) : null}

      <div className={styles.hiddenReport}>
        <div id="report-content" className={styles.reportContent}>
          {wordTableSections.map((section) => (
            <div key={section.id} data-section={section.id} className={styles.reportSection}>
              <h2>{section.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: section.htmlForPdf }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DavaciUcretiPage() {
  return (
    <ToastProvider>
      <DavaciUcretiPageContent />
    </ToastProvider>
  );
}
