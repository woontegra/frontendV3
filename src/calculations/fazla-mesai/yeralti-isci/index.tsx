import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import YeraltiIsciPage from "./YeraltiIsciPage";

export default function YeraltiIsciFazlaMesaiModule() {
  return (
    <KaydetProvider>
      <YeraltiIsciPage />
    </KaydetProvider>
  );
}
