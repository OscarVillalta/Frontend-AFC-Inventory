import type { RecentOrder, RecentTransaction } from "../../api/dashboard";

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
          Recent Transactions
        </h2>
        {recentTransactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No recent transactions</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentTransactions.map((txn) => (
              <li key={txn.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-700 capitalize">{txn.reason.replace(/_/g, " ")}</span>
                <div className="flex items-center gap-3">
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
                <a
                  href={`/orders/${order.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {order.order_number}
                </a>
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
