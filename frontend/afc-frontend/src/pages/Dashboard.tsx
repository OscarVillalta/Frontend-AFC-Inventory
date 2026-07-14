import { useState, useEffect, useMemo, useCallback } from "react";
import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../hooks/useAuth";
import { useWarehouse } from "../hooks/useWarehouse";
import {
  fetchDashboardStats,
  fetchNetKpis,
  fetchTopRankedItems,
  fetchBulkProjections,
  mapBulkProjectionToPending,
} from "../api/dashboard";
import type {
  DashboardStatsResponse,
  NetKpisResponse,
  TopRankedItemsResponse,
} from "../api/dashboard";
import { fetchProducts, type Product } from "../api/products";
import { fetchPendingProjection, type PendingProjectionItem } from "../api/productDetail";
import ProjectedStockChart, {
  type SelectedProduct,
  type ProductProjectionData,
} from "../components/charts/ProjectedStockChart";
import { useProjectionDateRange } from "../hooks/useProjectionDateRange";
import DashboardKpiRow from "../components/dashboard/DashboardKpiRow";
import DashboardOverviewRow from "../components/dashboard/DashboardOverviewRow";
import DashboardFeeds from "../components/dashboard/DashboardFeeds";
import TopItemsPieChart from "../components/dashboard/TopItemsPieChart";
import MultiSelectAutocomplete from "../components/MultiSelectAutocomplete";
import { getProductColor } from "../components/dashboard/chartColors";
import { productDetailPath } from "../utils/dashboardLinks";

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Dashboard() {
  const { hasPermission } = useAuth();
  const { activeWarehouseId } = useWarehouse();

  const [statsData, setStatsData] = useState<DashboardStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [netKpis, setNetKpis] = useState<NetKpisResponse | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [kpisError, setKpisError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [topField, setTopField] = useState("on_hand");
  const [topItemsData, setTopItemsData] = useState<TopRankedItemsResponse | null>(null);
  const [topItemsLoading, setTopItemsLoading] = useState(false);
  const [topItemsError, setTopItemsError] = useState<string | null>(null);

  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [productProjections, setProductProjections] = useState<Map<number, ProductProjectionData>>(new Map());
  const [singleProductOrders, setSingleProductOrders] = useState<PendingProjectionItem[]>([]);
  const [projectionsLoading, setProjectionsLoading] = useState(false);
  const [projectionsError, setProjectionsError] = useState<string | null>(null);

  const {
    todayStr,
    maxEndStr,
    projStart,
    setProjStart,
    projEnd,
    setProjEnd,
    projFillerInterval,
    setProjFillerInterval,
    resetRange: resetProjRange,
  } = useProjectionDateRange();

  const headerDate = useMemo(() => formatHeaderDate(new Date()), []);

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        name: p.part_number || `Product ${p.id}`,
      })),
    [products]
  );

  const selectedProducts: SelectedProduct[] = useMemo(
    () =>
      selectedProductIds.map((id) => {
        const product = products.find((p) => p.id === id);
        return {
          id,
          name: product?.part_number || `Product ${id}`,
        };
      }),
    [selectedProductIds, products]
  );

  const loadProjections = useCallback(async (productIds: number[]) => {
    if (productIds.length === 0) {
      setProductProjections(new Map());
      setSingleProductOrders([]);
      setProjectionsError(null);
      return;
    }

    setProjectionsLoading(true);
    setProjectionsError(null);

    try {
      const bulkResults = await fetchBulkProjections(productIds);
      const updated = new Map<number, ProductProjectionData>();

      for (const result of bulkResults) {
        if (result.error) continue;
        updated.set(result.product_id, {
          orders: mapBulkProjectionToPending(result.projections),
          currentStock: result.current_on_hand,
        });
      }

      setProductProjections(updated);

      if (productIds.length === 1) {
        const richOrders = await fetchPendingProjection(productIds[0]);
        setSingleProductOrders(richOrders);
      } else {
        setSingleProductOrders([]);
      }
    } catch (err: unknown) {
      console.error("Failed to load projections:", err);
      setProjectionsError("Unable to load projection data. Please try again.");
      setProductProjections(new Map());
      setSingleProductOrders([]);
    } finally {
      setProjectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedProductIds([]);
  }, [activeWarehouseId]);

  useEffect(() => {
    loadProjections(selectedProductIds);
  }, [selectedProductIds, activeWarehouseId, loadProjections]);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);

    fetchDashboardStats()
      .then((res) => {
        if (!cancelled) {
          setStatsData(res);
          setStatsLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load dashboard stats", err);
        if (!cancelled) {
          setStatsData(null);
          setStatsError("Unable to load overview stats.");
          setStatsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeWarehouseId]);

  useEffect(() => {
    let cancelled = false;
    setProductsLoading(true);
    setProductsError(null);

    fetchProducts()
      .then((res) => {
        if (!cancelled) {
          setProducts(res);
          setProductsLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load products", err);
        if (!cancelled) {
          setProducts([]);
          setProductsError("Unable to load product list.");
          setProductsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeWarehouseId]);

  useEffect(() => {
    let cancelled = false;
    setKpisLoading(true);
    setKpisError(null);

    fetchNetKpis(30)
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
          setKpisError("Unable to load net KPIs.");
          setKpisLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeWarehouseId]);

  useEffect(() => {
    let cancelled = false;
    setTopItemsLoading(true);
    setTopItemsError(null);

    fetchTopRankedItems(topField, 10)
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
          setTopItemsError("Unable to load top items.");
          setTopItemsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [topField, activeWarehouseId]);

  const handleProductIdsChange = (ids: number[]) => {
    setSelectedProductIds(ids);
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">INVENTORY DASHBOARD</h1>
          <div className="text-sm text-gray-500">{headerDate}</div>
        </div>

        {hasPermission("inventory:view") && (
          <>
            {/* <DashboardOverviewRow
              kpis={statsData?.kpis ?? null}
              loading={statsLoading}
              error={statsError}
            /> */}

            <DashboardKpiRow
              netKpis={netKpis}
              loading={kpisLoading}
              error={kpisError}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold uppercase text-gray-700 mb-4">
                  Projected Stock Graph - Future Outlook
                </h2>

                <div className="mb-4">
                  {productsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="loading loading-spinner loading-xs" />
                      Loading products…
                    </div>
                  ) : productsError ? (
                    <p className="text-sm text-red-500">{productsError}</p>
                  ) : (
                    <MultiSelectAutocomplete
                      label="Compare Products"
                      placeholder="Search by part number…"
                      options={productOptions}
                      selectedIds={selectedProductIds}
                      onChange={handleProductIdsChange}
                      getSelectedColor={(_, index) => getProductColor(index)}
                      getSelectedHref={(id) => productDetailPath(id)}
                    />
                  )}
                </div>

                <ProjectedStockChart
                  selectedProducts={selectedProducts}
                  productProjections={productProjections}
                  singleProductOrders={singleProductOrders}
                  loading={projectionsLoading}
                  error={projectionsError}
                  todayStr={todayStr}
                  maxEndStr={maxEndStr}
                  projStart={projStart}
                  setProjStart={setProjStart}
                  projEnd={projEnd}
                  setProjEnd={setProjEnd}
                  projFillerInterval={projFillerInterval}
                  setProjFillerInterval={setProjFillerInterval}
                  resetRange={resetProjRange}
                />
              </div>

              <TopItemsPieChart
                topField={topField}
                onFieldChange={setTopField}
                topItemsData={topItemsData}
                loading={topItemsLoading}
                error={topItemsError}
              />

            </div>
            <DashboardFeeds
              recentTransactions={statsData?.feeds.recent_transactions ?? []}
              recentOrders={statsData?.feeds.recent_orders ?? []}
              loading={statsLoading}
              error={statsError}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
}
