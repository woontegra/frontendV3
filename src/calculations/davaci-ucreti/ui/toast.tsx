import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (nextMessage: string) => {
        setTone("success");
        setMessage(nextMessage);
        window.setTimeout(() => setMessage(null), 2800);
      },
      error: (nextMessage: string) => {
        setTone("error");
        setMessage(nextMessage);
        window.setTimeout(() => setMessage(null), 3200);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? <div className={`${styles.toast} ${styles[tone]}`}>{message}</div> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast yalnızca ToastProvider içinde kullanılabilir.");
  }
  return context;
}
