import { apiRequest } from "./apiClient";

export interface Warehouse {
  id: number;
  name: string;
  address: string;
  is_active: boolean;
}

export interface TransferRequest {
  product_id: number;
  from_warehouse_id: number;
  to_warehouse_id: number;
  quantity: number;
}

export interface TransferResponse {
  id: number;
  product_id: number;
  from_warehouse_id: number;
  to_warehouse_id: number;
  quantity: number;
  created_at: string;
}

export function fetchWarehouses(): Promise<Warehouse[]> {
  return apiRequest("/warehouses");
}

export function createTransfer(data: TransferRequest): Promise<TransferResponse> {
  return apiRequest("/transfers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
