export const PRICE_MANAGE_PERMISSION = "price:manage";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUnitPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return usdFormatter.format(value);
}

/** on_hand × unit_price, or null when the product has no price. */
export function grossValue(onHand: number | null | undefined, unitPrice: number | null | undefined): number | null {
  if (unitPrice === null || unitPrice === undefined) return null;
  return (onHand ?? 0) * unitPrice;
}
