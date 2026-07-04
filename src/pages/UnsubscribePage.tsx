import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "@/utils/apiClient";

const MAIN_SITE_URL = "https://bilirkisihesap.com";
const LOGO_URL = "https://panel.bilirkisihesap.com/logo.png";
const PRODUCTION_API_URL = "https://api.bilirkisihesap.com";

function resolveUnsubscribeApiOrigin() {
  if (API_BASE_URL) return API_BASE_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "";
  return PRODUCTION_API_URL;
}

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Geçersiz link. Abonelikten çıkış için maildeki linki kullanın.");
      return;
    }
    const apiOrigin = resolveUnsubscribeApiOrigin();
    const url = `${apiOrigin}/api/email-notifications/unsubscribe?token=${encodeURIComponent(token)}&format=json`;
    fetch(url, { headers: { Accept: "application/json" } })
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (data.success) {
          setStatus("success");
          setMessage(data.message || "Abonelikten çıkış yapıldı.");
        } else {
          setStatus("error");
          const raw = data?.error || data?.message || "";
          setMessage(raw || "İşlem yapılamadı.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Abonelikten çıkış işlemi sırasında bir sorun oluştu.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-[520px] bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8 text-center">
        <div className="flex justify-center mb-6">
          <img src={LOGO_URL} alt="Bilirkişi Hesaplama" className="h-12 w-auto object-contain" />
        </div>

        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Email Bildirimlerinden Çıkış</h1>

        {status === "loading" ? <p className="text-gray-500 dark:text-gray-400 text-sm">İşleminiz yapılıyor...</p> : null}
        {status === "success" ? (
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            Email listemizden başarıyla çıkarıldınız. Artık bu tür bilgilendirme mailleri tarafınıza gönderilmeyecektir.
          </p>
        ) : null}
        {status === "error" ? <p className="text-red-600 dark:text-red-400 text-sm">{message}</p> : null}

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
          <a
            href={MAIN_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition"
          >
            Ana siteye dön
          </a>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{MAIN_SITE_URL}</p>
        </div>
      </div>
    </div>
  );
}
