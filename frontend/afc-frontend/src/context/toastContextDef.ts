import { createContext } from "react";

export interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export interface ToastContextValue {
  showToast: (message: string, type?: Toast["type"]) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
