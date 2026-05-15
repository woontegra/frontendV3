import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import HaftalikKarmaPage from "./HaftalikKarmaPage";

export { RECORD_TYPE, REDIRECT_BASE_PATH } from "./contract";

export default function HaftalikKarmaFazlaMesaiModule() {
  return (
    <KaydetProvider>
      <HaftalikKarmaPage />
    </KaydetProvider>
  );
}
