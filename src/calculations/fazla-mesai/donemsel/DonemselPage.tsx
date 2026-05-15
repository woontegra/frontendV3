import { DonemselFazlaMesaiCore } from "./DonemselFazlaMesaiCore";
import { DONEMSEL_FAZLA_MESAI_CONFIG } from "./donemselPageConfig";

/** Klasik Dönemsel — `/fazla-mesai/donemsel` (Dönemsel Haftalık ayrı bileşendir). */
export default function DonemselPage() {
  return <DonemselFazlaMesaiCore config={DONEMSEL_FAZLA_MESAI_CONFIG} />;
}
