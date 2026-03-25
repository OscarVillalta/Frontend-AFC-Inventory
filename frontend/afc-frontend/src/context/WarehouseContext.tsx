import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { fetchWarehouses } from "../api/warehouses";
import type { Warehouse } from "../api/warehouses";
import { WAREHOUSE_STORAGE_KEY } from "../api/apiClient";
import { WarehouseContext } from "./warehouseContextDef";

export default function WarehouseProvider({ children }: { children: ReactNode }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouseId, setActiveWarehouseIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(WAREHOUSE_STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  // 1. Fetch warehouses on mount
  useEffect(() => {
    fetchWarehouses()
      .then((data) => {
        setWarehouses(data);
        const stored = localStorage.getItem(WAREHOUSE_STORAGE_KEY);
        if (stored && data.some((w) => w.id === Number(stored))) {
          setActiveWarehouseIdState(Number(stored));
        } else if (data.length > 0) {
          const first = data[0].id;
          setActiveWarehouseIdState(first);
          localStorage.setItem(WAREHOUSE_STORAGE_KEY, String(first));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch warehouses:", err);
        setWarehouses([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // 2. Cross-tab synchronization listener
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Only react if our specific warehouse key was changed by another tab
      if (e.key === WAREHOUSE_STORAGE_KEY) {
        const newId = e.newValue ? Number(e.newValue) : null;
        setActiveWarehouseIdState(newId);
      }
    };

    // Listen for changes across tabs
    window.addEventListener("storage", handleStorageChange);
    
    // Cleanup listener on unmount
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 3. Update state and storage when user selects a new warehouse
  const setActiveWarehouseId = useCallback((id: number) => {
    setActiveWarehouseIdState(id);
    localStorage.setItem(WAREHOUSE_STORAGE_KEY, String(id));
  }, []);

  return (
    <WarehouseContext.Provider
      value={{ warehouses, activeWarehouseId, setActiveWarehouseId, loading }}
    >
      {children}
    </WarehouseContext.Provider>
  );
}