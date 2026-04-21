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
  completed_at: string | null;
}

export interface DashboardStatsResponse {
  kpis: DashboardKPIs;
  feeds: {
    recent_transactions: RecentTransaction[];
    recent_orders: RecentOrder[];
  };
}

/* ── Net KPIs ───────────────────────────────────────────────────── */

export interface NetKpisResponse {
  net_delivered: number;
  net_received: number;
  net_reserved: number;
  net_ordered: number;
  net_backordered: number;
  net_delivered_pct?: number;
  net_received_pct?: number;
  net_reserved_pct?: number;
  net_ordered_pct?: number;
  net_backordered_pct?: number;
}

/* ── Bulk Projections ───────────────────────────────────────────── */

export interface ProjectionItem {
  transaction_id: number;
  quantity_delta: number;
  projected_stock: number;
  eta: string | null;
  created_at: string | null;
}

export interface ProductProjection {
  product_id: number;
  current_on_hand: number;
  projections: ProjectionItem[];
}

export type BulkProjectionsResponse = ProductProjection[];

/* ── Daily History ──────────────────────────────────────────────── */

export interface DailySeriesItem {
  date: string;
  closing_balance: number;
  daily_change: number;
}

export interface ProductDailyHistory {
  product_id: number;
  start_date: string;
  opening_balance: number;
  current_on_hand: number;
  daily_series: DailySeriesItem[];
}

export type DailyHistoryResponse = ProductDailyHistory[];

/* ── Top Ranked Items ───────────────────────────────────────────── */

export interface TopRankedItem {
  product_id: number;
  product_name: string;
  on_hand: number;
  available: number;
  reserved: number;
  ordered: number;
  backordered: number;
}

export interface TopRankedItemsResponse {
  field: number;
  limit: number;
  total: number;
  top_items: TopRankedItem[];
  all_others: number;
}

/* ── API calls ──────────────────────────────────────────────────── */

export async function fetchDashboardStats(): Promise<DashboardStatsResponse> {
  return apiRequest("/dashboard/stats", { method: "GET" });
}

export async function fetchNetKpis(days: number): Promise<NetKpisResponse> {
  return apiRequest(`/dashboard/net-kpis?days=${days}`, { method: "GET" });
}

export async function fetchBulkProjections(productIds: number[]): Promise<BulkProjectionsResponse> {
  return apiRequest("/inventory/projections/bulk", {
    method: "POST",
    body: JSON.stringify({ product_ids: productIds }),
  });
}

export async function fetchDailyHistory(
  productIds: number[],
  startDate: string
): Promise<DailyHistoryResponse> {
  return apiRequest("/inventory/history/daily", {
    method: "POST",
    body: JSON.stringify({ product_ids: productIds, start_date: startDate }),
  });
}

export async function fetchTopRankedItems(
  field: string,
  limit: number
): Promise<TopRankedItemsResponse> {
  return apiRequest(`/inventory/top-items?field=${field}&limit=${limit}`, {
    method: "GET",
  });
}
