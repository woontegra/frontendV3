import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import TanikliStandartPage from "./TanikliStandartPage";

export { RECORD_TYPE, REDIRECT_BASE_PATH } from "./contract";

export default function TanikliStandartFazlaMesaiModule() {
  return (
    <KaydetProvider>
      <TanikliStandartPage />
    </KaydetProvider>
  );
}
