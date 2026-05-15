import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import DonemselPage from "./DonemselPage";

export default function DonemselFazlaMesaiModule() {
  return (
    <KaydetProvider>
      <DonemselPage />
    </KaydetProvider>
  );
}
