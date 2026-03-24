import { apiRequest } from "./apiClient";

/* ============================================================
   TYPES — match /media/search
============================================================ */

export interface MediaPayload {
  id: number;
  product_id: number;
  child_product_id?: number | null;
  parent_product_id?: number | null;
  part_number: string;
  description?: string | null;
  length: number;
  width: number;
  unit_of_measure: string;

  media_category: string;
  supplier_name: string;

  on_hand: number;
  reserved: number;
  ordered: number;
  available: number;
  backordered: number;
}

export type CreateMediaPayload = {
  part_number: string;
  supplier_id: number;
  category_id: number;
  description?: string | null;
  length?: number;
  width?: number;
  unit_of_measure?: string;
};

export interface MediaResponse {
  page: number;
  limit: number;
  count: number;
  total: number;
  results: MediaPayload[];
}

export interface MediaCategory {
  id: number;
  name: string;
}

/* ============================================================
   SEARCH PARAMS
============================================================ */

export interface MediaSearchParams {
  part_number?: string;
  description?: string;
  supplier?: string;
  category?: string;
  length?: number;
  width?: number;
  unit_of_measure?: string;
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
 * Server-side filtered + paginated media search
 */
export function fetchMedia(
  page = 1,
  limit = 10,
  filters: MediaSearchParams = {}
): Promise<MediaResponse> {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", String(limit));

  if (filters.part_number) params.set("part_number", filters.part_number);
  if (filters.description) params.set("description", filters.description);
  if (filters.supplier) params.set("supplier", filters.supplier);
  if (filters.category !== undefined) params.set("category", String(filters.category));
  if (filters.length !== undefined) params.set("length", String(filters.length));
  if (filters.width !== undefined) params.set("width", String(filters.width));
  if (filters.unit_of_measure) params.set("unit_of_measure", filters.unit_of_measure);
  if (filters.location !== undefined) params.set("location", String(filters.location));
  if (filters.status) params.set("status", filters.status);
  if (filters.on_hand_min !== undefined) params.set("on_hand", String(filters.on_hand_min));
  if (filters.reserved_min !== undefined) params.set("reserved", String(filters.reserved_min));
  if (filters.ordered_min !== undefined) params.set("ordered", String(filters.ordered_min));
  if (filters.available_min !== undefined) params.set("available", String(filters.available_min));
  if (filters.backordered_min !== undefined) params.set("backordered", String(filters.backordered_min));

  return apiRequest(`/media/search?${params.toString()}`, {
    method: "GET",
  });
}

export function fetchMediaCategories(): Promise<MediaCategory[]> {
  return apiRequest("/media_categories");
}

/* ============================================================
   CRUD
============================================================ */

export function fetchMediaById(id: string | number) {
  return apiRequest(`/media/${id}`);
}

export function createMedia(data: CreateMediaPayload) {
  return apiRequest("/media", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateMedia(
  id: string | number,
  data: Partial<MediaPayload>
) {
  return apiRequest(`/media/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function patchMedia(
  id: string | number,
  data: {
    supplier_id?: number;
    category_id?: number;
    length?: number;
    width?: number;
    unit_of_measure?: string;
    description?: string | null;
    part_number?: string;
  }
) {
  return apiRequest(`/media/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteMedia(id: string | number) {
  return apiRequest(`/media/${id}`, {
    method: "DELETE",
  });
}
