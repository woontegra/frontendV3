import { Outlet } from "react-router-dom";
import { KaydetProvider } from "@/core/kaydet/KaydetProvider";

/** İhbar alt sayfaları kaydet (useKaydetContext) için provider. */
export default function IhbarTazminatiLayout() {
  return (
    <KaydetProvider>
      <Outlet />
    </KaydetProvider>
  );
}
