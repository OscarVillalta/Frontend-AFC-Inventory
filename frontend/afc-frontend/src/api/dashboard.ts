import { apiRequest } from "./apiClient";

/* ── response shapes ────────────────────────────────────────────── */

export interface DashboardKPIs {
  open_orders: number;
  pending_txns: number;
  low_stock: number;
  backordered: number;
  active_batches: number;
}

export interface RecentTransaction {
  id: number;
  quantity_delta: number;
  reason: string;
  created_at: string;
}

export interface RecentOrder {
  id: number;
  order_number: string;
  type: string;
  completed_at: string;
}

export interface DashboardStatsResponse {
  kpis: DashboardKPIs;
  feeds: {
    recent_transactions: RecentTransaction[];
    recent_orders: RecentOrder[];
  };
}

/* ── API call ───────────────────────────────────────────────────── */

export async function fetchDashboardStats(): Promise<DashboardStatsResponse> {
  return apiRequest("/dashboard/stats", { method: "GET" });
}
