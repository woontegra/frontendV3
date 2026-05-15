export type BreadcrumbItem = {
  label: string;
  to?: string;
  isCurrent?: boolean;
};

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Yönetim Paneli",
  admin: "Admin Paneli",
  "control-center": "Kontrol Merkezi",
  users: "Kullanıcı Yönetimi",
  new: "Yeni Kullanıcı",
  detail: "Kullanıcı Detayı",
  edit: "Kullanıcı Düzenle",
  subscriptions: "Abonelik Yönetimi",
  tickets: "Destek Talepleri",
  chat: "Canlı Sohbet",
  analytics: "Tenant İstatistikleri",
  "demo-conversion": "Demo → Satış Dönüşüm",
  logs: "Sistem Logları",
  "audit-logs": "Admin Denetim Kayıtları",
  licenses: "Lisans Yönetimi",
  "device-management": "Cihaz Yönetimi",
  "email-notifications": "Email Bildirimleri",
  "bar-associations": "Baro Yönetimi",
  feedback: "Kullanıcı Geri Bildirimleri",
  "davaci-ucreti": "Davacı Ücreti",
  "ucret-alacagi": "Ücret Alacağı",
  "is-arama-izni-ucreti": "İş Arama İzni Ücreti",
  "bakiye-ucret-alacagi": "Bakiye Ücret Alacağı",
  "prim-alacagi": "Prim Alacağı",
  "kotu-niyet-tazminati": "Kötü Niyet Tazminatı",
  "bosta-gecen-sure-ucreti": "Boşta Geçen Süre Ücreti",
  "ise-almama-tazminati": "İşe Başlatmama Tazminatı",
  "ayrimcilik-tazminati": "Ayrımcılık Tazminatı",
  "haksiz-fesih-tazminati": "Haksız Fesih Tazminatı",
  "icra-takip-brutten-nete": "İcra Takip Brütten Nete",
  "damga-vergisi-kesintili": "Damga Vergisi Kesintili",
  "gelir-ve-damga-vergisi-kesintili": "Gelir ve Damga Vergisi Kesintili",
  "istisnali-full-kesintili": "İstisnalı Tam Kesintili",
  "istisnasiz-full-kesintili": "İstisnasız Tam Kesintili",
  araclar: "Araçlar",
  "manuel-brut-ucret": "Manuel Brüt Ücret Şablonları",
  "ubgt-alacagi": "Standart UBGT",
  "ubgt-bilirkisi": "Bilirkişi UBGT",
  alacagi: "Standart UBGT",
  bilirkisi: "Bilirkişi UBGT",
  ubgt: "UBGT Alacağı",
  "hafta-tatili": "Hafta Tatili Alacağı",
  "hafta-tatili-alacagi": "Hafta Tatili Alacağı",
  standard: "Standart",
  "gemi-adami": "Gemi Adamları",
  "basin-is": "Basın İş",
  "fazla-mesai": "Fazla Mesai Alacağı",
  "tanikli-standart": "Tanıklı Standart",
  "haftalik-karma": "Haftalık Karma",
  donemsel: "Dönemsel",
  "donemsel-haftalik": "Dönemsel Haftalık",
  "yeralti-isci": "Yeraltı İşçileri",
  "vardiya-24": "24 Saat Vardiya",
  "vardiya-48": "48 Saat Vardiya",
  "gemi-adami-7-24": "Gemi Adamı (7/24)",
  "ev-isci": "Ev İşçileri",
  "kidem-tazminati": "Kıdem Tazminatı",
  "ihbar-tazminati": "İhbar Tazminatı",
  "30isci": "İş Kanununa Göre",
  borclar: "Borçlar Kanunu İşçi Alacağı",
  gemi: "Gemi Adamları",
  mevsimlik: "Mevsimlik İşçi",
  mevsim: "Mevsimlik İşçi",
  basin: "Basın İş",
  "kismi-sureli": "Kısmi Süreli / Part Time",
  kismi: "Kısmi Süreli / Part Time",
  "belirli-sureli": "Belirli Süreli İş Sözleşmesi",
  belirli: "Belirli Süreli İş Sözleşmesi",
  profile: "Profil",
  notifications: "Bildirimler",
  "saved-calculations": "Kayıtlı Hesaplamalar",
};

export function shouldShowBreadcrumb(pathname: string): boolean {
  return pathname !== "/login";
}

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const normalized = pathname.replace(/^\//, "").replace(/\/$/, "");

  if (!normalized || normalized === "dashboard") {
    return [{ label: "Yönetim Paneli", isCurrent: true }];
  }

  const segments = normalized.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: "Ana Sayfa", to: "/dashboard" }];

  let currentPath = "";
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    const isNumericId = /^\d+$/.test(segment);

    if (isNumericId && index > 0) {
      items.push({
        label: `Hesaplama #${segment}`,
        to: currentPath ? `${currentPath}/${segment}` : `/${segment}`,
        isCurrent: true,
      });
      break;
    }

    currentPath = currentPath ? `${currentPath}/${segment}` : `/${segment}`;
    items.push({
      label: SEGMENT_LABELS[segment] ?? segment,
      to: isLast ? undefined : currentPath,
      isCurrent: isLast,
    });
  }

  return items;
}
