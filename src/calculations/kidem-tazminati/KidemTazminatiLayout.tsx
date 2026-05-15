import { Outlet } from "react-router-dom";
import { KaydetProvider } from "@/core/kaydet/KaydetProvider";

/** Tüm kıdem alt sayfaları kaydet akışı için provider içinde tutar (Standart FM ile aynı desen). */
export default function KidemTazminatiLayout() {
  return (
    <KaydetProvider>
      <Outlet />
    </KaydetProvider>
  );
}
