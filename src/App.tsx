import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import LoginPage from "@/auth/LoginPage";
import { isAuthenticated } from "@/auth/session";
import DavaciUcretiPage from "@/calculations/davaci-ucreti";
import StandartFazlaMesaiPage from "@/calculations/fazla-mesai/standart";
import TanikliStandartFazlaMesaiPage from "@/calculations/fazla-mesai/tanikli-standart";
import HaftalikKarmaFazlaMesaiPage from "@/calculations/fazla-mesai/haftalik-karma";
import DonemselFazlaMesaiPage from "@/calculations/fazla-mesai/donemsel";
import DonemselHaftalikFazlaMesaiPage from "@/calculations/fazla-mesai/donemsel-haftalik";
import YeraltiIsciFazlaMesaiPage from "@/calculations/fazla-mesai/yeralti-isci";
import Vardiya24FazlaMesaiPage from "@/calculations/fazla-mesai/vardiya-24";
import Vardiya48FazlaMesaiPage from "@/calculations/fazla-mesai/vardiya-48";
import GemiAdamiGunlukFazlaMesaiPage from "@/calculations/fazla-mesai/gemi-adami-gunluk";
import GemiAdami724FazlaMesaiPage from "@/calculations/fazla-mesai/gemi-adami-7-24";
import EvIsciFazlaMesaiPage from "@/calculations/fazla-mesai/ev-isci";
import FazlaMesaiSelectionPage from "@/calculations/fazla-mesai/FazlaMesaiSelectionPage";
import YillikIzinSelectionPage from "@/calculations/yillik-izin/YillikIzinSelectionPage";
import YillikIzinStandartPage from "@/calculations/yillik-izin/YillikIzinStandartPage";
import YillikIzinBorclarPage from "@/calculations/yillik-izin/YillikIzinBorclarPage";
import YillikIzinGemiPage from "@/calculations/yillik-izin/YillikIzinGemiPage";
import YillikIzinMevsimPage from "@/calculations/yillik-izin/YillikIzinMevsimPage";
import YillikIzinBasinPage from "@/calculations/yillik-izin/YillikIzinBasinPage";
import YillikIzinBasinGunlukOlmayanPage from "@/calculations/yillik-izin/YillikIzinBasinGunlukOlmayanPage";
import YillikIzinKismiPage from "@/calculations/yillik-izin/YillikIzinKismiPage";
import YillikIzinBelirliPage from "@/calculations/yillik-izin/YillikIzinBelirliPage";
import Kidem30Page from "@/calculations/kidem-tazminati/Kidem30Page";
import KidemGemiPage from "@/calculations/kidem-tazminati/KidemGemiPage";
import KidemMevsimlikPage from "@/calculations/kidem-tazminati/KidemMevsimlikPage";
import KidemBasinPage from "@/calculations/kidem-tazminati/KidemBasinPage";
import KidemSelectionPage from "@/calculations/kidem-tazminati/KidemSelectionPage";
import KidemBorclarPage from "@/calculations/kidem-tazminati/KidemBorclarPage";
import KidemKismiSureliPage from "@/calculations/kidem-tazminati/KidemKismiSureliPage";
import KidemBelirliSureliPage from "@/calculations/kidem-tazminati/KidemBelirliSureliPage";
import KidemTazminatiLayout from "@/calculations/kidem-tazminati/KidemTazminatiLayout";
import Ihbar30Page from "@/calculations/ihbar-tazminati/Ihbar30Page";
import IhbarBorclarPage from "@/calculations/ihbar-tazminati/IhbarBorclarPage";
import IhbarGemiPage from "@/calculations/ihbar-tazminati/IhbarGemiPage";
import IhbarMevsimPage from "@/calculations/ihbar-tazminati/IhbarMevsimPage";
import IhbarBasinPage from "@/calculations/ihbar-tazminati/IhbarBasinPage";
import IhbarKismiPage from "@/calculations/ihbar-tazminati/IhbarKismiPage";
import IhbarBelirliPage from "@/calculations/ihbar-tazminati/IhbarBelirliPage";
import IhbarSelectionPage from "@/calculations/ihbar-tazminati/IhbarSelectionPage";
import IhbarTazminatiLayout from "@/calculations/ihbar-tazminati/IhbarTazminatiLayout";
import AdminRoute from "@/components/auth/AdminRoute";
import KaydetRouteShell from "@/core/kaydet/KaydetRouteShell";
import AdminAccessDeniedPage from "@/pages/admin/AdminAccessDeniedPage";
import AdminAuditLogPage from "@/pages/admin/AdminAuditLogPage";
import AdminBarAssociationsPage from "@/pages/admin/AdminBarAssociationsPage";
import AdminChatPage from "@/pages/admin/AdminChatPage";
import AdminControlCenter from "@/pages/admin/AdminControlCenter";
import AdminCreateUserPage from "@/pages/admin/AdminCreateUserPage";
import AdminEmailNotifications from "@/pages/admin/AdminEmailNotifications";
import AdminFeedbackPage from "@/pages/admin/AdminFeedbackPage";
import AdminLicensesPage from "@/pages/admin/AdminLicensesPage";
import AdminPage from "@/pages/admin/AdminPage";
import AdminSubscriptionsPage from "@/pages/admin/AdminSubscriptionsPage";
import AdminTenantAnalytics from "@/pages/admin/AdminTenantAnalytics";
import AdminTicketsPage from "@/pages/admin/AdminTicketsPage";
import AdminUserDetailPage from "@/pages/admin/AdminUserDetailPage";
import AdminUserEditPage from "@/pages/admin/AdminUserEditPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import DemoConversionPage from "@/pages/admin/DemoConversionPage";
import DeviceManagementPage from "@/pages/admin/DeviceManagementPage";
import LogsPage from "@/pages/admin/LogsPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import NotificationsPage from "@/pages/profile/NotificationsPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import ManualBrutWageTemplatesPage from "@/features/manual-brut-wage/ManualBrutWageTemplatesPage";
import AyrimcilikTazminatiPage from "@/calculations/ayrimcilik-tazminati";
import HaksizFesihTazminatiPage from "@/calculations/haksiz-fesih-tazminati";
import UcretAlacagiPage from "@/calculations/ucret-alacagi";
import IsAramaIzniUcretiPage from "@/calculations/is-arama-izni-ucreti";
import BakiyeUcretAlacagiPage from "@/calculations/bakiye-ucret-alacagi";
import PrimAlacagiPage from "@/calculations/prim-alacagi";
import KotuNiyetTazminatiPage from "@/calculations/kotu-niyet-tazminati";
import BostaGecenSureUcretiPage from "@/calculations/bosta-gecen-sure-ucreti";
import IseAlmamaTazminatiPage from "@/calculations/ise-almama-tazminati";
import UbgtSelectionPage from "@/calculations/ubgt/UbgtSelectionPage";
import UbgtStandartPage from "@/calculations/ubgt/standart/UbgtStandartPage";
import UbgtBilirkisiPage from "@/calculations/ubgt/bilirkisi/UbgtBilirkisiPage";
import HaftaTatiliSelectionPage from "@/calculations/hafta-tatili/HaftaTatiliSelectionPage";
import HaftaTatiliStandardPage from "@/calculations/hafta-tatili/HaftaTatiliStandardPage";
import HaftaTatiliGemiPage from "@/calculations/hafta-tatili/HaftaTatiliGemiPage";
import HaftaTatiliBasinPage from "@/calculations/hafta-tatili/HaftaTatiliBasinPage";
import {
  LegacyHaftaBasinRedirect,
  LegacyHaftaGemiRedirect,
  LegacyHaftaStandardRedirect,
} from "@/calculations/hafta-tatili/HaftaTatiliLegacyRedirects";
import IcraTakipSelectionPage from "@/calculations/icra-takip-brutten-nete/IcraTakipSelectionPage";
import DamgaVergisiKesintiliPage from "@/calculations/icra-takip-brutten-nete/DamgaVergisiKesintiliPage";
import GelirVeDamgaVergisiKesintiliPage from "@/calculations/icra-takip-brutten-nete/GelirVeDamgaVergisiKesintiliPage";
import IstisnaliFullKesintiliPage from "@/calculations/icra-takip-brutten-nete/IstisnaliFullKesintiliPage";
import IstisnasizFullKesintiliPage from "@/calculations/icra-takip-brutten-nete/IstisnasizFullKesintiliPage";
import ChatWidget from "@/components/chat/ChatWidget";
import SessionKeepAlive from "@/components/SessionKeepAlive";
import AppShell from "@/shell/AppShell";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import ProfessionalLicenseActivation from "@/pages/ProfessionalLicenseActivation";
import StartPage from "@/pages/StartPage";
import ViewCalculation from "@/pages/calculations/ViewCalculation";
import { FazlaMesaiLegacyToBase } from "@/pages/fazla-mesai/FazlaMesaiLegacyRouteRedirects";

