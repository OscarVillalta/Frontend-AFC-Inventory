import { apiRequest } from "./apiClient";
import type { OrderDetailPayload } from "./ordersTable";

export type OutgoingOrderType = "Installation" | "Will Call" | "Shipment" | "Delivery";

export type Department =
  | "SALES"
  | "LOGISTICS"
  | "DELIVERY_DEPT"
  | "SERVICE"
  | "ACCOUNTING";

export interface OrderTrackerPayload {
  id: number;
  order_id: number;
  current_department: Department;
  step_index: number;
  is_backordered: boolean;
  updated_at: string;
}

export interface OrderHistoryPayload {
  id: number;
  order_id: number;
  from_department: Department | null;
  to_department: Department;
  action_taken: string;
  performed_by: string;
  completed_at: string;
  comments?: string | null;
}

export interface OrderTrackerStagePayload {
  id: number;
  order_id: number;
  stage_index: number;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
}

/** Joined view: an Order with its current tracking status and full history. */
export interface OrderWithTracking {
  order: OrderDetailPayload;
  tracker: OrderTrackerPayload | null;
  history: OrderHistoryPayload[];
  stages: OrderTrackerStagePayload[];
}

/** Single row returned by the GET /packing-slips endpoint. */
export interface PackingSlipResult {
  id: number;
  order_number: string;
  external_order_number?: string | null;
  order_type?: string | null;
  status: string;
  description?: string | null;
  customer_name?: string | null;
  supplier_name?: string | null;
  created_at: string;
  completed_at?: string | null;
  eta?: string | null;
  is_paid: boolean;
  is_invoiced: boolean;
  tracker: OrderTrackerPayload | null;
  history: OrderHistoryPayload[];
  stages: OrderTrackerStagePayload[];
}

export interface PackingSlipsResponse {
  page: number;
  limit: number;
  total: number;
  status_counts: {
    "Not Started": number;
    "In Progress": number;
    Completed: number;
    Backordered: number;
  };
  results: PackingSlipResult[];
}

export function fetchOrderTracking(orderId: number | string) {
  return apiRequest(`/orders/${orderId}/tracker`) as Promise<OrderWithTracking>;
}

export function initOrderTracker(
  orderId: number | string,
  payload: { current_department: Department; step_index?: number }
) {
  return apiRequest(`/orders/${orderId}/tracker`, {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<OrderTrackerPayload>;
}

export function updateOrderTracker(
  orderId: number | string,
  payload: { current_department?: Department; step_index?: number; is_backordered?: boolean }
) {
  return apiRequest(`/orders/${orderId}/tracker`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }) as Promise<OrderTrackerPayload>;
}

export function toggleTrackerStage(
  orderId: number | string,
  stageIndex: number,
  payload: { is_completed: boolean; completed_by?: string }
) {
  return apiRequest(`/orders/${orderId}/tracker/stages/${stageIndex}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }) as Promise<OrderTrackerStagePayload>;
}

export function addOrderHistory(
  orderId: number | string,
  payload: {
    from_department?: Department | null;
    to_department: Department;
    action_taken: string;
    performed_by: string;
    comments?: string | null;
  }
) {
  return apiRequest(`/orders/${orderId}/history`, {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<OrderHistoryPayload>;
}

export function patchOrderPaidInvoiced(
  orderId: number | string,
  payload: { is_paid?: boolean; is_invoiced?: boolean }
) {
  return apiRequest(`/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchPackingSlips(params?: {
  page?: number;
  limit?: number;
  search?: string;
  tracker_status?: string;
  order_type?: string;
  // Created date filters
  start_date?: string;
  end_date?: string;
  before_date?: string;
  after_date?: string;
  // Last updated date filters
  updated_start_date?: string;
  updated_end_date?: string;
  updated_before_date?: string;
  updated_after_date?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.tracker_status) query.set("tracker_status", params.tracker_status);
  if (params?.order_type) query.set("order_type", params.order_type);
  // Created date filters
  if (params?.start_date) query.set("start_date", params.start_date);
  if (params?.end_date) query.set("end_date", params.end_date);
  if (params?.before_date) query.set("before_date", params.before_date);
  if (params?.after_date) query.set("after_date", params.after_date);
  // Last updated date filters
  if (params?.updated_start_date) query.set("updated_start_date", params.updated_start_date);
  if (params?.updated_end_date) query.set("updated_end_date", params.updated_end_date);
  if (params?.updated_before_date) query.set("updated_before_date", params.updated_before_date);
  if (params?.updated_after_date) query.set("updated_after_date", params.updated_after_date);
  return apiRequest(`/packing-slips?${query.toString()}`) as Promise<PackingSlipsResponse>;
}
