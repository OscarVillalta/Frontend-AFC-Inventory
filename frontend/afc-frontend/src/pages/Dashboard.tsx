import {useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../hooks/useAuth";
import { useWarehouse } from "../hooks/useWarehouse";
import {
  fetchDashboardStats,
  fetchNetKpis,
  fetchTopRankedItems,
} from "../api/dashboard";
import type {
  DashboardStatsResponse,
  NetKpisResponse,
  TopRankedItemsResponse,
  TopRankedItem,
} from "../api/dashboard";
import { fetchProducts, type Product } from "../api/products";
import KpiCard from "../components/KpiCard";
import { processGraphData, type ProjectedStockPoint } from "../components/charts/processGraphData";
import {
  fetchPendingProjection,
  type PendingProjectionItem,
} from "../api/productDetail";
import CustomTooltip from "../components/charts/CustomTooltip";
import { useProjectionDateRange } from "../hooks/useProjectionDateRange";

/* ============================================================
   TYPES
============================================================ */

interface HistoricalDataPoint {
  date: string;
  raw_date: string;
  stock_level: number;
  quantity_delta: number;
  order_id: number | null;
  transaction_id: number;
  reason: string;
}

interface SelectedProduct {
  id: number;
  name: string;
  color: string;
}

/* ── component ──────────────────────────────────────────────────── */

export default function Dashboard() {
  const productId  = 27448
  const { hasPermission } = useAuth();
  const { activeWarehouseId } = useWarehouse();

  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Net KPIs state
  const [netKpis, setNetKpis] = useState<NetKpisResponse | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);

  // Products for autocomplete
  const [products, setProducts] = useState<Product[]>([]);

  // Top 20 Distribution state
  const [topField, setTopField] = useState("on_hand");
  const [topItemsData, setTopItemsData] = useState<TopRankedItemsResponse | null>(null);
  const [topItemsLoading, setTopItemsLoading] = useState(false);

  // Projection
  const [pendingProjection, setPendingProjection] = useState<PendingProjectionItem[]>([]);

  // Selected products for projection chart
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  const [hoveredHistPoint, setHoveredHistPoint] = useState<{
    data: HistoricalDataPoint;
    cx: number;
    cy: number;
  } | null>(null);
  
  const [hoveredProjPoint, setHoveredProjPoint] = useState<{
    data: ProjectedStockPoint;
    cx: number;
    cy: number;
  } | null>(null);

  // Projection interval state
  const{
    todayStr, defaultEndStr, maxEndStr,
    projStart, setProjStart,
    projEnd, setProjEnd,
    projFillerInterval, setProjFillerInterval,
    resetRange: resetProjRange,
  } = useProjectionDateRange();

  const projContainerRef = useRef<HTMLDivElement>(null);
  const histContainerRef = useRef<HTMLDivElement>(null);

  type ClickableDotProps<TPayload> = {
    cx?: number;
    cy?: number;
    payload?: TPayload;
  };

  const getDotFill = (isHovered: boolean, hasOrder: boolean): string => {
    if (isHovered) return hasOrder ? "#2563eb" : "#2d3143";
    return hasOrder ? "#3b82f6" : "#363b4c";
  };

  // Generate color for product badges (deterministic based on index)
  const getProductColor = (index: number): string => {
    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
      "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
      "#14b8a6", "#f43f5e", "#a855f7", "#22c55e", "#fb923c"
    ];
    return colors[index % colors.length];
  };

  // Handle product selection from dropdown
  const handleProductSelect = (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    // Check if already selected
    if (selectedProducts.some(sp => sp.id === productId)) return;
    
    const newProduct: SelectedProduct = {
      id: product.id,
      name: product.part_number || `Product ${product.id}`,
      color: getProductColor(selectedProducts.length)
    };
    
    setSelectedProducts([...selectedProducts, newProduct]);
  };

  // Remove selected product
  const handleRemoveProduct = (productId: number) => {
    setSelectedProducts(selectedProducts.filter(sp => sp.id !== productId));
  };

  //Load Projection
  const loadProjection = useCallback(async () => {
    if(!productId) return;
    try {
      const numericProductId = Number(productId);
      const projectionData  = await fetchPendingProjection(numericProductId);
      setPendingProjection(projectionData);
    } catch (error) {
      console.error("Failed to load product detail:", error);
    }
  }, [activeWarehouseId]);

  useEffect(() => {
    loadProjection();
  }, [loadProjection, activeWarehouseId]);


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

  const stockProjection = processGraphData(pendingProjection, 0, {
    fillerIntervalDays: projFillerInterval,
    startDate: projStart,
    endDate: projEnd,
  });

  // Process top items for pie chart
  const pieChartData = useMemo(() => {
    if (!topItemsData) return [];
    const data = topItemsData.top_items.map((item) => ({
      name: item.product_name,
      value: item[topField as keyof TopRankedItem] as number,
      product_id: item.product_id,
    }));
    if (topItemsData.all_others > 0) {
      data.push({
        name: "All Others",
        value: topItemsData.all_others,
        product_id: -1,
      });
    }
    return data.sort((a,b) => (b.value - a.value));
  }, [topItemsData, topField]);

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

  /* ── render ─────────────────────────────────────────────────── */

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* PAGE TITLE */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            INVENTORY DASHBOARD
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
                      icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="-2.5 -2.5 80 80" id="Shipping-Truck-Style-2--Streamline-Ultimate" height={48} width={48} ><desc>{"\n    Shipping Truck Style 2 Streamline Icon: https://streamlinehq.com\n  "}</desc><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M49.21875 23.4375h6.25c0.9375 0 1.875 0.62496875 2.5 1.24996875L63.28125 32.8125l7.187499999999999 2.5c1.25 0.3125 2.1875 1.5625 2.1875 2.8125v13.4375c0 1.5625 -1.25 3.125 -3.125 3.125h-9.3378125" strokeWidth={5} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M53.90625 60.9375c3.4518750000000002 0 6.25 -2.7981249999999998 6.25 -6.25s-2.7981249999999998 -6.25 -6.25 -6.25 -6.25 2.7981249999999998 -6.25 6.25 2.7981249999999998 6.25 6.25 6.25Z" strokeWidth={5} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M49.21875 50.596875V17.1875c0 -1.875 -1.25 -3.125 -3.125 -3.125h-40.625c-1.875 0 -3.125 1.25 -3.125 3.125v34.375c0 1.5625 1.25 3.125 3.125 3.125h4.678875m37.4905 0h-12.4896875" strokeWidth={5} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M16.40625 60.9375c3.4517812500000002 0 6.25 -2.7981249999999998 6.25 -6.25s-2.7982187499999998 -6.25 -6.25 -6.25 -6.25 2.7981249999999998 -6.25 6.25 2.7982187499999998 6.25 6.25 6.25Z" strokeWidth={5} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M28.90625 60.9375c3.4518750000000002 0 6.25 -2.7981249999999998 6.25 -6.25s-2.7981249999999998 -6.25 -6.25 -6.25c-3.4517812500000002 0 -6.25 2.7981249999999998 -6.25 6.25s2.7982187499999998 6.25 6.25 6.25Z" strokeWidth={5} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M16.40625 14.0625v21.875" strokeWidth={5} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M32.03125 14.0625v21.875" strokeWidth={5} /></svg>}
                      color="success"
                      percentageChange={netKpis?.net_delivered_pct}
                    />
                    <KpiCard
                      label="Net Received"
                      value={netKpis?.net_received}
                      icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="-1.5 -1.5 48 48" id="Products-Gifts--Streamline-Ultimate" height={48} width={48} ><desc>{"\n    Products Gifts Streamline Icon: https://streamlinehq.com\n  "}</desc><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M11.349337499999999 37.96875h5.625" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M11.349337499999999 8.4375v16.875" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M1.505585625 16.875H21.193125000000002" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="m7.1305875 1.40625 4.21875 7.03125" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="m15.568087499999999 1.40625 -4.21875 7.03125" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M29.625 43.59375c0 -1.49175 -0.5925 -2.9225624999999997 -1.647375 -3.9774375 -1.054875 -1.054875 -2.4856875 -1.6475625 -3.9776249999999997 -1.6475625H16.97446875c0 -1.49175 -0.59263125 -2.9225624999999997 -1.6475250000000001 -3.9774375 -1.0548937500000002 -1.054875 -2.48563125 -1.6475625 -3.9774749999999996 -1.6475625H1.500091875v11.25H29.625Z" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M2.4430875 8.4375H20.255625000000002s0.9375 0 0.9375 0.9375v15s0 0.9375 -0.9375 0.9375H2.4430875s-0.937501875 0 -0.937501875 -0.9375V9.375s0 -0.9375 0.937501875 -0.9375Z" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="m25.987499999999997 16.0781625 0.6693749999999999 -5.015625c0.044625000000000005 -0.3378375 0.21056249999999999 -0.6479437499999999 0.466875 -0.87253125 0.2563125 -0.22456875 0.5855625 -0.34828125 0.92625 -0.34809375000000004h11.600625c0.340875 -0.0001875 0.670125 0.123525 0.9264375 0.34809375000000004 0.2563125 0.2245875 0.42225 0.53469375 0.46668750000000003 0.87253125l2.4375 18.281212500000002c0.021937500000000002 0.1978125 0.0024375 0.397875 -0.0571875 0.5876250000000001 -0.0594375 0.1899375 -0.157875 0.36525 -0.28893749999999996 0.514875 -0.1310625 0.1498125 -0.29174999999999995 0.27056250000000004 -0.47193749999999995 0.35475 -0.18037499999999998 0.08437499999999999 -0.376125 0.13012500000000002 -0.5750624999999999 0.134625H24" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M29.625 9.84375v-2.8125c0 -1.1188875 0.4445625 -2.19193125 1.2358125 -2.9831062499999996C31.651875 3.25696875 32.724937499999996 2.8125 33.84375 2.8125c1.119 0 2.1920625 0.44446875 2.983125 1.23564375 0.79125 0.791175 1.235625 1.86421875 1.235625 2.9831062499999996v2.8125" strokeWidth={3} /></svg>}
                      color="info"
                      percentageChange={netKpis?.net_received_pct}
                    />
                    <KpiCard
                      label="Net Reserved"
                      value={netKpis?.net_reserved}
                      icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="-1.5 -1.5 48 48" id="Tool-Box--Streamline-Ultimate" height={48} width={48} ><desc>{"\n    Tool Box Streamline Icon: https://streamlinehq.com\n  "}</desc><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M4.21875 12.65625h36.5625s2.8125 0 2.8125 2.8125v22.5s0 2.8125 -2.8125 2.8125H4.21875s-2.8125 0 -2.8125 -2.8125v-22.5s0 -2.8125 2.8125 -2.8125Z" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M30.9375 12.65625c0 -2.23775625 -0.8889375 -4.38388125 -2.47125 -5.966212499999999C26.883937500000002 5.10770625 24.7378125 4.21875 22.5 4.21875s-4.38388125 0.88895625 -5.966212499999999 2.4712875C14.95145625 8.27236875 14.0625 10.418493750000001 14.0625 12.65625" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M1.40625 23.90625h16.875" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M26.71875 23.90625h16.875" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M18.28125 25.78125c0 1.119 0.44446875 2.1920625 1.235625 2.983125 0.79125 0.79125 1.8643125 1.235625 2.983125 1.235625s2.191875 -0.44437499999999996 2.983125 -1.235625c0.7910625 -0.7910625 1.235625 -1.864125 1.235625 -2.983125v-2.25c0 -1.1188125 -0.4445625 -2.191875 -1.235625 -2.9829375 -0.79125 -0.79125 -1.8643125 -1.2358125 -2.983125 -1.2358125s-2.191875 0.4445625 -2.983125 1.2358125c-0.79115625 0.7910625 -1.235625 1.864125 -1.235625 2.9829375v2.25Z" strokeWidth={3} /></svg>}
                      color="warning"
                      percentageChange={netKpis?.net_reserved_pct}
                    />
                    <KpiCard
                      label="Net Ordered"
                      value={netKpis?.net_ordered}
                      icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="-1.5 -1.5 48 48" id="Warehouse-Cart-Package-Ribbon--Streamline-Ultimate" height={48} width={48} ><desc>{"\n    Warehouse Cart Package Ribbon Streamline Icon: https://streamlinehq.com\n  "}</desc><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M30.9375 40.78125c0 0.745875 0.29625 1.4613749999999999 0.8236875 1.9888124999999999s1.2429375 0.8236875 1.9888124999999999 0.8236875c0.745875 0 1.4613749999999999 -0.29625 1.9888124999999999 -0.8236875s0.8236875 -1.2429375 0.8236875 -1.9888124999999999c0 -0.745875 -0.29625 -1.4613749999999999 -0.8236875 -1.9888124999999999S34.495875 37.96875 33.75 37.96875c-0.745875 0 -1.4613749999999999 0.29625 -1.9888124999999999 0.8236875S30.9375 40.035375 30.9375 40.78125Z" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M4.21875 40.78125c0 0.745875 0.296325 1.4613749999999999 0.8237625000000001 1.9888124999999999s1.242825 0.8236875 1.9887374999999998 0.8236875c0.7459125 0 1.4613 -0.29625 1.9887374999999998 -0.8236875 0.5274375 -0.5274375 0.8237625000000001 -1.2429375 0.8237625000000001 -1.9888124999999999 0 -0.745875 -0.296325 -1.4613749999999999 -0.8237625000000001 -1.9888124999999999S7.7771625 37.96875 7.03125 37.96875c-0.7459125 0 -1.4613 0.29625 -1.9887374999999998 0.8236875 -0.5274375 0.5274375 -0.8237625000000001 1.2429375 -0.8237625000000001 1.9888124999999999Z" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M1.40625 33.75h29.86875c0.6849375 0.0009375 1.346625 -0.2480625 1.8609375000000001 -0.7003125 0.5143125 -0.45225 0.846 -1.0766250000000002 0.9328125 -1.7559375l3.58125 -27.431250000000002c0.0868125 -0.67936875 0.41850000000000004 -1.30374375 0.9328125 -1.755975 0.5143125 -0.452225625 1.176 -0.7012237499999999 1.8609375000000001 -0.700273125h3.15" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M8.4375 7.03125h16.875s2.8125 0 2.8125 2.8125v15.46875s0 2.8125 -2.8125 2.8125h-16.875S5.625 28.125 5.625 25.3125V9.84375s0 -2.8125 2.8125 -2.8125Z" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" d="M20.15625 16.40625h-6.5625v-9.375h6.5625v9.375Z" strokeWidth={3} /></svg>}
                      color="primary"
                      percentageChange={netKpis?.net_ordered_pct}
                    />
                    <KpiCard
                      label="Net Backordered"
                      value={netKpis?.net_backordered}
                      icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="-1.5 -1.5 48 48" id="Alert-Octagon-1--Streamline-Ultimate" height={48} width={48} ><desc>{"\n    Alert Octagon 1 Streamline Icon: https://streamlinehq.com\n  "}</desc><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M31.218749999999996 1.500091875h-17.4375L1.40625 13.68759375v17.62509375l12.375 12.1875h17.4375l12.375 -12.1875V13.68759375L31.218749999999996 1.500091875Z" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M22.40625 34.6875c1.55325 0 2.8125 -1.2590625 2.8125 -2.8125 0 -1.55325 -1.25925 -2.8125 -2.8125 -2.8125 -1.5534375 0 -2.8125 1.25925 -2.8125 2.8125 0 1.5534375 1.2590625 2.8125 2.8125 2.8125Z" strokeWidth={3} /><path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} d="M26.15625 13.125c0 2.0625 -3.75 10.3125 -3.75 10.3125S18.65615625 15.1875 18.65615625 13.125c0 -2.0625 1.68759375 -3.75 3.7500937499999996 -3.75 2.0625 0 3.75 1.6875 3.75 3.75Z" strokeWidth={3} /></svg>}
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
                  <h2 className="text-sm font-semibold uppercase text-gray-700 mb-4">
                    Projected Stock Graph - Future Outlook
                  </h2>
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    PROJECTED STOCK - NEXT 60 DAYS
                  </div>
                  
                  {/* Product Selection Dropdown */}
                  <div className="mb-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <select
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value=""
                        onChange={(e) => {
                          const productId = Number(e.target.value);
                          if (productId) handleProductSelect(productId);
                        }}
                      >
                        <option value="">Select a product...</option>
                        {products
                          .filter(p => !selectedProducts.some(sp => sp.id === p.id))
                          .map(product => (
                            <option key={product.id} value={product.id}>
                              {product.part_number || `Product ${product.id}`}
                            </option>
                          ))}
                      </select>
                    </div>
                    
                    {/* Selected Products List */}
                    {selectedProducts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedProducts.map(product => (
                          <div
                            key={product.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white"
                            style={{ backgroundColor: product.color }}
                          >
                            <span>{product.name}</span>
                            <button
                              onClick={() => handleRemoveProduct(product.id)}
                              className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                              aria-label={`Remove ${product.name}`}
                            >
                              <svg 
                                className="w-4 h-4" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={2} 
                                  d="M6 18L18 6M6 6l12 12" 
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    {true && (() => {
                      const projLevels = stockProjection.map(p => p.projectedStock);
                      const projMax = projLevels.length ? Math.max(...projLevels) : 0;
                      const projMin = projLevels.length ? Math.min(...projLevels) : 0;
                      const projGradientOffset =
                        projMax <= 0 ? 0 : projMin >= 0 ? 1 : projMax / (projMax - projMin);
                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <h2 className="text-xl font-semibold text-[#363b4c]">
                              Projected Stock Level
                            </h2>
                            <div className="flex items-center gap-3 flex-wrap">
                              {/* Filler interval toggle */}
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Interval:</span>
                                {([1, 2] as const).map((days) => (
                                  <button
                                    key={days}
                                    onClick={() => setProjFillerInterval(days)}
                                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                      projFillerInterval === days
                                        ? "bg-[#363b4c] text-white border-[#363b4c]"
                                        : "bg-white text-gray-600 border-gray-300 hover:border-[#363b4c]"
                                    }`}
                                  >
                                    {days}d
                                  </button>
                                ))}
                              </div>
                              {/* Date range */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  className="text-xs border border-gray-300 rounded px-2 py-1"
                                  value={projStart}
                                  min={todayStr}
                                  max={projEnd}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val >= todayStr) setProjStart(val);
                                  }}
                                />
                                <span className="text-xs text-gray-500">to</span>
                                <input
                                  type="date"
                                  className="text-xs border border-gray-300 rounded px-2 py-1"
                                  value={projEnd}
                                  min={projStart}
                                  max={maxEndStr}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val <= maxEndStr && val >= projStart) setProjEnd(val);
                                  }}
                                />
                              </div>
                              <button
                                className="text-xs px-2 py-1 rounded-full border border-gray-300 bg-white text-gray-600 hover:border-[#363b4c] transition-colors"
                                onClick={() => resetProjRange()}
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                          <div
                            ref={projContainerRef}
                            className="relative"
                            onMouseLeave={() => setHoveredProjPoint(null)}
                          >
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={stockProjection}>
                              <defs>
                                <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                  {projGradientOffset >= 1 ? (
                                    <>
                                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                                    </>
                                  ) : projGradientOffset <= 0 ? (
                                    <>
                                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                                    </>
                                  ) : (
                                    <>
                                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                      <stop offset={`${projGradientOffset * 100}%`} stopColor="#3b82f6" stopOpacity={0.1} />
                                      <stop offset={`${projGradientOffset * 100}%`} stopColor="#ef4444" stopOpacity={0.2} />
                                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                                    </>
                                  )}
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="date" style={{ fontSize: "12px" }} stroke="#6b7280" />
                              <YAxis style={{ fontSize: "12px" }} stroke="#6b7280" />
                              <ReferenceLine y={0} stroke="#363b4c" strokeWidth={2} />
                              <Area
                                type="monotone"
                                dataKey="projectedStock"
                                stroke="#363b4c"
                                strokeWidth={2}
                                fill="url(#colorStock)"
                                dot={(props: ClickableDotProps<ProjectedStockPoint>) => {
                                  const { cx, cy, payload } = props;
                                  if (cx == null || cy == null || !payload) return null;
                                  const hasOrder = payload.dailyOrders.some(o => o.order_id != null);
                                  const isHovered = hoveredProjPoint?.data.date === payload.date;
                                  return (
                                    <circle
                                      key={`proj-dot-${payload.date}`}
                                      cx={cx}
                                      cy={cy}
                                      r={isHovered ? (hasOrder ? 8 : 6) : (hasOrder ? 6 : (payload.isFiller ? 4 : 4))}
                                      fill={getDotFill(isHovered, hasOrder)}
                                      stroke={payload.isFiller && !isHovered ? "transparent" : "white"}
                                      strokeWidth={2}
                                      style={{ cursor: hasOrder ? "pointer" : "default" }}
                                      onMouseEnter={() => setHoveredProjPoint({ data: payload, cx, cy })}
                                      onClick={() => {
                                        const firstOrderId = payload.dailyOrders.find(o => o.order_id)?.order_id;
                                        if (firstOrderId) window.open(`/orders/${firstOrderId}`, "_blank");
                                      }}
                                    />
                                  );
                                }}
                                activeDot={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                          {hoveredProjPoint && (() => {
                            const containerWidth = projContainerRef.current?.offsetWidth ?? 0;
                            const isRightThird = containerWidth > 0 && hoveredProjPoint.cx > (containerWidth * 2) / 3;
                            return (
                              <div
                                className="pointer-events-auto absolute z-50"
                                style={{
                                  ...(isRightThird
                                    ? { right: containerWidth - hoveredProjPoint.cx + 12 }
                                    : { left: hoveredProjPoint.cx + 12 }),
                                  top: Math.max(4, hoveredProjPoint.cy - 60),
                                  zIndex: 100
                                }}
                              >
                                <CustomTooltip 
                                point={hoveredProjPoint.data} 
                                />
                              </div>
                            );
                          })()}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Historical Daily Stock Graph - Top Right */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-sm font-semibold uppercase text-gray-700 mb-4">
                    Historical Changes Graph
                  </h2>
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    HISTORICAL CHANGES - PAST 30 DAYS
                  </div>
                </div>

                {/* Top 20 Distribution Pie Chart - Bottom Right */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-sm font-semibold uppercase text-gray-700 mb-4">
                    Top 20 Items - Stock Distribution
                  </h2>
                  <select
                    className="select select-bordered select-sm w-full mb-4"
                    value={topField}
                    onChange={(e) => setTopField(e.target.value)}
                  >
                    <option value="on_hand">On Hand</option>
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
                        {(() => {
                          const totalValue = pieChartData.reduce((sum, e) => sum + e.value, 0);
                          return pieChartData.slice(0, 9).map((entry, index) => (
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
                                {((entry.value / totalValue) * 100).toFixed(1)}%
                              </span>
                            </div>
                          ));
                        })()}
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
