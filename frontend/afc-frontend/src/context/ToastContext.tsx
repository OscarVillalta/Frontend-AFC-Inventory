import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { ToastContext } from "./toastContextDef";
import type { Toast } from "./toastContextDef";

const TOAST_DURATION_MS = 4000;

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const idRef = useRef(0);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: Toast["type"] = "error") => {
      const id = idRef.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION_MS);
      timersRef.current.set(id, timer);
    },
    []
  );

  const alertClass = (type: Toast["type"]) => {
    switch (type) {
      case "success":
        return "alert-success";
      case "warning":
        return "alert-warning";
      case "error":
        return "alert-error";
      default:
        return "alert-info";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast toast-end toast-top z-[9999]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`alert ${alertClass(t.type)} shadow-lg cursor-pointer`}
            onClick={() => removeToast(t.id)}
          >
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
