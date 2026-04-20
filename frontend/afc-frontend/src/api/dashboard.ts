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
}

/* ── Bulk Projections ───────────────────────────────────────────── */

export interface BulkProjectionItem {
  date: string;
  eta: string | null;
  product_id: number;
  projected_stock: number;
  quantity_delta: number;
  order_id: number | null;
  order_number: string | null;
  external_order_number: string | null;
  order_type: string | null;
  reason: string;
}

export interface BulkProjectionsResponse {
  [productId: string]: BulkProjectionItem[];
}

/* ── Daily History ──────────────────────────────────────────────── */

export interface DailyHistoryItem {
  date: string;
  product_id: number;
  on_hand: number;
}

export interface DailyHistoryResponse {
  [productId: string]: DailyHistoryItem[];
}

/* ── Top Ranked Items ───────────────────────────────────────────── */

export interface TopRankedItem {
  product_id: number;
  part_number: string;
  value: number;
}

export interface TopRankedItemsResponse {
  top_items: TopRankedItem[];
  others: number;
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
