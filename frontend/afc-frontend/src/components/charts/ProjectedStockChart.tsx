import { useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  processGraphData,
  processStackedGraphData,
  type ProjectedStockPoint,
} from "./processGraphData";
import type { PendingProjectionItem } from "../../api/productDetail";
import CustomTooltip from "./CustomTooltip";
import { getDotFill, getProductColor } from "../dashboard/chartColors";

export interface SelectedProduct {
  id: number;
  name: string;
}

export interface ProductProjectionData {
  orders: PendingProjectionItem[];
  currentStock: number;
}

interface ProjectionDateRangeProps {
  todayStr: string;
  maxEndStr: string;
  projStart: string;
  setProjStart: (v: string) => void;
  projEnd: string;
  setProjEnd: (v: string) => void;
  projFillerInterval: 1 | 2;
  setProjFillerInterval: (v: 1 | 2) => void;
  resetRange: () => void;
}

interface ProjectedStockChartProps extends ProjectionDateRangeProps {
  selectedProducts: SelectedProduct[];
  productProjections: Map<number, ProductProjectionData>;
  /** Rich order-level data for single-product mode (enables clickable dots). */
  singleProductOrders?: PendingProjectionItem[];
  loading?: boolean;
  error?: string | null;
  showTitle?: boolean;
  gradientId?: string;
}

type ClickableDotProps<TPayload> = {
  cx?: number;
  cy?: number;
  payload?: TPayload;
};

