import { useMemo, useState } from "react";
import { addMonthsKey, todayLocalKey } from "../utils/dateTime";

/**
 * Hook providing date range controls for the projected stock graph.
 * Default range: today → today + 1 month. Max end: today + 2 months.
 */
export function useProjectionDateRange() {
  const todayStr = useMemo(() => todayLocalKey(), []);

  const defaultEndStr = useMemo(() => addMonthsKey(todayStr, 1), [todayStr]);

  const maxEndStr = useMemo(() => addMonthsKey(todayStr, 2), [todayStr]);

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
