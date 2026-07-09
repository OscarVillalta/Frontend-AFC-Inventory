import { apiRequest } from "./apiClient";
import type { OrderType } from "../constants/orderTypes";

export type OrderItemType = "Unit_Separator" | "Section_Separator" | "Product_Item" | "Sales_Item";

export interface OrderItemPayload {
  id: number;
  order_id: number;
  product_id: number | null;
  type: OrderItemType;
  part_number: string;
  quantity_ordered: number;
  quantity_fulfilled: number;
  quantity_pending: number;
  status:string;
  note?: string;
  position: number;
  on_hand: number | null;
  reserved: number | null;
  available: number | null;
  is_media: boolean;
  no_stock_deduction: boolean;
  on_hand_by_warehouse?: Record<string, number> | null;
  available_by_warehouse?: Record<string, number> | null;
  has_blocking_transactions: boolean;
  has_any_transactions: boolean;
}

export interface OrderItemTransaction {
  id: number;
  quantity_delta: number;
  state: "pending" | "committed" | "cancelled" | "rolled_back";
  reason: string;
  note?: string;
  created_at: string;
}

export function fetchOrderItems(orderId: string) {
  return apiRequest(
    `/orders/${orderId}/items`
  ) as Promise<OrderItemPayload[]>;
}

export function fetchOrderSerialized(orderId: string | number, itemIds?: number[]) {
  const params = itemIds && itemIds.length > 0
    ? `?item_ids=${itemIds.join(",")}`
    : "";
  return apiRequest(
    `/orders/${orderId}/serialize${params}`
  ) as Promise<{ serialized: string }>;
}

export function fetchOrderItemTransactions(itemId: number) {
  return apiRequest(
    `/order_items/${itemId}/transactions`
  ) as Promise <OrderItemTransaction[]>;
}

export function createOrderItemTransaction(
  payload: {
    product_id: number | null;
    order_id: number;
    order_item_id: number;
    quantity_delta: number;
    reason: string;
    note?: string;
  }
) {
    console.log(JSON.stringify(payload))
  // No auto_commit here — we want PENDING transactions
  return apiRequest(`/transactions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function commitTransaction(transactionId: number) {
  return apiRequest(`/transactions/${transactionId}/commit`, {
    method: "PATCH",
  });
}

export function cancelTransaction(transactionId: number) {
  return apiRequest(`/transactions/${transactionId}/cancel`, {
    method: "PATCH",
  });
}

export function rollbackTransaction(transactionId: number) {
  return apiRequest(`/transactions/${transactionId}/rollback`, {
    method: "PATCH",
  });
}

export function allocateOrderItem(itemId: number, note?: string) {
  return apiRequest(`/order_items/${itemId}/allocate_remaining`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}
export function commitAllOrderItemTransactions(itemId: number) {
  return apiRequest(`/order_items/${itemId}/commit_all`, {
    method: "PATCH",
  });
}

export function createOrderItem(payload: {
  order_id: number;
  product_id?: number | null;
  type?: OrderItemType;
  quantity_ordered?: number;
  note?: string;
  position?: number;
}) {
  console.log(JSON.stringify(payload))
  return apiRequest("/order_items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteOrderItem(itemId: number) {
  return apiRequest(`/order_items/${itemId}`, {
    method: "DELETE",
  });
}

export function reorderOrderItems(orderId: number, itemId: number, newPosition: number) {
  return apiRequest(`/orders/${orderId}/items/reorder`, {
    method: "PATCH",
    body: JSON.stringify({
      item_id: itemId,
      new_position: newPosition,
    }),
  });
}

export function updateOrderItem(itemId: number, payload: {
  quantity_ordered?: number;
  note?: string;
  type?: OrderItemType;
  no_stock_deduction?: boolean;
}): Promise<void> {
  return apiRequest(`/order_items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function void_order(orderId: number) {
  return apiRequest(`/orders/${orderId}/void`, {
    method: "POST",
  });
}

const SEPARATOR_TYPES: OrderItemType[] = ["Unit_Separator", "Section_Separator"];

export function itemSkipsInventoryForOrder(
  item: OrderItemPayload,
  orderType: OrderType,
): boolean {
  if (orderType === "incoming") return false;
  return Boolean(item.no_stock_deduction);
}

export function hasStockTrackableItems(
  items: OrderItemPayload[],
  orderType: OrderType,
): boolean {
  return items.some(
    (item) =>
      !SEPARATOR_TYPES.includes(item.type)
      && !itemSkipsInventoryForOrder(item, orderType),
  );
}

export function canManualCompleteOrder(
  items: OrderItemPayload[],
  orderType: OrderType,
  orderStatus: string,
): boolean {
  if (orderType === "void") return false;
  if (orderStatus === "Completed" || orderStatus === "Voided") return false;
  if (items.length === 0) return false;
  return !hasStockTrackableItems(items, orderType);
}
