import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { getBreadcrumbs, shouldShowBreadcrumb } from "./breadcrumbUtils";
import styles from "./AppBreadcrumb.module.css";

export default function AppBreadcrumb() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!shouldShowBreadcrumb(pathname)) {
    return null;
  }

  const items = getBreadcrumbs(pathname);
  if (items.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      {items.map((item, index) => (
        <span key={`${index}-${item.label}`} className={styles.item}>
          {index > 0 ? <ChevronRight className={styles.separator} aria-hidden /> : null}
          {item.isCurrent ? (
            <span className={styles.current}>{item.label}</span>
          ) : item.to ? (
            <Link
              to={item.to}
              className={styles.link}
              onClick={(e) => {
                const to = item.to;
                if (!to) return;
                if (pathname === to) return;
                if (!pathname.startsWith(`${to}/`)) return;
                e.preventDefault();
                navigate(to);
              }}
            >
              {index === 0 && item.label === "Ana Sayfa" ? (
                <>
                  <Home className={styles.homeIcon} aria-hidden />
                  {item.label}
                </>
              ) : (
                item.label
              )}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
