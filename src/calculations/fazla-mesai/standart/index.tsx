import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import StandartFazlaMesaiPage from "./StandartFazlaMesaiPage";

export { RECORD_TYPE, REDIRECT_BASE_PATH } from "./contract";

export default function StandartFazlaMesaiModule() {
  return (
    <KaydetProvider>
      <StandartFazlaMesaiPage />
    </KaydetProvider>
  );
}
