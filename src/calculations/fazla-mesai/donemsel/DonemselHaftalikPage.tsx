import { DonemselFazlaMesaiCore } from "./DonemselFazlaMesaiCore";
import { DONEMSEL_HAFTALIK_FAZLA_MESAI_CONFIG } from "./donemselPageConfig";

/** Dönemsel Haftalık — `/fazla-mesai/donemsel-haftalik` (klasik Dönemsel ayrı bileşendir). */
export default function DonemselHaftalikPage() {
  return <DonemselFazlaMesaiCore config={DONEMSEL_HAFTALIK_FAZLA_MESAI_CONFIG} />;
}
