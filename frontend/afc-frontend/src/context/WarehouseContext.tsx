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
