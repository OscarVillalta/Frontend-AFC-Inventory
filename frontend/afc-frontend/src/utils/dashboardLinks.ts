/** Prefer external order number when present, then internal order number. */
export function orderDisplayLabel(order: {
  id?: number;
  order_number?: string | null;
  external_order_number?: string | null;
}): string {
  if (order.external_order_number) return order.external_order_number;
  if (order.order_number) return order.order_number;
  return order.id != null ? `Order #${order.id}` : "—";
}

export function productDetailPath(productId: number): string {
  return `/products/${productId}`;
}

export function orderDetailPath(orderId: number): string {
  return `/orders/${orderId}`;
}
