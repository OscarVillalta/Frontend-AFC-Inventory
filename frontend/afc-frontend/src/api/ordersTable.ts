import { apiRequest } from "./apiClient";

export interface OrderRowItemPayload {
  id: number;
  order_number?: string | null;
  type: string;
  cs_name: string;
  description: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  external_order_number?: string | null;
  qb_doc_type?: string | null;
}

export interface OrderResponse {
  count: number;  
  limit: number;
  page: number;
  results: OrderRowItemPayload[];
  total: number;
}

export interface OrderSearchParams {
  id?: number;
  order_number?: string;
  external_order_number?: string;
  description?: string;
  type?: string | string[];
  status?: string;
  cs_name?: string;
  customer_name?: string;
  supplier_name?: string;
  customer_id?: number | number[];
  supplier_id?: number | number[];
  created_from?: string;
  created_to?: string;
  completed_from?: string;
  completed_to?: string;
  product_ids?: string;
}

function appendListParam(
  params: URLSearchParams,
  key: string,
  values?: string | number | (string | number)[]
) {
  const list = Array.isArray(values) ? values : values !== undefined && values !== "" ? [values] : [];
  for (const value of list) {
    const trimmed = String(value).trim();
    if (trimmed) params.append(key, trimmed);
  }
}

export interface OrderDetailPayload {
  id: number;
  order_number: string;
  external_order_number: string;
  qb_doc_type?: string | null;
  type: "incoming" | "installation" | "will_call" | "delivery" | "shipment";
  order_type?: string | null;
  cs_name: string;
  status: "Pending" | "Partially Fulfilled" | "Completed";
  description: string;
  created_at: string;
  completed_at?: string | null;
  eta?: string | null;
  is_paid?: boolean;
  is_invoiced?: boolean;
  warehouse_id?: number | null;
  can_manual_complete?: boolean;
}

export function fetchOrders(
  page = 1,
  pageSize = 10,
  filters: OrderSearchParams = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });

  const { type, customer_id, supplier_id, product_ids, ...scalarFilters } = filters;

  Object.entries(scalarFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  });

  appendListParam(params, "type", type);
  appendListParam(params, "customer_id", customer_id);
  appendListParam(params, "supplier_id", supplier_id);

  if (product_ids !== undefined && product_ids !== "") {
    params.append("product_ids", product_ids);
  }

  return apiRequest(`/orders/search?${params.toString()}`);
}

export function fetchOrderById(orderId: string) {
  return apiRequest(`/orders/${orderId}`);
}

export function patchOrder(
  orderId: string,
  payload: {
    type?: "incoming" | "installation" | "will_call" | "delivery" | "shipment" | "void";
    order_type?: string | null;
    cs_id?: number;
    description?: string;
    created_at?: string;
    eta?: string | null;
  }
) {
  return apiRequest(`/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createOrder(payload: {
  type: "incoming" | "installation" | "will_call" | "delivery" | "shipment";
  customer_id?: number;
  supplier_id?: number;
  eta?: string | null;
  description?: string | null;
}) {
  console.log(JSON.stringify(payload))
  return apiRequest("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function allocateAll(orderId: number) {
  return apiRequest(`/orders/${orderId}/allocate-all`, {
    method: "POST",
  });
}

export function deleteOrder(orderId: string | number) {
  return apiRequest(`/orders/${orderId}`, {
    method: "DELETE",
  });
}

export function createOrderFromQB(payload: {
  reference_number: string;
  qb_doc_type: string;
  order_type?: string;
}) {
  return apiRequest("/orders/from-qb", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeOrderManual(orderId: string | number) {
  return apiRequest(`/orders/${orderId}/complete-manual`, {
    method: "POST",
  }) as Promise<{
    message: string;
    status: string;
    completed_at: string | null;
    can_manual_complete: boolean;
  }>;
}

export function forceOrderNoStock(orderId: string | number) {
  return apiRequest(`/orders/${orderId}/force-no-stock`, {
    method: "POST",
  }) as Promise<{
    message: string;
    status: string;
    completed_at: string | null;
    can_manual_complete: boolean;
  }>;
}