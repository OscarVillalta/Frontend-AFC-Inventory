import { useState, useEffect, useMemo } from "react";
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

/* ── component ──────────────────────────────────────────────────── */

export default function Dashboard() {
  const { hasPermission } = useAuth();
  const { activeWarehouseId } = useWarehouse();

  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Net KPIs state
  const [netKpis, setNetKpis] = useState<NetKpisResponse | null>(null);
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
    
    async function loadKpis() {
      setKpisLoading(true);
      try {
        const res = await fetchNetKpis(30);
        if (!cancelled) {
          setNetKpis(res);
          setKpisLoading(false);
        }
      } catch (err: unknown) {
        console.error("Failed to load net KPIs", err);
        if (!cancelled) {
          setNetKpis(null);
          setKpisLoading(false);
        }
      }
    }
    
    loadKpis();
    
    return () => {
      cancelled = true;
    };
  }, [activeWarehouseId]);

  // Load Bulk Projections
  useEffect(() => {
    let cancelled = false;
    
    async function loadProjections() {
      if (projectionProductIds.length === 0) {
        if (!cancelled) {
          setProjectionData({});
        }
        return;
      }
      
      setProjectionLoading(true);
      try {
        const res = await fetchBulkProjections(projectionProductIds);
        if (!cancelled) {
          setProjectionData(res);
          setProjectionLoading(false);
        }
      } catch (err: unknown) {
        console.error("Failed to load bulk projections", err);
        if (!cancelled) {
          setProjectionData({});
          setProjectionLoading(false);
        }
      }
    }
    
    loadProjections();
    
    return () => {
      cancelled = true;
    };
  }, [projectionProductIds, activeWarehouseId]);

  // Load Daily History
  useEffect(() => {
    let cancelled = false;
    
    async function loadHistory() {
      if (historyProductIds.length === 0) {
        if (!cancelled) {
          setHistoryData({});
        }
        return;
      }
      
      setHistoryLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const startDateStr = startDate.toISOString().split("T")[0];
      
      try {
        const res = await fetchDailyHistory(historyProductIds, startDateStr);
        if (!cancelled) {
          setHistoryData(res);
          setHistoryLoading(false);
        }
      } catch (err: unknown) {
        console.error("Failed to load daily history", err);
        if (!cancelled) {
          setHistoryData({});
          setHistoryLoading(false);
        }
      }
    }
    
    loadHistory();
    
    return () => {
      cancelled = true;
    };
  }, [historyProductIds, activeWarehouseId]);

  // Load Top Items
  useEffect(() => {
    let cancelled = false;
    
    async function loadTopItems() {
      setTopItemsLoading(true);
      try {
        const res = await fetchTopRankedItems(topField, 20);
        if (!cancelled) {
          setTopItemsData(res);
          setTopItemsLoading(false);
        }
      } catch (err: unknown) {
        console.error("Failed to load top items", err);
        if (!cancelled) {
          setTopItemsData(null);
          setTopItemsLoading(false);
        }
      }
    }
    
    loadTopItems();
    
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
      <div className="p-6 space-y-6">
        {/* PAGE TITLE */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            ENTERPRISE OPERATIONS DASHBOARD
          </h1>
          <div className="text-sm text-gray-500">
            Apr 20, 2026
          </div>
        </div>

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
                {kpisLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="loading loading-spinner loading-md text-primary" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <KpiCard
                      label="Net Delivered"
                      value={netKpis?.net_delivered}
                      icon="🚚"
                      color="success"
                      percentageChange={netKpis?.net_delivered_pct}
                    />
                    <KpiCard
                      label="Net Received"
                      value={netKpis?.net_received}
                      icon="📦"
                      color="info"
                      percentageChange={netKpis?.net_received_pct}
                    />
                    <KpiCard
                      label="Net Reserved"
                      value={netKpis?.net_reserved}
                      icon="🔒"
                      color="warning"
                      percentageChange={netKpis?.net_reserved_pct}
                    />
                    <KpiCard
                      label="Net Ordered"
                      value={netKpis?.net_ordered}
                      icon="🛒"
                      color="primary"
                      percentageChange={netKpis?.net_ordered_pct}
                    />
                    <KpiCard
                      label="Net Backordered"
                      value={netKpis?.net_backordered}
                      icon="⚠️"
                      color="error"
                      percentageChange={netKpis?.net_backordered_pct}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── CHARTS SECTION ──────────────────────────────── */}
            {hasPermission("inventory:view") && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Multi-Product Projection Graph - Takes full height on left */}
                <div className="bg-white rounded-lg shadow p-6 lg:row-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold uppercase text-gray-700">
                      Projected Stock Graph - Future Outlook
                    </h2>
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                  <MultiSelectAutocomplete
                    label="Select Items"
                    placeholder="Search products..."
                    options={productOptions}
                    selectedIds={projectionProductIds}
                    onChange={setProjectionProductIds}
                    className="mb-4"
                  />
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    PROJECTED STOCK - NEXT 60 DAYS
                  </div>
                  {projectionLoading ? (
                    <div className="flex justify-center py-12">
                      <span className="loading loading-spinner loading-md text-primary" />
                    </div>
                  ) : projectionProductIds.length === 0 ? (
                    <p className="text-gray-400 text-center py-12">
                      Select products to view projections
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
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
                              fillOpacity={0.3}
                            />
                          );
                        })}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Historical Daily Stock Graph - Top Right */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold uppercase text-gray-700">
                      Historical Changes Graph
                    </h2>
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                  <MultiSelectAutocomplete
                    label="Select Items"
                    placeholder="Search products..."
                    options={productOptions}
                    selectedIds={historyProductIds}
                    onChange={setHistoryProductIds}
                    className="mb-4"
                  />
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    HISTORICAL CHANGES - PAST 30 DAYS
                  </div>
                  {historyLoading ? (
                    <div className="flex justify-center py-8">
                      <span className="loading loading-spinner loading-md text-primary" />
                    </div>
                  ) : historyProductIds.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      Select products to view history
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
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

                {/* Top 20 Distribution Pie Chart - Bottom Right */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold uppercase text-gray-700">
                      Top 20 Items - Stock Distribution
                    </h2>
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                  <select
                    className="select select-bordered select-sm w-full mb-4"
                    value={topField}
                    onChange={(e) => setTopField(e.target.value)}
                  >
                    <option value="onHand">On Hand</option>
                    <option value="available">Available</option>
                    <option value="backordered">Backordered</option>
                    <option value="reserved">Reserved</option>
                    <option value="ordered">Ordered</option>
                  </select>
                  <div className="text-sm font-semibold text-gray-700 mb-2 text-right">
                    TOP 20 ITEMS BY FIELD
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
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={false}
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
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 text-xs space-y-1">
                        {pieChartData.slice(0, 9).map((entry, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-sm"
                                style={{
                                  backgroundColor:
                                    entry.name === "All Others"
                                      ? "#9ca3af"
                                      : CHART_COLORS[index % CHART_COLORS.length],
                                }}
                              />
                              <span className="text-gray-700">{entry.name}</span>
                            </div>
                            <span className="font-semibold text-gray-900">
                              {((entry.value / pieChartData.reduce((sum, e) => sum + e.value, 0)) * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
