export function getPageTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  if (normalized === "/dashboard") {
    return "Yönetim Paneli";
  }

  if (normalized === "/admin" || normalized.startsWith("/admin/")) {
    return "Admin Paneli";
  }

  if (normalized === "/davaci-ucreti" || normalized.startsWith("/davaci-ucreti/")) {
    return "Davacı Ücreti Hesaplama";
  }

  if (normalized === "/ubgt") {
    return "UBGT Alacağı";
  }

  if (
    normalized === "/ubgt/alacagi" ||
    normalized.startsWith("/ubgt/alacagi/") ||
    normalized === "/ubgt-alacagi" ||
    normalized.startsWith("/ubgt-alacagi/")
  ) {
    return "Standart UBGT Alacağı";
  }

  if (
    normalized === "/ubgt/bilirkisi" ||
    normalized.startsWith("/ubgt/bilirkisi/") ||
    normalized === "/ubgt-bilirkisi" ||
    normalized.startsWith("/ubgt-bilirkisi/")
  ) {
    return "Bilirkişi UBGT Alacağı";
  }

  if (normalized === "/fazla-mesai") {
    return "Fazla Mesai Alacağı";
  }

  if (normalized.startsWith("/fazla-mesai/")) {
    const sub = normalized.replace("/fazla-mesai/", "").split("/")[0];
    const titles: Record<string, string> = {
      standart: "Standart Fazla Mesai Hesaplama",
      "tanikli-standart": "Tanıklı Standart Fazla Mesai Hesaplama",
      "haftalik-karma": "Haftalık Karma Fazla Mesai Hesaplama",
      donemsel: "Dönemsel Fazla Mesai Hesaplama",
      "donemsel-haftalik": "Dönemsel Haftalık Fazla Mesai Hesaplama",
      "yeralti-isci": "Yeraltı İşçileri Fazla Mesai Hesaplama",
      "vardiya-24": "24 Saat Vardiya Fazla Mesai Hesaplama",
      "vardiya-48": "48 Saat Vardiya Fazla Mesai Hesaplama",
      "gemi-adami-7-24": "Gemi Adamı 7×24 Fazla Mesai Hesaplama",
      "ev-isci": "Ev İşçileri Fazla Mesai Bilgilendirme",
    };
    return titles[sub] || "Fazla Mesai Alacağı";
  }

  if (normalized === "/kidem-tazminati") {
    return "Kıdem Tazminatı";
  }

  if (normalized.startsWith("/kidem-tazminati/")) {
    const sub = normalized.replace("/kidem-tazminati/", "").split("/")[0];
    const titles: Record<string, string> = {
      "30isci": "İş Kanununa Göre Kıdem Tazminatı",
      borclar: "Borçlar Kanunu Kıdem Tazminatı",
      gemi: "Gemi Adamları Kıdem Tazminatı",
      mevsimlik: "Mevsimlik İşçi Kıdem Tazminatı",
      basin: "Basın İş Kıdem Tazminatı",
      "kismi-sureli": "Kısmi Süreli Kıdem Tazminatı",
      "belirli-sureli": "Belirli Süreli Kıdem Tazminatı",
    };
    return titles[sub] || "Kıdem Tazminatı";
  }

  if (normalized === "/ihbar-tazminati") {
    return "İhbar Tazminatı";
  }

  if (normalized.startsWith("/ihbar-tazminati/")) {
    const sub = normalized.replace("/ihbar-tazminati/", "").split("/")[0];
    const titles: Record<string, string> = {
      "30isci": "İş Kanununa Göre İhbar Tazminatı",
      borclar: "Borçlar Kanunu İhbar Tazminatı",
      gemi: "Gemi Adamları İhbar Tazminatı",
      mevsim: "Mevsimlik İşçi İhbar Tazminatı",
      basin: "Basın İşçileri İhbar Tazminatı",
      kismi: "Kısmi Süreli İhbar Tazminatı",
      belirli: "Belirli Süreli İhbar Tazminatı",
    };
    return titles[sub] || "İhbar Tazminatı";
  }

  if (normalized === "/araclar/manuel-brut-ucret") {
    return "Manuel Brüt Ücret Şablonları";
  }

  if (normalized === "/profile" || normalized.startsWith("/profile/")) {
    return "Profil";
  }

  return "";
}
