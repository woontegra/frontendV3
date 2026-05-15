import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import GemiAdamiGunlukPage from "./GemiAdamiGunlukPage";

export default function GemiAdamiGunlukFazlaMesaiModule() {
  return (
    <KaydetProvider>
      <GemiAdamiGunlukPage />
    </KaydetProvider>
  );
}
