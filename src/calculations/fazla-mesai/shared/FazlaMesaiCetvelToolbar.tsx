import type { Dispatch, SetStateAction } from "react";
import type { Mode270 } from "../standart/contract";

export interface FazlaMesaiCetvelToolbarProps {
  mode270: Mode270;
  show270Dropdown: boolean;
  setShow270Dropdown: Dispatch<SetStateAction<boolean>>;
  onSelectMode270: (m: Mode270) => void;
  zamanasimiBaslangic: string | null;
  onZamanaButtonClick: () => void;
  hasCustomKatsayi: boolean;
  katSayi: number;
  onKatsayiButtonClick: () => void;
}

/**
 * 270 saat, zamanaşımı ve katsayı — cetvel başlığı / banner / (varsa) manuel brüt satırından sonra,
 * tablonun hemen üstünde gösterilir; yıllık izin panellerinden uzakta kalmaz.
 */
export function FazlaMesaiCetvelToolbar({
  mode270,
  show270Dropdown,
  setShow270Dropdown,
  onSelectMode270,
  zamanasimiBaslangic,
  onZamanaButtonClick,
  hasCustomKatsayi,
  katSayi,
  onKatsayiButtonClick,
}: FazlaMesaiCetvelToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setShow270Dropdown((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
            mode270 !== "none"
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500"
          }`}
        >
          {mode270 === "none" && "270 Saat"}
          {mode270 === "detailed" && "270 (Şirket)"}
          {mode270 === "simple" && "270 (Yargıtay)"}
          <svg
            className={`w-3.5 h-3.5 transition-transform ${show270Dropdown ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {show270Dropdown && (
          <div className="absolute top-full left-0 mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1 text-xs">
            <button
              type="button"
              onClick={() => {
                onSelectMode270("none");
                setShow270Dropdown(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                mode270 === "none" ? "bg-indigo-50 dark:bg-indigo-900/30 font-medium" : ""
              }`}
            >
              Kapalı
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectMode270("detailed");
                setShow270Dropdown(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                mode270 === "detailed" ? "bg-indigo-50 dark:bg-indigo-900/30 font-medium" : ""
              }`}
            >
              Şirket Uygulaması
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectMode270("simple");
                setShow270Dropdown(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                mode270 === "simple" ? "bg-indigo-50 dark:bg-indigo-900/30 font-medium" : ""
              }`}
            >
              Yargıtay Uygulaması
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onZamanaButtonClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
          zamanasimiBaslangic
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
        }`}
        title={zamanasimiBaslangic ? "Zamanaşımını kaldır" : "Zamanaşımı hesapla"}
      >
        {zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı İtirazı"}
      </button>
      <button
        type="button"
        onClick={onKatsayiButtonClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
          hasCustomKatsayi
            ? "bg-emerald-600 text-white border-emerald-600"
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500"
        }`}
        title={hasCustomKatsayi ? "Katsayıyı kaldır" : "Katsayı hesapla"}
      >
        {hasCustomKatsayi ? `Katsayı ${katSayi?.toFixed(2) || "1"}` : "Kat Sayı"}
      </button>
    </div>
  );
}
