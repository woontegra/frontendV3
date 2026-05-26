import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ConversionPanelData = {
  gross: number;
  sgk: number;
  issizlik: number;
  gelirVergisi: number;
  gelirVergisiBrut: number;
  gelirVergisiIstisna: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  damgaVergisiBrut: number;
  damgaVergisiIstisna: number;
  net: number;
};

type Labels = {
  grossToNet: string;
  netToGross: string;
  grossSalary: string;
  netSalary: string;
};

type Props = {
  layout: "brut" | "net";
  labels: Labels;
  fmtCurrency: (n: number) => string;
  /** Brütten Nete: cetvel brüt / Netten Brüte (net layout): cetvel net */
  cetvelSourceText: string;
  /** Brütten Nete panel verisi */
  netFromGross: ConversionPanelData;
  /** Netten Brüte panel verisi */
  grossFromNet: ConversionPanelData;
  /** Brüt layout: net girişi. Net layout: brüt girişi */
  manualInput: string;
  onManualInputChange: (value: string) => void;
  /** Sol panelden otomatik doldurma (brüt: net, net: brüt) */
  onUseLeftPanelValue?: () => void;
  leftPanelResultValue?: number;
  useLeftPanelLabel?: string;
};

function GrossToNetPanel({
  title,
  salaryLabel,
  fmtCurrency,
  cetvelSourceText,
  data,
  showInput,
  inputValue,
  onInputChange,
  useLeftPanel,
}: {
  title: string;
  salaryLabel: string;
  fmtCurrency: (n: number) => string;
  cetvelSourceText: string;
  data: ConversionPanelData;
  showInput: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  useLeftPanel?: { label: string; onClick: () => void; visible: boolean };
}) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <Label className="text-xs">{salaryLabel}</Label>
          {showInput ? (
            <div className="flex gap-2 mt-1">
              <Input
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Örn: 18.000,00"
                className="h-8 text-sm flex-1"
              />
              {useLeftPanel?.visible ? (
                <button
                  type="button"
                  onClick={useLeftPanel.onClick}
                  className="shrink-0 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded border border-emerald-200 dark:border-emerald-700 h-8"
                >
                  {useLeftPanel.label}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="h-8 text-sm flex items-center text-gray-600 dark:text-gray-400">{cetvelSourceText}</div>
          )}
        </div>
        <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Brüt Ücret</span>
            <span className="font-semibold">{fmtCurrency(data.gross)}₺</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-red-600">SGK Primi (%14)</span>
            <span className="font-semibold text-red-600">-{fmtCurrency(data.sgk)}₺</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-red-600">İşsizlik Primi (%1)</span>
            <span className="font-semibold text-red-600">-{fmtCurrency(data.issizlik)}₺</span>
          </div>
          {data.gelirVergisiIstisna > 0 ? (
            <>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-red-600">Gelir Vergisi (Brüt)</span>
                <span className="font-semibold text-red-600">-{fmtCurrency(data.gelirVergisiBrut)}₺</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-green-600">Asg. Üc. Gel. Vergi İst.</span>
                <span className="font-semibold text-green-600">+{fmtCurrency(data.gelirVergisiIstisna)}₺</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600">Net Gelir Vergisi</span>
                <span className="font-semibold">-{fmtCurrency(data.gelirVergisi)}₺</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-red-600">Gelir Vergisi {data.gelirVergisiDilimleri}</span>
              <span className="font-semibold text-red-600">-{fmtCurrency(data.gelirVergisi)}₺</span>
            </div>
          )}
          {data.damgaVergisiIstisna > 0 ? (
            <>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-red-600">Damga Vergisi (Brüt)</span>
                <span className="font-semibold text-red-600">-{fmtCurrency(data.damgaVergisiBrut)}₺</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-green-600">Asg. Üc. Damga Vergi İst.</span>
                <span className="font-semibold text-green-600">+{fmtCurrency(data.damgaVergisiIstisna)}₺</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600">Net Damga Vergisi</span>
                <span className="font-semibold">-{fmtCurrency(data.damgaVergisi)}₺</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
              <span className="font-semibold text-red-600">-{fmtCurrency(data.damgaVergisi)}₺</span>
            </div>
          )}
          <div className="flex justify-between pt-2">
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">Net Ücret</span>
            <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmtCurrency(data.net)}₺</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NetToGrossPanel({
  title,
  salaryLabel,
  fmtCurrency,
  cetvelSourceText,
  data,
  showInput,
  inputValue,
  onInputChange,
  useLeftPanel,
}: {
  title: string;
  salaryLabel: string;
  fmtCurrency: (n: number) => string;
  cetvelSourceText: string;
  data: ConversionPanelData;
  showInput: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  useLeftPanel?: { label: string; onClick: () => void; visible: boolean };
}) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <Label className="text-xs">{salaryLabel}</Label>
          {showInput ? (
            <div className="flex gap-2 mt-1">
              <Input
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Örn: 18.000,00"
                className="h-8 text-sm flex-1"
              />
              {useLeftPanel?.visible ? (
                <button
                  type="button"
                  onClick={useLeftPanel.onClick}
                  className="shrink-0 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded border border-emerald-200 dark:border-emerald-700 h-8"
                >
                  {useLeftPanel.label}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="h-8 text-sm flex items-center text-gray-600 dark:text-gray-400">{cetvelSourceText}</div>
          )}
        </div>
        <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Net Ücret</span>
            <span className="font-semibold">{fmtCurrency(data.net)}₺</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-red-600">SGK Primi (%14)</span>
            <span className="font-semibold text-red-600">+{fmtCurrency(data.sgk)}₺</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-red-600">İşsizlik Primi (%1)</span>
            <span className="font-semibold text-red-600">+{fmtCurrency(data.issizlik)}₺</span>
          </div>
          {(data.gelirVergisiIstisna ?? 0) > 0 ? (
            <>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-red-600">Gelir Vergisi (Brüt)</span>
                <span className="font-semibold text-red-600">+{fmtCurrency(data.gelirVergisiBrut ?? 0)}₺</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-green-600">Asg. Üc. Gel. Vergi İst.</span>
                <span className="font-semibold text-green-600">-{fmtCurrency(data.gelirVergisiIstisna ?? 0)}₺</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600">Net Gelir Vergisi</span>
                <span className="font-semibold">+{fmtCurrency(data.gelirVergisi)}₺</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-red-600">Gelir Vergisi {data.gelirVergisiDilimleri}</span>
              <span className="font-semibold text-red-600">+{fmtCurrency(data.gelirVergisi)}₺</span>
            </div>
          )}
          {(data.damgaVergisiIstisna ?? 0) > 0 ? (
            <>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-red-600">Damga Vergisi (Brüt)</span>
                <span className="font-semibold text-red-600">+{fmtCurrency(data.damgaVergisiBrut ?? 0)}₺</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-green-600">Asg. Üc. Damga Vergi İst.</span>
                <span className="font-semibold text-green-600">-{fmtCurrency(data.damgaVergisiIstisna ?? 0)}₺</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600">Net Damga Vergisi</span>
                <span className="font-semibold">+{fmtCurrency(data.damgaVergisi)}₺</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
              <span className="font-semibold text-red-600">+{fmtCurrency(data.damgaVergisi)}₺</span>
            </div>
          )}
          <div className="flex justify-between pt-2">
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">Brüt Ücret</span>
            <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmtCurrency(data.gross)}₺</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UcretConversionCards({
  layout,
  labels,
  fmtCurrency,
  cetvelSourceText,
  netFromGross,
  grossFromNet,
  manualInput,
  onManualInputChange,
  onUseLeftPanelValue,
  leftPanelResultValue = 0,
  useLeftPanelLabel = "Sol panelin netini kullan",
}: Props) {
  if (layout === "net") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NetToGrossPanel
          title={labels.netToGross}
          salaryLabel={labels.netSalary}
          fmtCurrency={fmtCurrency}
          cetvelSourceText={cetvelSourceText}
          data={grossFromNet}
          showInput={false}
          inputValue=""
          onInputChange={() => {}}
        />
        <GrossToNetPanel
          title={labels.grossToNet}
          salaryLabel={labels.grossSalary}
          fmtCurrency={fmtCurrency}
          cetvelSourceText=""
          data={netFromGross}
          showInput
          inputValue={manualInput}
          onInputChange={onManualInputChange}
          useLeftPanel={
            onUseLeftPanelValue
              ? {
                  label: useLeftPanelLabel,
                  onClick: onUseLeftPanelValue,
                  visible: leftPanelResultValue > 0,
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <GrossToNetPanel
        title={labels.grossToNet}
        salaryLabel={labels.grossSalary}
        fmtCurrency={fmtCurrency}
        cetvelSourceText={cetvelSourceText}
        data={netFromGross}
        showInput={false}
        inputValue=""
        onInputChange={() => {}}
      />
      <NetToGrossPanel
        title={labels.netToGross}
        salaryLabel={labels.netSalary}
        fmtCurrency={fmtCurrency}
        cetvelSourceText=""
        data={grossFromNet}
        showInput
        inputValue={manualInput}
        onInputChange={onManualInputChange}
        useLeftPanel={
          onUseLeftPanelValue
            ? {
                label: useLeftPanelLabel,
                onClick: onUseLeftPanelValue,
                visible: leftPanelResultValue > 0,
              }
            : undefined
        }
      />
    </div>
  );
}

export const EMPTY_CONVERSION_PANEL: ConversionPanelData = {
  gross: 0,
  sgk: 0,
  issizlik: 0,
  gelirVergisi: 0,
  gelirVergisiBrut: 0,
  gelirVergisiIstisna: 0,
  gelirVergisiDilimleri: "",
  damgaVergisi: 0,
  damgaVergisiBrut: 0,
  damgaVergisiIstisna: 0,
  net: 0,
};
