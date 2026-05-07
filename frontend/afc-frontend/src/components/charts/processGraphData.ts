import type { PendingProjectionItem } from "../../api/productDetail";

/* ============================================================
   TYPES
============================================================ */

export interface DailyOrder {
  id: number;
  order_id: number | null;
  order_number: string | null;
  external_order_number: string | null;
  order_type: string | null;
  quantity_delta: number;
  reason: string;
}

export interface ProjectedStockPoint {
  date: string;
  projectedStock: number;
  dailyOrders: DailyOrder[];
  isFiller?: boolean;
}

export interface StackedProjectedStockPoint {
  date: string;
  [key: string]: string | number | boolean | DailyOrder[] | undefined; // Allow dynamic product keys
  isFiller?: boolean;
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

/** Add days to a date and return a new Date */
function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
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
 * 4. Filler points  – adds intermediate points between data dates for smooth slopes.
 * 5. Date interval  – only includes points within [startDate, endDate].
 */
export function processGraphData(
  rawOrders: PendingProjectionItem[],
  currentStockOnHand: number,
  options?: {
    fillerIntervalDays?: number;
    startDate?: string;
    endDate?: string;
  },
): ProjectedStockPoint[] {
  const fillerInterval = options?.fillerIntervalDays ?? 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toYMD(today);

  // Determine the display window
  const windowStart = options?.startDate ? new Date(options.startDate + "T00:00:00") : new Date(today);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = options?.endDate ? new Date(options.endDate + "T00:00:00") : addDays(today, 30);
  windowEnd.setHours(0, 0, 0, 0);

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
      external_order_number: order.external_order_number ?? null,
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

  /* --- 3. Build data points with running total ------------------- */
  let runningStock = currentStockOnHand;
  const realPoints = new Map<string, ProjectedStockPoint>();

  for (const date of sortedDates) {
    const orders = grouped.get(date)!;
    const dailyNet = orders.reduce((sum, o) => sum + o.quantity_delta, 0);
    runningStock += dailyNet;

    realPoints.set(date, {
      date,
      projectedStock: runningStock,
      dailyOrders: orders,
    });
  }

  /* --- 4. Build full timeline with filler points ----------------- */
  const result: ProjectedStockPoint[] = [];
  const windowStartStr = toYMD(windowStart);
  const windowEndStr = toYMD(windowEnd);

  // Always include the starting point (today / windowStart)
  // Calculate stock at window start considering all orders before/on that date
  let stockAtWindowStart = currentStockOnHand;
  for (const date of sortedDates) {
    if (date <= windowStartStr && realPoints.has(date)) {
      stockAtWindowStart = realPoints.get(date)!.projectedStock;
    }
  }

  let lastStock = stockAtWindowStart;
  let current = new Date(windowStart);

  while (toYMD(current) <= windowEndStr) {
    const dateStr = toYMD(current);
    const realPoint = realPoints.get(dateStr);

    if (realPoint) {
      lastStock = realPoint.projectedStock;
      result.push(realPoint);
    } else {
      // Only add filler if it's on the filler interval grid
      const daysSinceStart = Math.round(
        (current.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceStart % fillerInterval === 0 || dateStr === windowStartStr || dateStr === windowEndStr) {
        result.push({
          date: dateStr,
          projectedStock: lastStock,
          dailyOrders: [],
          isFiller: true,
        });
      }
    }

    current = addDays(current, 1);
  }

  return result;
}

/* ============================================================
   processStackedGraphData
============================================================ */

/**
 * Transforms raw pending-projection orders for multiple products into 
 * stacked area chart data points.
 *
 * @param productProjections - Array of {productId, productName, orders, currentStock}
 * @param options - Same options as processGraphData (date range, filler interval)
 * @returns Array of data points with date and per-product stock levels
 */
export function processStackedGraphData(
  productProjections: {
    productId: number;
    productName: string;
    orders: PendingProjectionItem[];
    currentStockOnHand: number;
  }[],
  options?: {
    fillerIntervalDays?: number;
    startDate?: string;
    endDate?: string;
  },
): StackedProjectedStockPoint[] {
  const fillerInterval = options?.fillerIntervalDays ?? 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toYMD(today);

  // Determine the display window
  const windowStart = options?.startDate ? new Date(options.startDate + "T00:00:00") : new Date(today);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = options?.endDate ? new Date(options.endDate + "T00:00:00") : addDays(today, 30);
  windowEnd.setHours(0, 0, 0, 0);

  const windowStartStr = toYMD(windowStart);
  const windowEndStr = toYMD(windowEnd);

  // Process each product to get individual timelines
  const productTimelines = new Map<number, Map<string, number>>();
  
  for (const { productId, orders, currentStockOnHand } of productProjections) {
    /* --- 1. Clamp & group ----------------------------------------- */
    const grouped = new Map<string, PendingProjectionItem[]>();

    for (const order of orders) {
      // Orders without an ETA or with past-due ETAs are clamped to today
      let effectiveEta = todayStr;
      if (order.eta) {
        const etaDate = new Date(order.eta);
        etaDate.setHours(0, 0, 0, 0);
        effectiveEta = etaDate < today ? todayStr : toYMD(etaDate);
      }

      const existing = grouped.get(effectiveEta);
      if (existing) {
        existing.push(order);
      } else {
        grouped.set(effectiveEta, [order]);
      }
    }

    /* --- 2. Sort chronologically ----------------------------------- */
    const sortedDates = [...grouped.keys()].sort();

    /* --- 3. Build running total for this product ------------------- */
    let runningStock = currentStockOnHand;
    const timeline = new Map<string, number>();

    for (const date of sortedDates) {
      const ordersOnDate = grouped.get(date)!;
      const dailyNet = ordersOnDate.reduce((sum, o) => sum + o.quantity_delta, 0);
      runningStock += dailyNet;
      timeline.set(date, runningStock);
    }

    // Calculate stock at window start
    let stockAtWindowStart = currentStockOnHand;
    for (const date of sortedDates) {
      if (date <= windowStartStr && timeline.has(date)) {
        stockAtWindowStart = timeline.get(date)!;
      }
    }

    // Extend timeline to full window with filler values
    const fullTimeline = new Map<string, number>();
    let lastStock = stockAtWindowStart;
    let current = new Date(windowStart);

    while (toYMD(current) <= windowEndStr) {
      const dateStr = toYMD(current);
      if (timeline.has(dateStr)) {
        lastStock = timeline.get(dateStr)!;
        fullTimeline.set(dateStr, lastStock);
      } else {
        fullTimeline.set(dateStr, lastStock);
      }
      current = addDays(current, 1);
    }

    productTimelines.set(productId, fullTimeline);
  }

  /* --- 4. Merge all timelines into stacked data points ----------- */
  const result: StackedProjectedStockPoint[] = [];
  let current = new Date(windowStart);

  while (toYMD(current) <= windowEndStr) {
    const dateStr = toYMD(current);
    
    // Only add points on the filler interval grid
    const daysSinceStart = Math.round(
      (current.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceStart % fillerInterval === 0 || dateStr === windowStartStr || dateStr === windowEndStr) {
      const point: StackedProjectedStockPoint = {
        date: dateStr,
      };

      // Add each product's stock level for this date
      for (const { productId, productName } of productProjections) {
        const timeline = productTimelines.get(productId);
        if (timeline) {
          const stockLevel = timeline.get(dateStr) ?? 0;
          point[`product_${productId}`] = stockLevel;
          point[`product_${productId}_name`] = productName;
        }
      }

      result.push(point);
    }

    current = addDays(current, 1);
  }

  return result;
}
