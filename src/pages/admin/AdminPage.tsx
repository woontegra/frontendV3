import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart2,
  Building2,
  CreditCard,
  FileText,
  History,
  Key,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MessageSquare,
  Smartphone,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import styles from "./AdminPage.module.css";

const ADMIN_CARDS = [
  { to: "/admin/control-center", label: "Kontrol Merkezi", icon: LayoutDashboard },
  { to: "/admin/users", label: "Kullanıcı Yönetimi", icon: Users },
  { to: "/admin/users/new", label: "Yeni Kullanıcı", icon: UserPlus },
  { to: "/admin/subscriptions", label: "Abonelik Yönetimi", icon: CreditCard },
  { to: "/admin/tickets", label: "Destek Talepleri", icon: MessageSquare },
  { to: "/admin/chat", label: "Canlı Sohbet", icon: MessageCircle },
  { to: "/admin/analytics", label: "Tenant İstatistikleri", icon: BarChart2 },
  { to: "/admin/demo-conversion", label: "Demo → Satış Dönüşüm", icon: ArrowRight },
  { to: "/admin/logs", label: "Sistem Logları", icon: FileText },
  { to: "/admin/audit-logs", label: "Admin Denetim Kayıtları", icon: History },
  { to: "/admin/licenses", label: "Lisans Yönetimi", icon: Key },
  { to: "/admin/device-management", label: "Cihaz Yönetimi", icon: Smartphone },
  { to: "/admin/email-notifications", label: "Email Bildirimleri", icon: Mail },
  { to: "/admin/bar-associations", label: "Baro Yönetimi", icon: Building2 },
  { to: "/admin/feedback", label: "Kullanıcı Geri Bildirimleri", icon: Star },
];

export default function AdminPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Admin Paneli</h1>
        <p>Sistem yönetim araçları</p>
      </header>

      <div className={styles.grid}>
        {ADMIN_CARDS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={styles.card}>
            <div className={styles.iconWrap}>
              <Icon aria-hidden />
            </div>
            <h2>{label}</h2>
            <span>Yönetim sayfasına git</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
