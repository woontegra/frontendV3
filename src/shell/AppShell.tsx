import { useEffect, useState, type CSSProperties } from "react";
import { ChevronRight, LayoutDashboard, Menu, Shield, Wrench } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { calculationModules, type CalculationModuleRoute } from "@/calculations/registry";
import GlobalCalculationTools from "@/components/GlobalCalculationTools";
import StarterWelcomeModal from "@/components/StarterWelcomeModal";
import { useDemoStarterWelcome } from "@/hooks/useDemoStarterWelcome";
import AppBreadcrumb from "./AppBreadcrumb";
import AppHeader from "./AppHeader";
import { isAdminRole } from "@/shared/utils/profilePicture";
import styles from "./AppShell.module.css";

function renderCalculationSidebarInterior(module: CalculationModuleRoute) {
  const trail = module.hasCardSelection === true;
  const hideMenuForNewTrail = module.isNew === true && trail;
  const labelNode =
    module.isNew === true ? (
      <span className={styles.navLabelWithBadge}>
        <span className={styles.navNewBadge}>YENİ</span>
        <span className={styles.navLinkLabelTruncate}>{module.label}</span>
      </span>
    ) : (
      module.label
    );

  if (trail) {
    return (
      <>
        <span className={styles.navLinkStart}>
          {hideMenuForNewTrail ? null : <Menu className={styles.navIcon} aria-hidden />}
          <span className={styles.navLinkLabel}>{labelNode}</span>
        </span>
        <ChevronRight className={styles.navChevron} aria-hidden />
      </>
    );
  }

  return (
    <>
      <Menu className={styles.navIcon} aria-hidden />
      <span>{labelNode}</span>
    </>
  );
}

const MOBILE_BREAKPOINT_PX = 900;

function useIsMobile(breakpoint = MOBILE_BREAKPOINT_PX) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, [breakpoint]);

  return isMobile;
}

function readIsAdmin(): boolean {
  try {
    const currentUser = JSON.parse(localStorage.getItem("current_user") || "null") as {
      role?: string;
      tenantId?: number;
    } | null;
    const tenantId = Number(currentUser?.tenantId ?? localStorage.getItem("tenant_id") ?? "1");
    return isAdminRole(currentUser?.role, tenantId);
  } catch {
    return Number(localStorage.getItem("tenant_id") || "1") === 1;
  }
}

export default function AppShell() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { open: starterWelcomeOpen, onClose: onStarterWelcomeClose } = useDemoStarterWelcome();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true",
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = readIsAdmin();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile) {
      setMobileMenuOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMobile, mobileMenuOpen]);

  function handleSidebarToggle() {
    if (isMobile) {
      setMobileMenuOpen((open) => !open);
      return;
    }

    setSidebarCollapsed((value) => {
      const next = !value;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div
      className={styles.shell}
      style={
        {
          ["--app-shell-sidebar-width" as string]: sidebarCollapsed ? "0px" : "15rem",
        } as CSSProperties
      }
    >
      <AppHeader
        sidebarCollapsed={sidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        isMobile={isMobile}
        onSidebarToggle={handleSidebarToggle}
      />

      {isMobile && mobileMenuOpen ? (
        <button
          type="button"
          className={styles.mobileBackdrop}
          aria-label="Menüyü kapat"
          onClick={closeMobileMenu}
        />
      ) : null}

      <div className={`${styles.body} ${sidebarCollapsed ? styles.bodyCollapsed : ""}`}>
        <aside
          className={[
            styles.sidebar,
            sidebarCollapsed ? styles.sidebarCollapsed : "",
            isMobile && mobileMenuOpen ? styles.sidebarMobileOpen : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <nav className={styles.nav}>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              <LayoutDashboard className={styles.navIcon} aria-hidden />
              <span>Yönetim Paneli</span>
            </NavLink>

            {isAdmin ? (
              <div className={styles.adminGroup}>
                <p className={styles.sectionLabel}>Admin Paneli</p>
                <NavLink
                  to="/admin"
                  end
                  className={({ isActive }) =>
                    isActive ? `${styles.navLink} ${styles.adminLinkActive}` : `${styles.navLink} ${styles.adminLink}`
                  }
                >
                  <Shield className={styles.navIcon} aria-hidden />
                  <span>Admin Paneli</span>
                </NavLink>
              </div>
            ) : null}

            <div className={styles.toolsGroup}>
              <p className={styles.sectionLabel}>Araçlar</p>
              <NavLink
                to="/araclar/manuel-brut-ucret"
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                <Wrench className={styles.navIcon} aria-hidden />
                <span>Manuel Brüt Ücret</span>
              </NavLink>
            </div>

            <div className={styles.calculationGroup}>
              <p className={styles.sectionLabel}>Hesaplamalar</p>
              {calculationModules
                .filter((module) => module.status === "active")
                .map((module) => {
                  const trail = module.hasCardSelection === true;
                  return (
                    <NavLink
                      key={module.path}
                      to={module.path}
                      end={
                        module.path !== "/fazla-mesai" &&
                        module.path !== "/kidem-tazminati" &&
                        module.path !== "/ihbar-tazminati" &&
                        module.path !== "/icra-takip-brutten-nete" &&
                        module.path !== "/ubgt" &&
                        module.path !== "/hafta-tatili"
                      }
                      className={({ isActive }) =>
                        [
                          styles.navLink,
                          trail ? styles.navLinkWithTrail : "",
                          isActive ? styles.navLinkActive : "",
                        ]
                          .filter(Boolean)
                          .join(" ")
                      }
                    >
                      {renderCalculationSidebarInterior(module)}
                    </NavLink>
                  );
                })}

              {calculationModules
                .filter((module) => module.status === "soon")
                .map((module) => {
                  const trail = module.hasCardSelection === true;
                  return (
                    <span
                      key={module.path}
                      className={[styles.upcomingItem, trail ? styles.upcomingItemWithTrail : ""]
                        .filter(Boolean)
                        .join(" ")}
                      aria-disabled="true"
                    >
                      {renderCalculationSidebarInterior(module)}
                    </span>
                  );
                })}
            </div>
          </nav>

          <div className={styles.sidebarFooter}>
            <strong>Bilirkişi Hesaplama Araçları</strong>
            <span>Sürüm 3.0</span>
          </div>
        </aside>

        <main className={styles.main}>
          <AppBreadcrumb />
          <Outlet />
        </main>
      </div>
      <GlobalCalculationTools />
      <StarterWelcomeModal open={starterWelcomeOpen} onClose={onStarterWelcomeClose} />
    </div>
  );
}
