/** Unit price / gross value (on_hand × unit_price) range filters. Ignored by the API without price:manage. */
export interface PriceFilterParams {
  unit_price_min?: number;
  unit_price_max?: number;
  gross_value_min?: number;
  gross_value_max?: number;
}

const PRICE_FILTER_KEYS = [
  "unit_price_min",
  "unit_price_max",
  "gross_value_min",
  "gross_value_max",
] as const;

export function setPriceFilterParams(params: URLSearchParams, filters: PriceFilterParams) {
  for (const key of PRICE_FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined) params.set(key, String(value));
  }
}
