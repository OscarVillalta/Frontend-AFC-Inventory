import { createContext } from "react";
import type { Warehouse } from "../api/warehouses";

export interface WarehouseContextValue {
  warehouses: Warehouse[];
  activeWarehouseId: number | null;
  setActiveWarehouseId: (id: number) => void;
  loading: boolean;
}

export const WarehouseContext = createContext<WarehouseContextValue | null>(null);
