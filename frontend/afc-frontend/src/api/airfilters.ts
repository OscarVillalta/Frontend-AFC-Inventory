import { apiRequest } from "./apiClient";

/* ============================================================
   TYPES — match /air_filters/search
============================================================ */

export interface AirFilterPayload {
  id: number;
  product_id: number;
  child_product_id?: number | null;
  parent_product_id?: number | null;
  part_number: string;
  description?: string | null;
  merv_rating: number;

  height: number;
  width: number;
  depth: number;

  filter_category: string;
  supplier_name: string;

  on_hand: number;
  reserved: number;
  ordered: number;
  available: number;
  backordered: number;
}

export type CreateAirFilterPayload = Partial<AirFilterPayload> & {
  supplier_id: number;
  category_id: number;
  description?: string;
  merv_rating?: number;
  height?: number;
  width?: number;
  depth?: number;
};

export interface AirFilterResponse {
  page: number;
  limit: number;
  count: number;
  total: number;
  results: AirFilterPayload[];
}

export interface AirFilterCategory {
  id: number;
  name: string;
}

/* ============================================================
   SEARCH PARAMS
============================================================ */

export interface AirFilterSearchParams {
  part_number?: string;
  description?: string;
  supplier?: string;
  category?: string;
  merv?: number;
  height?: number;
  width?: number;
  depth?: number;
  location?: number;
  status?: "low_stock" | "backordered" | "has_orders";
  on_hand_min?: number;
  reserved_min?: number;
  ordered_min?: number;
  available_min?: number;
  backordered_min?: number;
}

/* ============================================================
   API FUNCTIONS
============================================================ */

/**
 * Server-side filtered + paginated air filter search
 */
export function fetchAirFilters(
  page = 1,
  limit = 10,
  filters: AirFilterSearchParams = {}
): Promise<AirFilterResponse> {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", String(limit));

  if (filters.part_number) params.set("part_number", filters.part_number);
  if (filters.description) params.set("description", filters.description);
  if (filters.supplier) params.set("supplier", filters.supplier);
  if (filters.category !== undefined) params.set("category", String(filters.category));
  if (filters.merv !== undefined) params.set("merv", String(filters.merv));
  if (filters.height !== undefined) params.set("height", String(filters.height));
  if (filters.width !== undefined) params.set("width", String(filters.width));
  if (filters.depth !== undefined) params.set("depth", String(filters.depth));
  if (filters.location !== undefined) params.set("location", String(filters.location));
  if (filters.status) params.set("status", filters.status);
  if (filters.on_hand_min !== undefined) params.set("on_hand_min", String(filters.on_hand_min));
  if (filters.reserved_min !== undefined) params.set("reserved_min", String(filters.reserved_min));
  if (filters.ordered_min !== undefined) params.set("ordered_min", String(filters.ordered_min));
  if (filters.available_min !== undefined) params.set("available_min", String(filters.available_min));
  if (filters.backordered_min !== undefined) params.set("backordered_min", String(filters.backordered_min));

  return apiRequest(`/air_filters/search?${params.toString()}`, {
    method: "GET",
  });
}

export function fetchAirFilterCategories(): Promise<AirFilterCategory[]> {
  return apiRequest("/air_filter_categories");
}

/* ============================================================
   CRUD (unchanged)
============================================================ */

export function fetchAirFilterById(id: string | number) {
  return apiRequest(`/air_filters/${id}`);
}

export function createAirFilter(data: CreateAirFilterPayload) {
  return apiRequest("/air_filters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAirFilter(
  id: string | number,
  data: Partial<AirFilterPayload>
) {
  return apiRequest(`/air_filters/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function patchAirFilter(
  id: string | number,
  data: {
    supplier_id?: number;
    category_id?: number;
    merv_rating?: number;
    height?: number;
    width?: number;
    depth?: number;
    description?: string | null;
    part_number?: string;
  }
) {
  return apiRequest(`/air_filters/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteAirFilter(id: string | number) {
  return apiRequest(`/air_filters/${id}`, {
    method: "DELETE",
  });
}
