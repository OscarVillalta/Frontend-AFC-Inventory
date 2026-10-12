export type SortDir = "asc" | "desc";

/** Server-side ordering for paginated search endpoints. Unknown keys are ignored by the API. */
export interface SortParams {
  sort_by?: string;
  sort_dir?: SortDir;
}

export function setSortParams(params: URLSearchParams, filters: SortParams) {
  if (!filters.sort_by) return;
  params.set("sort_by", filters.sort_by);
  params.set("sort_dir", filters.sort_dir ?? "asc");
}
