/**
 * Packing slip tracker search matches order numbers by numeric id (e.g. "123"),
 * not the full "AFC-000123" display form.
 */
export function orderNumberSearchTerm(orderNumber: string): string {
  const trimmed = orderNumber.trim();
  const withoutPrefix = trimmed.replace(/^AFC-/i, "");
  const digits = withoutPrefix.replace(/\D/g, "");
  if (!digits) return withoutPrefix;
  return digits.replace(/^0+/, "") || "0";
}
