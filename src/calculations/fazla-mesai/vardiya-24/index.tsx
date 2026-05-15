import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import Vardiya24Page from "./Vardiya24Page";

export default function Vardiya24FazlaMesaiModule() {
  return (
    <KaydetProvider>
      <Vardiya24Page />
    </KaydetProvider>
  );
}
