import { AUTH_TOKEN_KEY } from "../context/authContextDef";

const BASE_URL = import.meta.env.VITE_API_URL;

export const WAREHOUSE_STORAGE_KEY = "activeWarehouseId";

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const method = options.method || "GET";

  const warehouseId = localStorage.getItem(WAREHOUSE_STORAGE_KEY);
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  const headers: HeadersInit = {
    ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    ...(warehouseId ? { "X-Warehouse-Id": warehouseId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    method,
    headers,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "API request failed");
  }

  return res.json();
}
