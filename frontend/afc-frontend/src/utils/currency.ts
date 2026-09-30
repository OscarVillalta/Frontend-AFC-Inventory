export const PRICE_MANAGE_PERMISSION = "price:manage";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUnitPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return usdFormatter.format(value);
}
