import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
} from "recharts";
import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../hooks/useAuth";
import { useWarehouse } from "../hooks/useWarehouse";
import {
  fetchDashboardStats,
  fetchNetKpis,
  fetchBulkProjections,
  fetchDailyHistory,
  fetchTopRankedItems,
} from "../api/dashboard";
import type {
  DashboardStatsResponse,
  NetKpisResponse,
  BulkProjectionsResponse,
  DailyHistoryResponse,
  TopRankedItemsResponse,
} from "../api/dashboard";
import { fetchProducts, type Product } from "../api/products";
import KpiCard from "../components/KpiCard";
import MultiSelectAutocomplete from "../components/MultiSelectAutocomplete";

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

  // Net KPIs state
  const [netKpis, setNetKpis] = useState<NetKpisResponse | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);
  const [kpisLoading, setKpisLoading] = useState(false);

  // Products for autocomplete
  const [products, setProducts] = useState<Product[]>([]);

  // Multi-Product Projection state
  const [projectionProductIds, setProjectionProductIds] = useState<number[]>([]);
  const [projectionData, setProjectionData] = useState<BulkProjectionsResponse>({});
  const [projectionLoading, setProjectionLoading] = useState(false);

  // Historical Daily Stock state
  const [historyProductIds, setHistoryProductIds] = useState<number[]>([]);
  const [historyData, setHistoryData] = useState<DailyHistoryResponse>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  // Top 20 Distribution state
  const [topField, setTopField] = useState("onHand");
  const [topItemsData, setTopItemsData] = useState<TopRankedItemsResponse | null>(null);
  const [topItemsLoading, setTopItemsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardStats()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load dashboard stats", err);
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeWarehouseId]);

  // Load products for autocomplete
  useEffect(() => {
    let cancelled = false;
    fetchProducts()
      .then((res) => {
        if (!cancelled) {
          setProducts(res);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load products", err);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWarehouseId]);

  // Load Net KPIs
  useEffect(() => {
    let cancelled = false;
    setKpisLoading(true);
    fetchNetKpis(selectedDays)
      .then((res) => {
        if (!cancelled) {
          setNetKpis(res);
          setKpisLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load net KPIs", err);
        if (!cancelled) {
          setNetKpis(null);
          setKpisLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDays, activeWarehouseId]);

  // Load Bulk Projections
  useEffect(() => {
    if (projectionProductIds.length === 0) {
      setProjectionData({});
      return;
    }
    let cancelled = false;
    setProjectionLoading(true);
    fetchBulkProjections(projectionProductIds)
      .then((res) => {
        if (!cancelled) {
          setProjectionData(res);
          setProjectionLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load bulk projections", err);
        if (!cancelled) {
          setProjectionData({});
          setProjectionLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectionProductIds, activeWarehouseId]);

  // Load Daily History
  useEffect(() => {
    if (historyProductIds.length === 0) {
      setHistoryData({});
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split("T")[0];
    fetchDailyHistory(historyProductIds, startDateStr)
      .then((res) => {
        if (!cancelled) {
          setHistoryData(res);
          setHistoryLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load daily history", err);
        if (!cancelled) {
          setHistoryData({});
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [historyProductIds, activeWarehouseId]);

  // Load Top Items
  useEffect(() => {
    let cancelled = false;
    setTopItemsLoading(true);
    fetchTopRankedItems(topField, 20)
      .then((res) => {
        if (!cancelled) {
          setTopItemsData(res);
          setTopItemsLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load top items", err);
        if (!cancelled) {
          setTopItemsData(null);
          setTopItemsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [topField, activeWarehouseId]);

  /* ── Data Processing ─────────────────────────────────────────── */

  // Process projection data for chart
  const projectionChartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | string>>();

    Object.entries(projectionData).forEach(([productId, items]) => {
      items.forEach((item) => {
        if (!dateMap.has(item.date)) {
          dateMap.set(item.date, { date: item.date });
        }
        const point = dateMap.get(item.date)!;
        point[`product_${productId}`] = item.projected_stock;
      });
    });

    return Array.from(dateMap.values()).sort((a, b) => 
      String(a.date).localeCompare(String(b.date))
    );
  }, [projectionData]);

  // Process history data for chart
  const historyChartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | string>>();

    Object.entries(historyData).forEach(([productId, items]) => {
      items.forEach((item) => {
        if (!dateMap.has(item.date)) {
          dateMap.set(item.date, { date: item.date });
        }
        const point = dateMap.get(item.date)!;
        point[`product_${productId}`] = item.on_hand;
      });
    });

    return Array.from(dateMap.values()).sort((a, b) => 
      String(a.date).localeCompare(String(b.date))
    );
  }, [historyData]);

  // Process top items for pie chart
  const pieChartData = useMemo(() => {
    if (!topItemsData) return [];
    const data = topItemsData.top_items.map((item) => ({
      name: item.part_number,
      value: item.value,
      product_id: item.product_id,
    }));
    if (topItemsData.others > 0) {
      data.push({
        name: "All Others",
        value: topItemsData.others,
        product_id: -1,
      });
    }
    return data;
  }, [topItemsData]);

  // Colors for charts
  const CHART_COLORS = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
    "#84cc16", // lime
    "#6366f1", // indigo
  ];

  // Product options for autocomplete
  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.part_number || `Product ${p.id}`,
  }));

  /* ── render ─────────────────────────────────────────────────── */

  return (
    <MainLayout>
      <div className="p-6 space-y-10">
        {/* PAGE TITLE */}
        <h1 className="text-3xl font-bold text-gray-800">
          Advanced Operations Dashboard
        </h1>

        {/* LOADING INDICATOR */}
        {loading && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── TRANSACTION KPI ROW ─────────────────────────── */}
            {hasPermission("inventory:view") && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold">Transaction KPIs</h2>
                  <select
                    className="select select-bordered"
                    value={selectedDays}
                    onChange={(e) => setSelectedDays(Number(e.target.value))}
                  >
                    <option value={7}>Last 7 Days</option>
                    <option value={30}>Last 30 Days</option>
                    <option value={90}>Last 90 Days</option>
                  </select>
                </div>

                {kpisLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="loading loading-spinner loading-md text-primary" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <KpiCard
                      label="Net Delivered"
                      value={netKpis?.net_delivered}
                      icon="🚚"
                      color="success"
                    />
                    <KpiCard
                      label="Net Received"
                      value={netKpis?.net_received}
                      icon="📥"
                      color="info"
                    />
                    <KpiCard
                      label="Net Reserved"
                      value={netKpis?.net_reserved}
                      icon="🔒"
                      color="warning"
                    />
                    <KpiCard
                      label="Net Ordered"
                      value={netKpis?.net_ordered}
                      icon="📝"
                      color="primary"
                    />
                    <KpiCard
                      label="Net Backordered"
                      value={netKpis?.net_backordered}
                      icon="⚠️"
                      color="error"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── CHARTS SECTION ──────────────────────────────── */}
            {hasPermission("inventory:view") && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Multi-Product Projection Graph */}
                <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Multi-Product Projection
                  </h2>
                  <MultiSelectAutocomplete
                    label="Select Products"
                    placeholder="Search products..."
                    options={productOptions}
                    selectedIds={projectionProductIds}
                    onChange={setProjectionProductIds}
                    className="mb-4"
                  />
                  {projectionLoading ? (
                    <div className="flex justify-center py-8">
                      <span className="loading loading-spinner loading-md text-primary" />
                    </div>
                  ) : projectionProductIds.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      Select products to view projections
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={projectionChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          style={{ fontSize: "12px" }}
                          stroke="#6b7280"
                        />
                        <YAxis style={{ fontSize: "12px" }} stroke="#6b7280" />
                        <Tooltip />
                        <Legend />
                        {projectionProductIds.map((productId, idx) => {
                          const product = products.find((p) => p.id === productId);
                          const productName = product?.part_number || `Product ${productId}`;
                          return (
                            <Area
                              key={productId}
                              type="monotone"
                              dataKey={`product_${productId}`}
                              name={productName}
                              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                              fill={CHART_COLORS[idx % CHART_COLORS.length]}
                              fillOpacity={0.2}
                            />
                          );
                        })}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Historical Daily Stock Graph */}
                <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Historical Daily Stock (30 Days)
                  </h2>
                  <MultiSelectAutocomplete
                    label="Select Products"
                    placeholder="Search products..."
                    options={productOptions}
                    selectedIds={historyProductIds}
                    onChange={setHistoryProductIds}
                    className="mb-4"
                  />
                  {historyLoading ? (
                    <div className="flex justify-center py-8">
                      <span className="loading loading-spinner loading-md text-primary" />
                    </div>
                  ) : historyProductIds.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      Select products to view history
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={historyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          style={{ fontSize: "12px" }}
                          stroke="#6b7280"
                        />
                        <YAxis style={{ fontSize: "12px" }} stroke="#6b7280" />
                        <Tooltip />
                        <Legend />
                        {historyProductIds.map((productId, idx) => {
                          const product = products.find((p) => p.id === productId);
                          const productName = product?.part_number || `Product ${productId}`;
                          return (
                            <Line
                              key={productId}
                              type="monotone"
                              dataKey={`product_${productId}`}
                              name={productName}
                              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                              strokeWidth={2}
                              dot={false}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Top 20 Distribution Pie Chart */}
                <div className="bg-white rounded-xl shadow border border-gray-100 p-6 lg:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">
                      Top 20 Distribution by Field
                    </h2>
                    <select
                      className="select select-bordered"
                      value={topField}
                      onChange={(e) => setTopField(e.target.value)}
                    >
                      <option value="onHand">On Hand</option>
                      <option value="available">Available</option>
                      <option value="backordered">Backordered</option>
                      <option value="reserved">Reserved</option>
                      <option value="ordered">Ordered</option>
                    </select>
                  </div>
                  {topItemsLoading ? (
                    <div className="flex justify-center py-8">
                      <span className="loading loading-spinner loading-md text-primary" />
                    </div>
                  ) : pieChartData.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      No data available
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => entry.name}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.name === "All Others"
                                  ? "#9ca3af"
                                  : CHART_COLORS[index % CHART_COLORS.length]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* ── AT-A-GLANCE KPI ROW ─────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
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
              ].map(
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
                {[
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
                    to: "/inventory",
                    permission: "inventory:transfer",
                    bg: "bg-gray-700 hover:bg-gray-800",
                  },
                ].map(
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
