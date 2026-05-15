import { Outlet } from "react-router-dom";
import { KaydetProvider } from "./KaydetProvider";

/** `useKaydetContext` kullanan hesaplama sayfaları için ortak sarmalayıcı (Kıdem/İhbar layout’larına paralel). */
export default function KaydetRouteShell() {
  return (
    <KaydetProvider>
      <Outlet />
    </KaydetProvider>
  );
}
