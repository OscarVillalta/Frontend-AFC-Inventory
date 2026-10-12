import { useState } from "react";
import type { SortDir } from "../api/sort";

/** Clicking the active column flips direction; clicking another column sorts it ascending. */
export function useTableSort() {
  const [sortBy, setSortBy] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: string) => {
    if (key === sortBy) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  return { sortBy, sortDir, toggleSort };
}
