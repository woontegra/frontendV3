import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { getSession, signOut } from "@/auth/session";
import styles from "./UserMenu.module.css";
type Props = {
  displayName: string;
};

export default function UserMenu({ displayName }: Props) {
  const navigate = useNavigate();
  const session = getSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((value) => !value)}>
        <span className={styles.avatar}>{initials}</span>
        <span className={styles.name}>{displayName}</span>
        <ChevronDown className={styles.chevron} aria-hidden />
      </button>

      {open ? (
        <div className={styles.menu}>
          <div className={styles.menuHeader}>
            <strong>{displayName}</strong>
            {session?.email ? <span>{session.email}</span> : null}
          </div>
          <button type="button" className={styles.logoutButton} onClick={handleSignOut}>
            <LogOut className={styles.menuIcon} aria-hidden />
            Çıkış Yap
          </button>
        </div>
      ) : null}
    </div>
  );
}
