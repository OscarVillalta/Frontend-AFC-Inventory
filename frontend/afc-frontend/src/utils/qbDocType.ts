export const QB_DOC_TYPE_LABELS: Record<string, string> = {
  sales_order: "Sales Order",
  purchase_order: "Purchase Order",
  invoice: "Invoice",
  estimate: "Estimate",
};

export function formatQbExternalRef(
  externalOrderNumber: string,
  qbDocType?: string | null,
): string {
  if (!qbDocType) return externalOrderNumber;
  const label = QB_DOC_TYPE_LABELS[qbDocType] ?? qbDocType.replace(/_/g, " ");
  return `${label} #${externalOrderNumber}`;
}
