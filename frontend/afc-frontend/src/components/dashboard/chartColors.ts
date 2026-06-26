export const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#6366f1",
  "#14b8a6",
  "#f43f5e",
  "#a855f7",
  "#22c55e",
  "#fb923c",
];

export function getProductColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function getDotFill(isHovered: boolean, hasOrder: boolean): string {
  if (isHovered) return hasOrder ? "#2563eb" : "#2d3143";
  return hasOrder ? "#3b82f6" : "#363b4c";
}
