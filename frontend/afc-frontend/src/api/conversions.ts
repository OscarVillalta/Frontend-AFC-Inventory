import { apiRequest } from "./apiClient";

export interface ConversionDecreaseInput {
  product_id?: number;
  child_product_id?: number;
  quantity: number;
}

export interface ConversionIncreaseInput {
  product_id?: number;
  child_product_id?: number;
  quantity: number;
}

export interface ConversionInput {
  decreases: ConversionDecreaseInput[];
  increase: ConversionIncreaseInput;
  note?: string;
}

export interface ConversionRecord {
  id: number;
  batch_id: number | null;
  note?: string;
  created_at: string;
  state: string;
  decreases: {
    product_id?: number;
    child_product_id?: number;
    quantity: number;
    transaction_id: number;
  }[];
  increase: {
    product_id?: number;
    child_product_id?: number;
    quantity: number;
    transaction_id: number;
  };
}

export interface ConversionBatchRequest {
  note?: string;
  /** Can be sent along with external_ref; backend autofills the missing field */
  order_id?: number;
  created_by?: string;
  /** Can be sent along with order_id; backend autofills the missing field */
  external_ref?: string;
  conversions: ConversionInput[];
}

export interface ConversionBatchSummary {
  id: number;
  order_id?: number;
  note?: string;
  created_by?: string;
  external_ref?: string;
  created_at: string;
  totals?: { conversions: number };
}

export interface ConversionBatchDetail {
  batch: ConversionBatchSummary;
  conversions: ConversionRecord[];
}

export interface ConversionBatchSearchResponse {
  page: number;
  limit: number;
  total: number;
  results: ConversionBatchSummary[];
}

export function createConversionBatch(payload: ConversionBatchRequest) {
  return apiRequest("/conversion_batches", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<{ batch: ConversionBatchSummary; conversions?: ConversionRecord[] }>;
}

export function fetchConversionBatches(page = 1, limit = 10, search?: string, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  return apiRequest(`/conversion_batches/search?${params.toString()}`) as Promise<ConversionBatchSearchResponse>;
}

export function fetchConversionBatch(batchId: number) {
  return apiRequest(`/conversion_batches/${batchId}`) as Promise<ConversionBatchDetail>;
}

export function addConversionToBatch(batchId: number, payload: ConversionInput) {
  return apiRequest(`/conversion_batches/${batchId}/conversions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rollbackConversion(conversionId: number) {
  return apiRequest(`/conversions/${conversionId}/rollback`, {
    method: "PATCH",
  });
}

export function rollbackConversionBatch(batchId: number) {
  return apiRequest(`/conversion_batches/${batchId}/rollback`, {
    method: "PATCH",
  });
}