function ProtectedShell() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <AppShell />
      <ChatWidget />
    </>
  );
}

function AdminOnly({ children }: { children: ReactNode }) {
  return <AdminRoute>{children}</AdminRoute>;
}

function UbgtLegacyRedirect({ segment }: { segment: "alacagi" | "bilirkisi" }) {
  const { id } = useParams();
  return <Navigate to={id !== undefined ? `/ubgt/${segment}/${id}` : `/ubgt/${segment}`} replace />;
}

export default function App() {
  return (
    <>
      <SessionKeepAlive />
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated() ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/professional-license-activation" element={<ProfessionalLicenseActivation />} />
        <Route path="/admin-access-denied" element={<AdminAccessDeniedPage />} />
        <Route path="/" element={<ProtectedShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="panel/start" element={<StartPage />} />
          <Route path="calculations/view/:id" element={<ViewCalculation />} />
        <Route
          path="admin"
          element={
            <AdminOnly>
              <AdminPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/control-center"
          element={
            <AdminOnly>
              <AdminControlCenter />
            </AdminOnly>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminOnly>
              <AdminUsersPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/users/new"
          element={
            <AdminOnly>
              <AdminCreateUserPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/users/:id/detail"
          element={
            <AdminOnly>
              <AdminUserDetailPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/users/:id/edit"
          element={
            <AdminOnly>
              <AdminUserEditPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/subscriptions"
          element={
            <AdminOnly>
              <AdminSubscriptionsPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/tickets"
          element={
            <AdminOnly>
              <AdminTicketsPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/chat"
          element={
            <AdminOnly>
              <AdminChatPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/analytics"
          element={
            <AdminOnly>
              <AdminTenantAnalytics />
            </AdminOnly>
          }
        />
        <Route
          path="admin/demo-conversion"
          element={
            <AdminOnly>
              <DemoConversionPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/logs"
          element={
            <AdminOnly>
              <LogsPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/audit-logs"
          element={
            <AdminOnly>
              <AdminAuditLogPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/licenses"
          element={
            <AdminOnly>
              <AdminLicensesPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/device-management"
          element={
            <AdminOnly>
              <DeviceManagementPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/email-notifications"
          element={
            <AdminOnly>
              <AdminEmailNotifications />
            </AdminOnly>
          }
        />
        <Route
          path="admin/bar-associations"
          element={
            <AdminOnly>
              <AdminBarAssociationsPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/feedback"
          element={
            <AdminOnly>
              <AdminFeedbackPage />
            </AdminOnly>
          }
        />
        <Route path="davaci-ucreti" element={<DavaciUcretiPage />} />
        <Route path="davaci-ucreti/:id" element={<DavaciUcretiPage />} />
        <Route path="araclar/manuel-brut-ucret" element={<ManualBrutWageTemplatesPage />} />
        <Route path="fazla-mesai" element={<Outlet />}>
          <Route path="gemi-7-24" element={<Navigate to="/fazla-mesai/gemi-adami-7-24" replace />} />
          <Route path="gemi-7-24/:id" element={<FazlaMesaiLegacyToBase base="/fazla-mesai/gemi-adami-7-24" />} />
          <Route path="ev" element={<Navigate to="/fazla-mesai/ev-isci" replace />} />
          <Route path="ev/:id" element={<FazlaMesaiLegacyToBase base="/fazla-mesai/ev-isci" />} />
          <Route path="vardiya-24-48" element={<Navigate to="/fazla-mesai/vardiya-24" replace />} />
          <Route path="vardiya-24-48/:id" element={<FazlaMesaiLegacyToBase base="/fazla-mesai/vardiya-24" />} />
          <Route index element={<FazlaMesaiSelectionPage />} />
          <Route path="standart" element={<StandartFazlaMesaiPage />} />
          <Route path="standart/:id" element={<StandartFazlaMesaiPage />} />
          <Route path="tanikli-standart" element={<TanikliStandartFazlaMesaiPage />} />
          <Route path="tanikli-standart/:id" element={<TanikliStandartFazlaMesaiPage />} />
          <Route path="haftalik-karma" element={<HaftalikKarmaFazlaMesaiPage />} />
          <Route path="haftalik-karma/:id" element={<HaftalikKarmaFazlaMesaiPage />} />
          <Route path="donemsel" element={<DonemselFazlaMesaiPage />} />
          <Route path="donemsel/:id" element={<DonemselFazlaMesaiPage />} />
          <Route path="donemsel-haftalik" element={<DonemselHaftalikFazlaMesaiPage />} />
          <Route path="donemsel-haftalik/:id" element={<DonemselHaftalikFazlaMesaiPage />} />
          <Route path="yeralti-isci" element={<YeraltiIsciFazlaMesaiPage />} />
          <Route path="yeralti-isci/:id" element={<YeraltiIsciFazlaMesaiPage />} />
          <Route path="vardiya-24" element={<Vardiya24FazlaMesaiPage />} />
          <Route path="vardiya-24/:id" element={<Vardiya24FazlaMesaiPage />} />
          <Route path="vardiya-48" element={<Vardiya48FazlaMesaiPage />} />
          <Route path="vardiya-48/:id" element={<Vardiya48FazlaMesaiPage />} />
          <Route path="gemi-adami-gunluk" element={<GemiAdamiGunlukFazlaMesaiPage />} />
          <Route path="gemi-adami-gunluk/:id" element={<GemiAdamiGunlukFazlaMesaiPage />} />
          <Route path="gemi-adami-7-24" element={<GemiAdami724FazlaMesaiPage />} />
          <Route path="gemi-adami-7-24/:id" element={<GemiAdami724FazlaMesaiPage />} />
          <Route path="ev-isci" element={<EvIsciFazlaMesaiPage />} />
        </Route>
        <Route path="yillik-izin" element={<Outlet />}>
          <Route index element={<YillikIzinSelectionPage />} />
          <Route element={<KaydetRouteShell />}>
            <Route path="standart" element={<YillikIzinStandartPage />} />
            <Route path="standart/:id" element={<YillikIzinStandartPage />} />
            <Route path="borclar" element={<YillikIzinBorclarPage />} />
            <Route path="borclar/:id" element={<YillikIzinBorclarPage />} />
            <Route path="gemi" element={<YillikIzinGemiPage />} />
            <Route path="gemi/:id" element={<YillikIzinGemiPage />} />
            <Route path="mevsim" element={<YillikIzinMevsimPage />} />
            <Route path="mevsim/:id" element={<YillikIzinMevsimPage />} />
            <Route path="basin/gunluk-olmayan" element={<YillikIzinBasinGunlukOlmayanPage />} />
            <Route path="basin/gunluk-olmayan/:id" element={<YillikIzinBasinGunlukOlmayanPage />} />
            <Route path="basin" element={<YillikIzinBasinPage />} />
            <Route path="basin/:id" element={<YillikIzinBasinPage />} />
            <Route path="kismi" element={<YillikIzinKismiPage />} />
            <Route path="kismi/:id" element={<YillikIzinKismiPage />} />
            <Route path="belirli" element={<YillikIzinBelirliPage />} />
            <Route path="belirli/:id" element={<YillikIzinBelirliPage />} />
          </Route>
        </Route>
        <Route path="kidem-tazminati" element={<KidemTazminatiLayout />}>
          <Route index element={<KidemSelectionPage />} />
          <Route path="30isci" element={<Kidem30Page />} />
          <Route path="30isci/:id" element={<Kidem30Page />} />
          <Route path="borclar" element={<KidemBorclarPage />} />
          <Route path="borclar/:id" element={<KidemBorclarPage />} />
          <Route path="gemi" element={<KidemGemiPage />} />
          <Route path="gemi/:id" element={<KidemGemiPage />} />
          <Route path="mevsimlik" element={<KidemMevsimlikPage />} />
          <Route path="mevsimlik/:id" element={<KidemMevsimlikPage />} />
          <Route path="basin" element={<KidemBasinPage />} />
          <Route path="basin/:id" element={<KidemBasinPage />} />
          <Route path="kismi-sureli" element={<KidemKismiSureliPage />} />
          <Route path="kismi-sureli/:id" element={<KidemKismiSureliPage />} />
          <Route path="belirli-sureli" element={<KidemBelirliSureliPage />} />
          <Route path="belirli-sureli/:id" element={<KidemBelirliSureliPage />} />
        </Route>
        <Route path="ihbar-tazminati" element={<IhbarTazminatiLayout />}>
          <Route index element={<IhbarSelectionPage />} />
          <Route path="30isci" element={<Ihbar30Page />} />
          <Route path="30isci/:id" element={<Ihbar30Page />} />
          <Route path="borclar" element={<IhbarBorclarPage />} />
          <Route path="borclar/:id" element={<IhbarBorclarPage />} />
          <Route path="gemi" element={<IhbarGemiPage />} />
          <Route path="gemi/:id" element={<IhbarGemiPage />} />
          <Route path="mevsim" element={<IhbarMevsimPage />} />
          <Route path="mevsim/:id" element={<IhbarMevsimPage />} />
          <Route path="basin" element={<IhbarBasinPage />} />
          <Route path="basin/:id" element={<IhbarBasinPage />} />
          <Route path="kismi" element={<IhbarKismiPage />} />
          <Route path="kismi/:id" element={<IhbarKismiPage />} />
          <Route path="belirli" element={<IhbarBelirliPage />} />
          <Route path="belirli/:id" element={<IhbarBelirliPage />} />
        </Route>
        <Route path="ubgt-alacagi" element={<Navigate to="/ubgt/alacagi" replace />} />
        <Route path="ubgt-alacagi/:id" element={<UbgtLegacyRedirect segment="alacagi" />} />
        <Route path="ubgt-bilirkisi" element={<Navigate to="/ubgt/bilirkisi" replace />} />
        <Route path="ubgt-bilirkisi/:id" element={<UbgtLegacyRedirect segment="bilirkisi" />} />
        <Route path="ubgt" element={<Outlet />}>
          <Route index element={<UbgtSelectionPage />} />
          <Route element={<KaydetRouteShell />}>
            <Route path="alacagi" element={<UbgtStandartPage />} />
            <Route path="alacagi/:id" element={<UbgtStandartPage />} />
            <Route path="bilirkisi" element={<UbgtBilirkisiPage />} />
            <Route path="bilirkisi/:id" element={<UbgtBilirkisiPage />} />
          </Route>
        </Route>
        <Route path="hafta-tatili-alacagi" element={<Navigate to="/hafta-tatili" replace />} />
        <Route path="hafta-tatili-alacagi/standard" element={<Navigate to="/hafta-tatili/standard" replace />} />
        <Route path="hafta-tatili-alacagi/standard/:id" element={<LegacyHaftaStandardRedirect />} />
        <Route path="hafta-tatili-alacagi/standart" element={<Navigate to="/hafta-tatili/standard" replace />} />
        <Route path="hafta-tatili-alacagi/standart/:id" element={<LegacyHaftaStandardRedirect />} />
        <Route path="hafta-tatili-alacagi/gemi-adami" element={<Navigate to="/hafta-tatili/gemi-adami" replace />} />
        <Route path="hafta-tatili-alacagi/gemi-adami/:id" element={<LegacyHaftaGemiRedirect />} />
        <Route path="hafta-tatili-alacagi/basin-is" element={<Navigate to="/hafta-tatili/basin-is" replace />} />
        <Route path="hafta-tatili-alacagi/basin-is/:id" element={<LegacyHaftaBasinRedirect />} />
        <Route path="hafta-tatili" element={<Outlet />}>
          <Route index element={<HaftaTatiliSelectionPage />} />
          <Route element={<KaydetRouteShell />}>
            <Route path="standard" element={<HaftaTatiliStandardPage />} />
            <Route path="standard/:id" element={<HaftaTatiliStandardPage />} />
            <Route path="gemi-adami" element={<HaftaTatiliGemiPage />} />
            <Route path="gemi-adami/:id" element={<HaftaTatiliGemiPage />} />
            <Route path="basin-is" element={<HaftaTatiliBasinPage />} />
            <Route path="basin-is/:id" element={<HaftaTatiliBasinPage />} />
          </Route>
          <Route path="standart" element={<Navigate to="/hafta-tatili/standard" replace />} />
          <Route path="standart/:id" element={<Navigate to="/hafta-tatili/standard/:id" replace />} />
          <Route path="gemi" element={<Navigate to="/hafta-tatili/gemi-adami" replace />} />
          <Route path="gemi/:id" element={<Navigate to="/hafta-tatili/gemi-adami/:id" replace />} />
          <Route path="basin" element={<Navigate to="/hafta-tatili/basin-is" replace />} />
          <Route path="basin/:id" element={<Navigate to="/hafta-tatili/basin-is/:id" replace />} />
        </Route>
        <Route element={<KaydetRouteShell />}>
          <Route path="ayrimcilik-tazminati" element={<AyrimcilikTazminatiPage />} />
          <Route path="ayrimcilik-tazminati/:id" element={<AyrimcilikTazminatiPage />} />
          <Route path="haksiz-fesih-tazminati" element={<HaksizFesihTazminatiPage />} />
          <Route path="haksiz-fesih-tazminati/:id" element={<HaksizFesihTazminatiPage />} />
          <Route path="ucret-alacagi" element={<UcretAlacagiPage />} />
          <Route path="ucret-alacagi/:id" element={<UcretAlacagiPage />} />
          <Route path="is-arama-izni-ucreti" element={<IsAramaIzniUcretiPage />} />
          <Route path="is-arama-izni-ucreti/:id" element={<IsAramaIzniUcretiPage />} />
          <Route path="bakiye-ucret-alacagi" element={<BakiyeUcretAlacagiPage />} />
          <Route path="bakiye-ucret-alacagi/:id" element={<BakiyeUcretAlacagiPage />} />
          <Route path="prim-alacagi" element={<PrimAlacagiPage />} />
          <Route path="prim-alacagi/:id" element={<PrimAlacagiPage />} />
          <Route path="kotu-niyet-tazminati" element={<KotuNiyetTazminatiPage />} />
          <Route path="kotu-niyet-tazminati/:id" element={<KotuNiyetTazminatiPage />} />
          <Route path="bosta-gecen-sure-ucreti" element={<BostaGecenSureUcretiPage />} />
          <Route path="bosta-gecen-sure-ucreti/:id" element={<BostaGecenSureUcretiPage />} />
          <Route path="ise-almama-tazminati" element={<IseAlmamaTazminatiPage />} />
          <Route path="ise-almama-tazminati/:id" element={<IseAlmamaTazminatiPage />} />
        </Route>
        <Route path="icra-takip-brutten-nete" element={<Outlet />}>
          <Route index element={<IcraTakipSelectionPage />} />
          <Route element={<KaydetRouteShell />}>
            <Route path="damga-vergisi-kesintili" element={<DamgaVergisiKesintiliPage />} />
            <Route path="damga-vergisi-kesintili/:id" element={<DamgaVergisiKesintiliPage />} />
            <Route path="gelir-ve-damga-vergisi-kesintili" element={<GelirVeDamgaVergisiKesintiliPage />} />
            <Route path="gelir-ve-damga-vergisi-kesintili/:id" element={<GelirVeDamgaVergisiKesintiliPage />} />
            <Route path="istisnali-full-kesintili" element={<IstisnaliFullKesintiliPage />} />
            <Route path="istisnali-full-kesintili/:id" element={<IstisnaliFullKesintiliPage />} />
            <Route path="istisnasiz-full-kesintili" element={<IstisnasizFullKesintiliPage />} />
            <Route path="istisnasiz-full-kesintili/:id" element={<IstisnasizFullKesintiliPage />} />
          </Route>
        </Route>
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/saved-calculations" element={<ProfilePage />} />
        <Route path="profile/notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
