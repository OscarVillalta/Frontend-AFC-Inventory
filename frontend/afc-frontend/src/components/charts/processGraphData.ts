import type { PendingProjectionItem } from "../../api/productDetail";

/* ============================================================
   TYPES
============================================================ */

export interface DailyOrder {
  id: number;
  order_id: number | null;
  order_number: string | null;
  order_type: string | null;
  quantity_delta: number;
  reason: string;
}

export interface ProjectedStockPoint {
  date: string;
  projectedStock: number;
  dailyOrders: DailyOrder[];
}

/* ============================================================
   HELPERS
============================================================ */

/** Format a Date to YYYY-MM-DD */
function toYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ============================================================
   processGraphData
============================================================ */

/**
 * Transforms raw pending-projection orders into graph-ready data points.
 *
 * 1. Date clamping  – orders with an ETA older than today use today's date.
 * 2. Grouping       – orders on the same effective date are merged into one point.
 * 3. Running total  – a cumulative projected stock starting from `currentStockOnHand`.
 */
export function processGraphData(
  rawOrders: PendingProjectionItem[],
  currentStockOnHand: number,
): ProjectedStockPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toYMD(today);

  /* --- 1. Clamp & group ----------------------------------------- */
  const grouped = new Map<string, DailyOrder[]>();

  for (const order of rawOrders) {
    // Orders without an ETA or with past-due ETAs are clamped to today
    let effectiveEta = todayStr;
    if (order.eta) {
      const etaDate = new Date(order.eta);
      etaDate.setHours(0, 0, 0, 0);
      effectiveEta = etaDate < today ? todayStr : toYMD(etaDate);
    }

    const entry: DailyOrder = {
      id: order.id,
      order_id: order.order_id,
      order_number: order.order_number,
      order_type: order.order_type,
      quantity_delta: order.quantity_delta,
      reason: order.reason,
    };

    const existing = grouped.get(effectiveEta);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(effectiveEta, [entry]);
    }
  }

  /* --- 2. Sort chronologically ----------------------------------- */
  const sortedDates = [...grouped.keys()].sort();

  /* --- 3. Running total ------------------------------------------ */
  let runningStock = currentStockOnHand;

  return sortedDates.map((date) => {
    const orders = grouped.get(date)!;
    const dailyNet = orders.reduce((sum, o) => sum + o.quantity_delta, 0);
    runningStock += dailyNet;

    return {
      date,
      projectedStock: runningStock,
      dailyOrders: orders,
    };
  });
}
