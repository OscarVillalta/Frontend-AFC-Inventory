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

  // #region agent log
  if (recentTransactions.length > 0) {
    const sample = recentTransactions.slice(0, 3).map((txn) => ({
      id: txn.id,
      order_id: txn.order_id,
      order_number: txn.order_number,
      external_order_number: txn.external_order_number,
      product_id: txn.product_id,
      product_name: txn.product_name,
      showOrder: txn.order_id != null,
      showProduct: txn.product_id != null && !!txn.product_name,
    }));
    fetch('http://127.0.0.1:7756/ingest/b534a512-8c61-4949-b370-9c3da92fffc9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'495c74'},body:JSON.stringify({sessionId:'495c74',hypothesisId:'C,D',location:'DashboardFeeds.tsx:render',message:'feed render branch checks',data:{count:recentTransactions.length,sample},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion

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
