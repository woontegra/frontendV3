import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider, Toaster } from "@/context/ToastContext";
import GlobalDateInputValidation from "@/components/GlobalDateInputValidation";
import App from "./App";
import "./index.css";

const savedTheme = localStorage.getItem("theme") || "light";
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

if (!localStorage.getItem("tenant_id")) {
  localStorage.setItem("tenant_id", "1");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <GlobalDateInputValidation />
          <App />
          <Toaster />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
