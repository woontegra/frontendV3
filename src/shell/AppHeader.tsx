import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Moon, Sun, Ticket, Video } from "lucide-react";
import { apiClient } from "@/api/apiClient";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/context/AuthContext";
import { getPageTitle } from "./pageTitles";
import styles from "./AppHeader.module.css";

type NotificationItem = {
  id: number;
  title: string;
  created_at?: string;
  createdAt?: string;
  read?: boolean;
};

type Props = {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
};

export default function AppHeader({ sidebarCollapsed, onSidebarToggle }: Props) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("theme") === "dark",
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const pageTitle = getPageTitle(location.pathname);

  const loadNotifications = useCallback(async () => {
    try {
      setNotifLoading(true);
      const data = await apiClient<NotificationItem[]>("/api/notifications");
      setNotifications(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    const title = getPageTitle(location.pathname);
    document.title = title ? `Bilirkişi Hesap | ${title}` : "Bilirkişi Hesap";
  }, [location.pathname]);

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  async function handleNotificationToggle() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (!next) {
      return;
    }

    await loadNotifications();
    try {
      await apiClient("/api/notifications/mark-read", { method: "POST" });
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    } catch {
      /* sessiz */
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Link to="/dashboard" className={styles.logoLink} aria-label="Ana sayfa">
          <img src="/logo.png" alt="Bilirkişi Hesaplama Araçları Hizmetleri" className={styles.logo} />
        </Link>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={sidebarCollapsed ? "Kenar çubuğunu aç" : "Kenar çubuğunu daralt"}
          onClick={onSidebarToggle}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <a
        href="https://www.youtube.com/@bilirkisihesap"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.trainingLink}
        title="Eğitim Videoları"
      >
        <Video className={styles.trainingIcon} aria-hidden />
        <span>Eğitim Videoları</span>
      </a>

      <div className={styles.titleWrap}>
        {pageTitle ? <h1 className={styles.title}>{pageTitle}</h1> : null}
      </div>

      <div className={styles.actions}>
        <Link to="/profile?tab=tickets" className={styles.ticketLink} aria-label="Destek talebi aç" title="Destek Talebi Aç">
          <span>Ticket Aç</span>
          <Ticket className={styles.ticketIcon} aria-hidden />
        </Link>

        <button
          type="button"
          className={styles.iconButton}
          aria-label={isDark ? "Açık moda geç" : "Koyu moda geç"}
          onClick={() => setIsDark((value) => !value)}
        >
          {isDark ? <Sun className={styles.sunIcon} aria-hidden /> : <Moon className={styles.moonIcon} aria-hidden />}
        </button>

        <div
          className={styles.notificationWrap}
          onMouseEnter={() => {
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current);
              closeTimerRef.current = null;
            }
          }}
          onMouseLeave={() => {
            if (notifOpen) {
              closeTimerRef.current = setTimeout(() => setNotifOpen(false), 1000);
            }
          }}
        >
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Bildirimler"
            onClick={() => void handleNotificationToggle()}
          >
            <Bell className={styles.bellIcon} aria-hidden />
            {unreadCount > 0 ? <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
          </button>

          {notifOpen ? (
            <div className={styles.notificationPanel}>
              <div className={styles.notificationHead}>Bildirimler</div>
              <div className={styles.notificationList}>
                {notifLoading ? (
                  <p className={styles.notificationEmpty}>Yükleniyor...</p>
                ) : notifications.length === 0 ? (
                  <p className={styles.notificationEmpty}>Henüz bildiriminiz yok</p>
                ) : (
                  notifications.map((item) => {
                    const createdAt = item.createdAt || item.created_at;
                    return (
                      <div key={item.id} className={styles.notificationItem}>
                        <strong>{item.title}</strong>
                        {createdAt ? <span>{new Date(createdAt).toLocaleString("tr-TR")}</span> : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>

        <UserMenu user={user} logout={logout} />
      </div>
    </header>
  );
}
