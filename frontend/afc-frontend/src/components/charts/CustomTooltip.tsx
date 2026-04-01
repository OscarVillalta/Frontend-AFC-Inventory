import type { ProjectedStockPoint } from "./processGraphData";

/* ============================================================
   CustomTooltip – used as a positioned overlay (not via Recharts
   <Tooltip content={…}>) so the position stays fixed at the dot.
============================================================ */

interface CustomTooltipProps {
  point: ProjectedStockPoint;
  label?: string;
}

export default function CustomTooltip({ point, label }: CustomTooltipProps) {
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm">
      {/* Date header */}
      <p className="font-semibold text-gray-800">{label ?? point.date}</p>

      {/* Projected stock */}
      <p className="text-gray-600 mt-1">
        Projected Stock: <span className="font-medium">{point.projectedStock}</span>
      </p>

      {/* Divider */}
      {point.dailyOrders.length > 0 && <hr className="my-2 border-gray-200" />}

      {/* Individual orders */}
      {point.dailyOrders.map((order) => {
        // Use external_order_number if available, otherwise fall back to order_number
        const identifier = order.external_order_number
          ? order.external_order_number
          : order.order_number ?? `#${order.order_id ?? order.id}`;
        const isPositive = order.quantity_delta > 0;
        const isNegative = order.quantity_delta < 0;
        const orderLink = order.order_id ? `/orders/${order.order_id}` : null;

        return (
          <div key={order.id} className="flex items-center justify-between gap-4">
            {orderLink ? (
              <a
                href={orderLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate max-w-[140px]"
                onClick={(e) => e.stopPropagation()}
              >
                {identifier}
              </a>
            ) : (
              <span className="text-gray-700 truncate max-w-[140px]">{identifier}</span>
            )}
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
