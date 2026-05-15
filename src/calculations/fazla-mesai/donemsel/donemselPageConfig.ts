import type { DonemselState } from "./types";
import {
  DEFAULT_SUMMER_PATTERN,
  DEFAULT_WINTER_PATTERN,
  DEFAULT_SUMMER_PATTERN_HAFTALIK,
  DEFAULT_WINTER_PATTERN_HAFTALIK,
} from "./types";

/** Ayrı sayfa bileşenleri — URL veya pathname ile birleştirilmez. */
export type DonemselFazlaMesaiPageKind = "donemsel" | "donemsel-haftalik";

export type DonemselFazlaMesaiRuntimeConfig = {
  kind: DonemselFazlaMesaiPageKind;
  haftalikMode: boolean;
  pageTitle: string;
  recordType: string;
  redirectBasePath: string;
  wordCopyId: string;
  reportContentId: string;
  dataPageAttr: string;
  videoLinkKey: "fazla-donemsel" | "fazla-donemsel-haftalik";
};

export const DONEMSEL_FAZLA_MESAI_CONFIG: DonemselFazlaMesaiRuntimeConfig = {
  kind: "donemsel",
  haftalikMode: false,
  pageTitle: "Dönemsel Fazla Mesai Hesaplama",
  recordType: "donemsel_fazla_mesai",
  redirectBasePath: "/fazla-mesai/donemsel",
  wordCopyId: "donemsel-word-copy",
  reportContentId: "report-content-donemsel",
  dataPageAttr: "fazla-mesai-donemsel",
  videoLinkKey: "fazla-donemsel",
};

export const DONEMSEL_HAFTALIK_FAZLA_MESAI_CONFIG: DonemselFazlaMesaiRuntimeConfig = {
  kind: "donemsel-haftalik",
  haftalikMode: true,
  pageTitle: "Dönemsel Haftalık Fazla Mesai Hesaplama",
  recordType: "donemsel_haftalik_fazla_mesai",
  redirectBasePath: "/fazla-mesai/donemsel-haftalik",
  wordCopyId: "donemsel-haftalik-word-copy",
  reportContentId: "report-content-donemsel-haftalik",
  dataPageAttr: "fazla-mesai-donemsel-haftalik",
  videoLinkKey: "fazla-donemsel-haftalik",
};

export function emptyDonemselStateForConfig(haftalikMode: boolean): DonemselState {
  if (haftalikMode) {
    return {
      dateIn: "",
      dateOut: "",
      summerPattern: { ...DEFAULT_SUMMER_PATTERN_HAFTALIK },
      winterPattern: { ...DEFAULT_WINTER_PATTERN_HAFTALIK },
      witnessesSeasons: [],
    };
  }
  return {
    dateIn: "",
    dateOut: "",
    summerPattern: { ...DEFAULT_SUMMER_PATTERN },
    winterPattern: { ...DEFAULT_WINTER_PATTERN },
    witnessesSeasons: [],
  };
}
