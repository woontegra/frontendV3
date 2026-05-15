export type CalculationModuleRoute = {
  path: string;
  label: string;
  status: "active" | "soon";
  /** Kart seçim sayfası + alt rotalar (sidebar’da sağ ok) */
  hasCardSelection?: boolean;
  /** Pembe “YENİ” rozeti (V2 Sidebar ile uyumlu) */
  isNew?: boolean;
};

/** Sıra: V2 `Sidebar.tsx` MENU_ITEMS ile aynı */
export const calculationModules: CalculationModuleRoute[] = [
  { path: "/davaci-ucreti", label: "Davacı Ücreti", status: "active" },
  { path: "/kidem-tazminati", label: "Kıdem Tazminatı", status: "active", hasCardSelection: true },
  { path: "/ihbar-tazminati", label: "İhbar Tazminatı", status: "active", hasCardSelection: true },
  { path: "/fazla-mesai", label: "Fazla Mesai Alacağı", status: "active", hasCardSelection: true },
  { path: "/yillik-izin", label: "Yıllık Ücretli İzin Alacağı", status: "active", hasCardSelection: true },
  { path: "/ubgt", label: "UBGT Alacağı", status: "active", hasCardSelection: true },
  { path: "/hafta-tatili", label: "Hafta Tatili Alacağı", status: "active", hasCardSelection: true },
  { path: "/ucret-alacagi", label: "Ücret Alacağı", status: "active" },
  { path: "/is-arama-izni-ucreti", label: "İş Arama İzni Ücreti", status: "active" },
  { path: "/bakiye-ucret-alacagi", label: "Bakiye Ücret Alacağı", status: "active" },
  { path: "/prim-alacagi", label: "Prim Alacağı", status: "active" },
  { path: "/kotu-niyet-tazminati", label: "Kötü Niyet Tazminatı", status: "active" },
  { path: "/bosta-gecen-sure-ucreti", label: "Boşta Geçen Süre Ücreti", status: "active" },
  { path: "/ise-almama-tazminati", label: "İşe Başlatmama Tazminatı", status: "active" },
  { path: "/ayrimcilik-tazminati", label: "Ayrımcılık Tazminatı", status: "active" },
  { path: "/haksiz-fesih-tazminati", label: "Haksız Fesih Tazminatı", status: "active" },
  {
    path: "/icra-takip-brutten-nete",
    label: "İcra Takip Brütten Nete",
    status: "active",
    hasCardSelection: true,
    isNew: true,
  },
];

export function getCalculationModuleByPathname(pathname: string): CalculationModuleRoute | undefined {
  const normalized = (pathname.split("?")[0] || "/").replace(/\/$/, "") || "/";
  const sorted = [...calculationModules].sort((a, b) => b.path.length - a.path.length);
  return sorted.find((m) => {
    if (normalized === m.path || normalized.startsWith(`${m.path}/`)) {
      return true;
    }
    if (
      m.path === "/ubgt" &&
      (normalized.startsWith("/ubgt/") ||
        normalized.startsWith("/ubgt-alacagi") ||
        normalized.startsWith("/ubgt-bilirkisi"))
    ) {
      return true;
    }
    if (
      m.path === "/hafta-tatili" &&
      (normalized.startsWith("/hafta-tatili/") || normalized.startsWith("/hafta-tatili-alacagi"))
    ) {
      return true;
    }
    return false;
  });
}
