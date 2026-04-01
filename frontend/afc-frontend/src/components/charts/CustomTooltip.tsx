import type { ProjectedStockPoint } from "./processGraphData";

/* ============================================================
   CustomTooltip – Recharts <Tooltip content={…} />
============================================================ */

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: ProjectedStockPoint }[];
  label?: string;
}

export default function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;

  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm pointer-events-none">
      {/* Date header */}
      <p className="font-semibold text-gray-800">{label}</p>

      {/* Projected stock */}
      <p className="text-gray-600 mt-1">
        Projected Stock: <span className="font-medium">{point.projectedStock}</span>
      </p>

      {/* Divider */}
      {point.dailyOrders.length > 0 && <hr className="my-2 border-gray-200" />}

      {/* Individual orders */}
      {point.dailyOrders.map((order) => {
        const identifier = order.order_number ?? `#${order.order_id ?? order.id}`;
        const isPositive = order.quantity_delta > 0;
        const isNegative = order.quantity_delta < 0;

        return (
          <div key={order.id} className="flex items-center justify-between gap-4">
            <span className="text-gray-700 truncate max-w-[140px]">{identifier}</span>
            <span
              className={`font-medium tabular-nums ${
                isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-600"
              }`}
            >
              {isPositive ? "+" : ""}
              {order.quantity_delta}
            </span>
          </div>
        );
      })}
    </div>
  );
}
