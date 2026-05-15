import { fmtCurrency } from "../engine/format";

type NetFromGrossLike = {
  gross: number;
  sgk: number;
  issizlik: number;
  gelirVergisi: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  net: number;
  gelirVergisiBrut?: number;
  gelirVergisiIstisna?: number;
  damgaVergisiBrut?: number;
  damgaVergisiIstisna?: number;
};

type Props = {
  mode: "gross-to-net" | "net-to-gross";
  data: NetFromGrossLike;
  styles: Record<string, string>;
};

function sign(mode: Props["mode"], value: string) {
  return mode === "gross-to-net" ? `-${value}` : `+${value}`;
}

export function DeductionBreakdown({ mode, data, styles }: Props) {
  const hasIncomeExemption = (data.gelirVergisiIstisna ?? 0) > 0;
  const hasStampExemption = (data.damgaVergisiIstisna ?? 0) > 0;

  return (
    <>
      <div className={styles.line}>
        <span>SGK primi (%14)</span>
        <span className={styles.deduction}>{sign(mode, `${fmtCurrency(data.sgk)} ₺`)}</span>
      </div>
      <div className={styles.line}>
        <span>İşsizlik primi (%1)</span>
        <span className={styles.deduction}>{sign(mode, `${fmtCurrency(data.issizlik)} ₺`)}</span>
      </div>
      {hasIncomeExemption ? (
        <>
          <div className={styles.line}>
            <span>Gelir vergisi (brüt)</span>
            <span className={styles.deduction}>
              {sign(mode, `${fmtCurrency(data.gelirVergisiBrut ?? 0)} ₺`)}
            </span>
          </div>
          <div className={styles.line}>
            <span>Asg. üc. gelir vergi ist.</span>
            <span className={styles.exemption}>
              {mode === "gross-to-net" ? "+" : "-"}
              {fmtCurrency(data.gelirVergisiIstisna ?? 0)} ₺
            </span>
          </div>
          <div className={styles.line}>
            <span>Net gelir vergisi</span>
            <span>{sign(mode, `${fmtCurrency(data.gelirVergisi)} ₺`)}</span>
          </div>
        </>
      ) : (
        <div className={styles.line}>
          <span>Gelir vergisi {data.gelirVergisiDilimleri}</span>
          <span className={styles.deduction}>{sign(mode, `${fmtCurrency(data.gelirVergisi)} ₺`)}</span>
        </div>
      )}
      {hasStampExemption ? (
        <>
          <div className={styles.line}>
            <span>Damga vergisi (brüt)</span>
            <span className={styles.deduction}>
              {sign(mode, `${fmtCurrency(data.damgaVergisiBrut ?? 0)} ₺`)}
            </span>
          </div>
          <div className={styles.line}>
            <span>Asg. üc. damga vergi ist.</span>
            <span className={styles.exemption}>
              {mode === "gross-to-net" ? "+" : "-"}
              {fmtCurrency(data.damgaVergisiIstisna ?? 0)} ₺
            </span>
          </div>
          <div className={styles.line}>
            <span>Net damga vergisi</span>
            <span>{sign(mode, `${fmtCurrency(data.damgaVergisi)} ₺`)}</span>
          </div>
        </>
      ) : (
        <div className={styles.line}>
          <span>Damga vergisi (binde 7,59)</span>
          <span className={styles.deduction}>{sign(mode, `${fmtCurrency(data.damgaVergisi)} ₺`)}</span>
        </div>
      )}
    </>
  );
}
