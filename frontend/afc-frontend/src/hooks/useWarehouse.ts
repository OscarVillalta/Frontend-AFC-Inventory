import { useContext } from "react";
import { WarehouseContext } from "../context/warehouseContextDef";
import type { WarehouseContextValue } from "../context/warehouseContextDef";

export function useWarehouse(): WarehouseContextValue {
  const ctx = useContext(WarehouseContext);
  if (!ctx) {
    throw new Error("useWarehouse must be used within a WarehouseProvider");
  }
  return ctx;
}
