import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import DonemselHaftalikPage from "../donemsel/DonemselHaftalikPage";

export default function DonemselHaftalikFazlaMesaiModule() {
  return (
    <KaydetProvider>
      <DonemselHaftalikPage />
    </KaydetProvider>
  );
}
