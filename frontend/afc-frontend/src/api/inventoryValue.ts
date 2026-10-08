import { apiRequest } from "./apiClient";

export interface InventoryValueGroup {
  supplier_id: number | null;
  supplier_name: string | null;
  product_id: number | null;
  product_name: string | null;
  unit_price: number | null;
  on_hand_units: number;
  sku_count: number;
  gross_total: number;
}

export interface InventoryValue {
  gross_total: number;
  on_hand_units: number;
  sku_count: number;
  unpriced_skus: number;
  supplier_id: number | null;
  product_id: number | null;
  group_by: "supplier" | "product" | null;
  groups: InventoryValueGroup[];
  groups_truncated: boolean;
}

export interface InventoryValueQuery {
  supplierId?: number;
  groupBy?: "supplier" | "product";
  q?: string;
  limit?: number;
}

const MAX_GROUPS = 50;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asInt(value: unknown): number {
  const parsed = asNumber(value);
  return parsed === null ? 0 : Math.trunc(parsed);
}

function asId(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeGroup(value: unknown): InventoryValueGroup | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    supplier_id: asId(row.supplier_id),
    supplier_name: asText(row.supplier_name),
    product_id: asId(row.product_id),
    product_name: asText(row.product_name),
    unit_price: asNumber(row.unit_price),
    on_hand_units: asInt(row.on_hand_units),
    sku_count: asInt(row.sku_count),
    gross_total: asNumber(row.gross_total) ?? 0,
  };
}

/** Coerce the value payload so a partial response cannot throw during render. */
export function normalizeInventoryValue(value: unknown): InventoryValue {
  const row = asRecord(value);
  if (!row) {
    throw new Error("Unexpected inventory value response");
  }
  const groupBy = row.group_by === "supplier" || row.group_by === "product" ? row.group_by : null;
  const groups = Array.isArray(row.groups)
    ? row.groups.map(normalizeGroup).filter((group): group is InventoryValueGroup => group !== null).slice(0, MAX_GROUPS)
    : [];
  return {
    gross_total: asNumber(row.gross_total) ?? 0,
    on_hand_units: asInt(row.on_hand_units),
    sku_count: asInt(row.sku_count),
    unpriced_skus: asInt(row.unpriced_skus),
    supplier_id: asId(row.supplier_id),
    product_id: asId(row.product_id),
    group_by: groupBy,
    groups,
    groups_truncated: row.groups_truncated === true || (Array.isArray(row.groups) && row.groups.length > MAX_GROUPS),
  };
}

export async function fetchInventoryValue(
  query: InventoryValueQuery = {},
  signal?: AbortSignal,
): Promise<InventoryValue> {
  const params = new URLSearchParams();
  if (query.supplierId && query.supplierId > 0) {
    params.set("supplier_id", String(Math.trunc(query.supplierId)));
  }
  if (query.groupBy) params.set("group_by", query.groupBy);
  const q = query.q?.trim().slice(0, 80);
  if (q) params.set("q", q);
  if (query.groupBy) params.set("limit", String(query.limit && query.limit > 0 ? Math.min(query.limit, MAX_GROUPS) : MAX_GROUPS));
  const qs = params.toString();
  const payload = await apiRequest(`/inventory/value${qs ? `?${qs}` : ""}`, { method: "GET", signal });
  return normalizeInventoryValue(payload);
}
