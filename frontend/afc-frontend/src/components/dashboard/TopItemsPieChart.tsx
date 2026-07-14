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
    return topItemsData.top_items
      .map((item) => ({
        name: item.product_name,
        value: item[topField as keyof TopRankedItem] as number,
        product_id: item.product_id,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [topItemsData, topField]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-sm font-semibold uppercase text-gray-700 mb-4">
        Top Items - Stock Distribution
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
        TOP ITEMS BY FIELD
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
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 text-xs space-y-1">
            {pieChartData.map((entry, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{
                      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-gray-700">
                    <Link
                      to={productDetailPath(entry.product_id)}
                      className="text-blue-600 hover:underline"
                    >
                      {entry.name}
                    </Link>
                  </span>
                </div>
                <span className="font-semibold text-gray-900">
                  {entry.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
