import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import type { TopRankedItem, TopRankedItemsResponse } from "../../api/dashboard";
import { CHART_COLORS } from "./chartColors";
import { productDetailPath } from "../../utils/dashboardLinks";

interface TopItemsPieChartProps {
  topField: string;
  onFieldChange: (field: string) => void;
  topItemsData: TopRankedItemsResponse | null;
  loading: boolean;
  error: string | null;
}

export default function TopItemsPieChart({
  topField,
  onFieldChange,
  topItemsData,
  loading,
  error,
}: TopItemsPieChartProps) {
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
    return data.sort((a, b) => b.value - a.value);
  }, [topItemsData, topField]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-sm font-semibold uppercase text-gray-700 mb-4">
        Top 20 Items - Stock Distribution
      </h2>
      <select
        className="select select-bordered select-sm w-full mb-4"
        value={topField}
        onChange={(e) => onFieldChange(e.target.value)}
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
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-center py-8 text-sm">{error}</p>
      ) : pieChartData.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No data available</p>
      ) : (
        <div className="flex items-center gap-6 pt-10">
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
                    <span className="text-gray-700">
                      {entry.product_id > 0 ? (
                        <Link
                          to={productDetailPath(entry.product_id)}
                          className="text-blue-600 hover:underline"
                        >
                          {entry.name}
                        </Link>
                      ) : (
                        entry.name
                      )}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : "0.0"}%
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
