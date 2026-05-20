/** Admin panel — demo teklif / kişisel kullanım avantajı mail şablonu */

export const USER_MAIL_AUTO_VARS_HINT =
  "{{adSoyad}}, {{email}}, {{abonelik}}, {{bitisTarihi}}, {{kalanGun}}, {{sirket}}";

export const USER_MAIL_MANUAL_VARS_HINT = "{{indirimLinki}}, {{sonTarih}}";

/** Koyu header zemininde panel logosu (mutlak URL — emoji fallback yok) */
export const PANEL_MAIL_LOGO_URL = "https://panel.bilirkisihesap.com/logobeyaz.png";

export function resolvePanelMailLogoUrl(): string {
  const fromEnv = import.meta.env.VITE_EMAIL_LOGO_URL?.trim();
  if (fromEnv && (fromEnv.startsWith("http://") || fromEnv.startsWith("https://"))) {
    return fromEnv;
  }
  return PANEL_MAIL_LOGO_URL;
}

export const DEMO_OFFER_MAIL_TEMPLATE = {
  name: "Size Özel %40 Kullanım Avantajı",
  description: "Demo kullanıcısına %40 indirimli kişisel erişim teklifi",
  templateId: "demo_offer",
  recipientType: "trial" as const,
  subject: "Size Özel %40 Kullanım Avantajı | Bilirkişi Hesaplama Araçları",
  message: `Daha önce Bilirkişi Hesaplama Araçları için demo talebinde bulunduğunuz için size özel bir kullanım avantajı paylaşmak istedik.

Bilirkişi Hesaplama Araçları; kıdem tazminatı, ihbar tazminatı, fazla mesai, yıllık izin, UBGT ve hafta tatili hesaplamalarını tek panel üzerinden hazırlamanıza yardımcı olur.

Program üzerinden hesaplamalarınızı oluşturabilir, kaydedebilir ve daha sonra tekrar açabilirsiniz. Böylece Excel dosyaları arasında kaybolmadan daha düzenli ve pratik bir çalışma süreci sağlayabilirsiniz.

Size özel oluşturulan %40 indirimli erişim bağlantısını aşağıda paylaşıyoruz:

{{indirimLinki}}

Bu bağlantı {{sonTarih}} tarihine kadar geçerlidir.

İsterseniz aylık kullanım ile başlayabilir, dilerseniz yıllık kullanım seçeneğini değerlendirebilirsiniz. Size uygun seçeneği bağlantı üzerinden inceleyebilirsiniz.

Sorularınız olursa bu e-postayı yanıtlayabilir veya panelinizde yer alan “Ticket Aç” bölümünden bize ulaşabilirsiniz.

İyi çalışmalar dileriz.
Bilirkişi Hesaplama Araçları`,
};

/** Gönderim öncesi kalan {{...}} yer tutucularını bulur */
export function findMailPlaceholders(text: string): string[] {
  const found = new Set<string>();
  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1].trim());
  }
  return [...found];
}

export const MAIL_PLACEHOLDER_VALIDATION_MSG =
  "Mail içinde doldurulmamış alanlar var. Lütfen indirim linki ve son tarih dahil tüm alanları kontrol edin.";
