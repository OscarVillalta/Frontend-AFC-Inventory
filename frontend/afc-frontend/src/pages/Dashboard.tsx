import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../hooks/useAuth";
import { useWarehouse } from "../hooks/useWarehouse";
import { fetchDashboardStats } from "../api/dashboard";
import type { DashboardStatsResponse } from "../api/dashboard";

/* ── helpers ────────────────────────────────────────────────────── */

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ── component ──────────────────────────────────────────────────── */

export default function Dashboard() {
  const { hasPermission } = useAuth();
  const { activeWarehouseId } = useWarehouse();

  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardStats()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeWarehouseId]);

  /* ── KPI card definitions ───────────────────────────────────── */

  const kpiCards = [
    {
      label: "Open Orders",
      value: data?.kpis.open_orders,
      color: "text-primary",
      permission: "orders:view",
    },
    {
      label: "Pending Transactions",
      value: data?.kpis.pending_txns,
      color: "text-warning",
      permission: "inventory:view",
    },
    {
      label: "Low Stock",
      value: data?.kpis.low_stock,
      color: "text-error",
      permission: "inventory:view",
    },
    {
      label: "Backordered",
      value: data?.kpis.backordered,
      color: "text-orange-500",
      permission: "inventory:view",
    },
    {
      label: "Active Batches",
      value: data?.kpis.active_batches,
      color: "text-purple-600",
      permission: "conversions:view",
    },
  ];

  /* ── Quick-action definitions ───────────────────────────────── */

  const quickActions = [
    {
      label: "Pull from QuickBooks",
      to: "/orders/search",
      permission: "qb:pull_orders",
      bg: "bg-indigo-600 hover:bg-indigo-700",
    },
    {
      label: "Create Manual Order",
      to: "/order",
      permission: "orders:create",
      bg: "bg-blue-600 hover:bg-blue-700",
    },
    {
      label: "Add New Product",
      to: "/inventory",
      permission: "catalog:create",
      bg: "bg-green-600 hover:bg-green-700",
    },
    {
      label: "Start Production Batch",
      to: "/conversions",
      permission: "conversions:create",
      bg: "bg-amber-600 hover:bg-amber-700",
    },
    {
      label: "Stock Transfer",
      to: "#",
      permission: "inventory:transfer",
      bg: "bg-gray-700 hover:bg-gray-800",
    },
  ];

  /* ── render ─────────────────────────────────────────────────── */

  return (
    <MainLayout>
      <div className="p-6 space-y-10">
        {/* PAGE TITLE */}
        <h1 className="text-3xl font-bold text-gray-800">Dashboard Overview</h1>

        {/* LOADING INDICATOR */}
        {loading && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── AT-A-GLANCE KPI ROW ─────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {kpiCards.map(
                (card) =>
                  hasPermission(card.permission) && (
                    <div
                      key={card.label}
                      className="stat bg-white rounded-xl shadow border border-gray-100 p-4"
                    >
                      <div className="stat-title text-gray-500">{card.label}</div>
                      <div className={`stat-value ${card.color}`}>
                        {card.value ?? 0}
                      </div>
                    </div>
                  ),
              )}
            </div>

            {/* ── QUICK ACTIONS ───────────────────────────────── */}
            <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {quickActions.map(
                  (action) =>
                    hasPermission(action.permission) && (
                      <Link
                        key={action.label}
                        to={action.to}
                        className={`btn text-white w-full ${action.bg}`}
                      >
                        {action.label}
                      </Link>
                    ),
                )}
              </div>
            </div>

            {/* ── LIVE FEEDS ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Transactions */}
              {hasPermission("inventory:view") && (
                <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
                  <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>

                  {data.feeds.recent_transactions.length === 0 ? (
                    <p className="text-gray-400 text-sm">No recent transactions.</p>
                  ) : (
                    <table className="table w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="py-2">ID</th>
                          <th className="py-2">Qty Δ</th>
                          <th className="py-2">Reason</th>
                          <th className="py-2 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.feeds.recent_transactions.map((tx) => (
                          <tr key={tx.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 font-medium">{tx.id}</td>
                            <td
                              className={`py-2 font-semibold ${
                                tx.quantity_delta >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {tx.quantity_delta >= 0
                                ? `+${tx.quantity_delta}`
                                : tx.quantity_delta}
                            </td>
                            <td className="py-2 text-gray-600">{tx.reason}</td>
                            <td className="py-2 text-right text-gray-500">
                              {fmtDate(tx.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Recent Orders */}
              {hasPermission("orders:view") && (
                <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
                  <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>

                  {data.feeds.recent_orders.length === 0 ? (
                    <p className="text-gray-400 text-sm">No recent orders.</p>
                  ) : (
                    <table className="table w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="py-2">ID</th>
                          <th className="py-2">Order #</th>
                          <th className="py-2">Type</th>
                          <th className="py-2 text-right">Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.feeds.recent_orders.map((order) => (
                          <tr key={order.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 font-medium">{order.id}</td>
                            <td className="py-2">{order.order_number}</td>
                            <td className="py-2">
                              <span className="badge badge-outline badge-sm">
                                {order.type}
                              </span>
                            </td>
                            <td className="py-2 text-right text-gray-500">
                              {order.completed_at
                                ? fmtDate(order.completed_at)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ERROR / EMPTY STATE */}
        {!loading && !data && (
          <div className="text-center py-12 text-gray-400">
            Unable to load dashboard data. Please try again later.
          </div>
        )}
      </div>
    </MainLayout>
  );
}
