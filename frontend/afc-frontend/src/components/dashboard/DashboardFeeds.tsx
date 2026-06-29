import { Link } from "react-router-dom";
import type { RecentOrder, RecentTransaction } from "../../api/dashboard";
import {
  orderDisplayLabel,
  orderDetailPath,
  productDetailPath,
} from "../../utils/dashboardLinks";

interface DashboardFeedsProps {
  recentTransactions: RecentTransaction[];
  recentOrders: RecentOrder[];
  loading: boolean;
  error: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardFeeds({
  recentTransactions,
  recentOrders,
  loading,
  error,
}: DashboardFeedsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center py-4 text-red-500 text-sm">{error}</p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-semibold uppercase text-gray-700 mb-4">
          Recent Stock Movements
        </h2>
        {recentTransactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No recent transactions</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentTransactions.map((txn) => (
              <li key={txn.id} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="text-gray-700 capitalize block">
                    {txn.reason.replace(/_/g, " ")}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                    {txn.order_id != null && (
                      <Link
                        to={orderDetailPath(txn.order_id)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {orderDisplayLabel(txn)}
                      </Link>
                    )}
                    {txn.product_id != null && txn.product_name && (
                      <>
                        {txn.order_id != null && <span className="text-gray-300">·</span>}
                        <Link
                          to={productDetailPath(txn.product_id)}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {txn.product_name}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-medium tabular-nums ${txn.quantity_delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {txn.quantity_delta >= 0 ? "+" : ""}{txn.quantity_delta}
                  </span>
                  <span className="text-gray-400 text-xs">{formatDate(txn.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-semibold uppercase text-gray-700 mb-4">
          Recent Completed Orders
        </h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No recent orders</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentOrders.map((order) => (
              <li key={order.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                <Link
                  to={orderDetailPath(order.id)}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {orderDisplayLabel(order)}
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 capitalize">{order.type}</span>
                  <span className="text-gray-400 text-xs">{formatDate(order.completed_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