function ProjectionControls({
  todayStr,
  maxEndStr,
  projStart,
  setProjStart,
  projEnd,
  setProjEnd,
  projFillerInterval,
  setProjFillerInterval,
  resetRange,
  showTitle,
}: ProjectionDateRangeProps & { showTitle: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      {showTitle && (
        <h2 className="text-xl font-semibold text-[#363b4c]">
          Projected Stock Level
        </h2>
      )}
      <div className="flex items-center gap-3 flex-wrap ml-auto">
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
          onClick={() => resetRange()}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default function ProjectedStockChart({
  selectedProducts,
  productProjections,
  singleProductOrders,
  loading = false,
  error = null,
  showTitle = true,
  gradientId = "colorStock",
  todayStr,
  maxEndStr,
  projStart,
  setProjStart,
  projEnd,
  setProjEnd,
  projFillerInterval,
  setProjFillerInterval,
  resetRange,
}: ProjectedStockChartProps) {
  const projContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredProjPoint, setHoveredProjPoint] = useState<{
    data: ProjectedStockPoint;
    cx: number;
    cy: number;
  } | null>(null);

  const isMultiMode = selectedProducts.length > 1;
  const isSingleMode = selectedProducts.length === 1;
  const isEmpty = selectedProducts.length === 0;

  const graphOptions = useMemo(
    () => ({
      fillerIntervalDays: projFillerInterval,
      startDate: projStart,
      endDate: projEnd,
    }),
    [projFillerInterval, projStart, projEnd]
  );

  const stackedStockProjection = useMemo(() => {
    if (!isMultiMode) return null;

    const projections = selectedProducts.map((sp) => ({
      productId: sp.id,
      productName: sp.name,
      orders: productProjections.get(sp.id)?.orders ?? [],
      currentStockOnHand: productProjections.get(sp.id)?.currentStock ?? 0,
    }));

    return processStackedGraphData(projections, graphOptions);
  }, [isMultiMode, selectedProducts, productProjections, graphOptions]);

  const stockProjection = useMemo(() => {
    if (!isSingleMode) return [];

    const product = selectedProducts[0];
    const projection = productProjections.get(product.id);
    const orders = singleProductOrders ?? projection?.orders ?? [];
    const currentStock = projection?.currentStock ?? 0;

    return processGraphData(orders, currentStock, graphOptions);
  }, [isSingleMode, selectedProducts, productProjections, singleProductOrders, graphOptions]);

  const productsWithNegativeValues = useMemo(() => {
    if (!stackedStockProjection) return new Set<number>();

    const negativeProducts = new Set<number>();
    selectedProducts.forEach((product) => {
      const hasNegative = stackedStockProjection.some(
        (point) => (point[`product_${product.id}`] as number) < 0
      );
      if (hasNegative) negativeProducts.add(product.id);
    });
    return negativeProducts;
  }, [stackedStockProjection, selectedProducts]);

  const projLevels = stockProjection.map((p) => p.projectedStock);
  const projMax = projLevels.length ? Math.max(...projLevels) : 0;
  const projMin = projLevels.length ? Math.min(...projLevels) : 0;
  const projGradientOffset =
    projMax <= 0 ? 0 : projMin >= 0 ? 1 : projMax / (projMax - projMin);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center py-8 text-red-500 text-sm">{error}</p>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">Select one or more products to view projected stock levels.</p>
      </div>
    );
  }

  return (
    <>
      <ProjectionControls
        todayStr={todayStr}
        maxEndStr={maxEndStr}
        projStart={projStart}
        setProjStart={setProjStart}
        projEnd={projEnd}
        setProjEnd={setProjEnd}
        projFillerInterval={projFillerInterval}
        setProjFillerInterval={setProjFillerInterval}
        resetRange={resetRange}
        showTitle={showTitle}
      />
      <div
        ref={projContainerRef}
        className="relative"
        onMouseLeave={() => setHoveredProjPoint(null)}
      >
        <ResponsiveContainer width="100%" height={300}>
          {isMultiMode && stackedStockProjection ? (
            <AreaChart data={stackedStockProjection}>
              <defs>
                {selectedProducts.map((product, index) => (
                  <pattern
                    key={`pattern-${product.id}`}
                    id={`pattern-${product.id}`}
                    patternUnits="userSpaceOnUse"
                    width="8"
                    height="8"
                    patternTransform="rotate(45)"
                  >
                    <rect width="8" height="8" fill={getProductColor(index)} opacity="0.5" />
                    <line x1="0" y1="0" x2="0" y2="8" stroke={getProductColor(index)} strokeWidth="2" />
                  </pattern>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" style={{ fontSize: "12px" }} stroke="#6b7280" />
              <YAxis style={{ fontSize: "12px" }} stroke="#6b7280" />
              <ReferenceLine y={0} stroke="#363b4c" strokeWidth={2} />
              <Tooltip
                content={(props) => {
                  if (!props.active || !props.payload || props.payload.length === 0) return null;
                  return (
                    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm">
                      <p className="font-semibold text-gray-800">{props.label}</p>
                      <div className="mt-2 space-y-1">
                        {selectedProducts.map((product, index) => {
                          const payloadItem = props.payload?.find(
                            (p) => p.dataKey === `product_${product.id}`
                          );
                          const value = payloadItem?.value;
                          return (
                            <div key={product.id} className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-sm"
                                  style={{ backgroundColor: getProductColor(index) }}
                                />
                                <span className="text-gray-700 truncate max-w-[140px]">{product.name}</span>
                              </div>
                              <span className="font-medium text-gray-900 tabular-nums">{value ?? 0}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />
              {selectedProducts.map((product, index) => (
                <Area
                  key={product.id}
                  type="monotone"
                  dataKey={`product_${product.id}`}
                  stroke={getProductColor(index)}
                  fill={
                    productsWithNegativeValues.has(product.id)
                      ? `url(#pattern-${product.id})`
                      : getProductColor(index)
                  }
                  fillOpacity={0.4}
                  strokeWidth={2}
                  dot={(props: ClickableDotProps<{ date: string; [key: string]: unknown }>) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null || !payload) return null;
                    const value = payload[`product_${product.id}`] as number | undefined;
                    const isHovered =
                      hoveredProjPoint?.data.date === payload.date &&
                      !isMultiMode;
                    return (
                      <circle
                        key={`multi-dot-${product.id}-${payload.date}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={getProductColor(index)}
                        stroke="white"
                        strokeWidth={1}
                        style={{ cursor: "default" }}
                        onMouseEnter={() => {
                          if (value != null) {
                            setHoveredProjPoint({
                              data: {
                                date: payload.date as string,
                                projectedStock: value,
                                dailyOrders: [],
                              },
                              cx,
                              cy,
                            });
                          }
                        }}
                      />
                    );
                  }}
                  activeDot={false}
                />
              ))}
            </AreaChart>
          ) : (
            <AreaChart data={stockProjection}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
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
                fill={`url(#${gradientId})`}
                dot={(props: ClickableDotProps<ProjectedStockPoint>) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null || !payload) return null;
                  const hasOrder = payload.dailyOrders.some((o) => o.order_id != null);
                  const isHovered = hoveredProjPoint?.data.date === payload.date;
                  return (
                    <circle
                      key={`proj-dot-${payload.date}`}
                      cx={cx}
                      cy={cy}
                      r={isHovered ? (hasOrder ? 8 : 6) : hasOrder ? 6 : 4}
                      fill={getDotFill(isHovered, hasOrder)}
                      stroke={payload.isFiller && !isHovered ? "transparent" : "white"}
                      strokeWidth={2}
                      style={{ cursor: hasOrder ? "pointer" : "default" }}
                      onMouseEnter={() => setHoveredProjPoint({ data: payload, cx, cy })}
                      onClick={() => {
                        const firstOrderId = payload.dailyOrders.find((o) => o.order_id)?.order_id;
                        if (firstOrderId) window.open(`/orders/${firstOrderId}`, "_blank");
                      }}
                    />
                  );
                }}
                activeDot={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
        {hoveredProjPoint && (
          <div
            className="pointer-events-auto absolute z-50"
            style={{
              ...(projContainerRef.current &&
              projContainerRef.current.offsetWidth > 0 &&
              hoveredProjPoint.cx > (projContainerRef.current.offsetWidth * 2) / 3
                ? { right: projContainerRef.current.offsetWidth - hoveredProjPoint.cx + 12 }
                : { left: hoveredProjPoint.cx + 12 }),
              top: Math.max(4, hoveredProjPoint.cy - 60),
              zIndex: 100,
            }}
          >
            <CustomTooltip point={hoveredProjPoint.data} />
          </div>
        )}
      </div>
    </>
  );
}
