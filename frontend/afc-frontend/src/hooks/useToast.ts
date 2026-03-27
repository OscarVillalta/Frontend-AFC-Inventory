import { useContext } from "react";
import { ToastContext } from "../context/toastContextDef";
import type { ToastContextValue } from "../context/toastContextDef";

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
