import { useMemo, useState } from "react";

/** Format a Date to YYYY-MM-DD */
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Hook providing date range controls for the projected stock graph.
 * Default range: today → today + 1 month. Max end: today + 2 months.
 */
export function useProjectionDateRange() {
  const todayStr = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toYMD(d);
  }, []);

  const defaultEndStr = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + 1);
    return toYMD(d);
  }, []);

  const maxEndStr = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + 2);
    return toYMD(d);
  }, []);

  const [projStart, setProjStart] = useState(todayStr);
  const [projEnd, setProjEnd] = useState(defaultEndStr);
  const [projFillerInterval, setProjFillerInterval] = useState<1 | 2>(1);

  const resetRange = () => {
    setProjStart(todayStr);
    setProjEnd(defaultEndStr);
    setProjFillerInterval(1);
  };

  return {
    todayStr,
    defaultEndStr,
    maxEndStr,
    projStart,
    setProjStart,
    projEnd,
    setProjEnd,
    projFillerInterval,
    setProjFillerInterval,
    resetRange,
  };
}
