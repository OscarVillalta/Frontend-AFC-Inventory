import type { OrderItemPayload } from "../../../api/orderDetail";

export interface ProductLogRow {
  product_id: number;
  part_number: string;
  description: string;
  total_count: number;
}

export function extractBuildingNames(items: OrderItemPayload[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (item.type === "Section_Separator") {
      const name = item.note || "Unnamed Building";
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
  }
  return result;
}

export function filterItemsByBuilding(
  items: OrderItemPayload[],
  selectedBuilding: string,
): OrderItemPayload[] {
  if (selectedBuilding === "__all__") return items;

  const result: OrderItemPayload[] = [];
  let inBuilding = false;
  for (const item of items) {
    if (item.type === "Section_Separator") {
      inBuilding = (item.note || "Unnamed Building") === selectedBuilding;
    }
    if (inBuilding) {
      result.push(item);
    }
  }
  return result;
}

export function aggregateProductLogRows(
  items: OrderItemPayload[],
  buildingFilter = "__all__",
): ProductLogRow[] {
  const filteredItems = filterItemsByBuilding(items, buildingFilter);
  const map = new Map<number, ProductLogRow>();

  for (const item of filteredItems) {
    if (item.type === "Unit_Separator" || item.type === "Section_Separator") continue;
    if (!item.product_id) continue;

    const existing = map.get(item.product_id);
    if (existing) {
      existing.total_count += item.quantity_ordered;
      if (!existing.description && item.note?.trim()) {
        existing.description = item.note.trim();
      }
    } else {
      map.set(item.product_id, {
        product_id: item.product_id,
        part_number: item.part_number,
        description: item.note?.trim() ?? "",
        total_count: item.quantity_ordered,
      });
    }
  }

  return sortByTotalCountDesc(Array.from(map.values()), (row) => row.total_count);
}

export function sortByTotalCountDesc<T extends { part_number: string }>(
  rows: T[],
  getTotalCount: (row: T) => number,
): T[] {
  return [...rows].sort((a, b) => {
    const countDiff = getTotalCount(b) - getTotalCount(a);
    if (countDiff !== 0) return countDiff;
    return a.part_number.localeCompare(b.part_number);
  });
}

export function formatOrderPrintDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}
