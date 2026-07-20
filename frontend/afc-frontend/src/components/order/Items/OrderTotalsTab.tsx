import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { OrderItemPayload } from "../../../api/orderDetail";
import type { OrderType } from "../../../constants/orderTypes";
import { isOutgoingType } from "../../../constants/orderTypes";
import { useWarehouse } from "../../../hooks/useWarehouse";
import {
  extractBuildingNames,
  filterItemsByBuilding,
  sortByTotalCountDesc,
} from "./orderProductSummaries";

function itemSkipsInventory(item: OrderItemPayload, orderType: OrderType): boolean {
  if (orderType === "incoming") return false;
  return Boolean(item.no_stock_deduction);
}

interface Props {
  items: OrderItemPayload[];
  orderType: OrderType;
  selectedBuilding: string;
  onSelectedBuildingChange: (value: string) => void;
}

interface ProductSummary {
  product_id: number;
  part_number: string;
  total_ordered: number;
  total_fulfilled: number;
  total_pending: number;
  on_hand: number | null;
  reserved: number | null;
  available: number | null;
  /** on_hand keyed by warehouse name */
  on_hand_by_wh: Record<string, number | null>;
  /** available (on_hand − reserved) keyed by warehouse name */
  available_by_wh: Record<string, number | null>;
  /** sum of available across all warehouses */
  available_combined: number | null;
}

function hasEnoughStock(product: ProductSummary, orderType: OrderType): boolean {
  const available = product.available_combined ?? product.available;
  if (available === null && product.on_hand === null) return true;
  const remaining = product.total_ordered - product.total_fulfilled;
  if (isOutgoingType(orderType)) {
    return (available ?? 0) >= remaining;
  }
  // For incoming: fully allocated if pending + fulfilled >= ordered
  return product.total_pending + product.total_fulfilled >= product.total_ordered;
}

export default function OrderTotalsTab({
  items,
  orderType,
  selectedBuilding,
  onSelectedBuildingChange,
}: Props) {
  const { warehouses } = useWarehouse();

  const buildings = useMemo(() => extractBuildingNames(items), [items]);

  const filteredItems = useMemo(
    () => filterItemsByBuilding(items, selectedBuilding),
    [items, selectedBuilding],
  );

  // Aggregate product totals from filtered items
  const productSummaries = useMemo(() => {
    const map = new Map<number, ProductSummary>();

    for (const item of filteredItems) {
      if (item.type === "Unit_Separator" || item.type === "Section_Separator") continue;
      if (!item.product_id) continue;

      const skips = itemSkipsInventory(item, orderType);

      // Build per-warehouse maps from item payload
      const itemOnHandByWh: Record<string, number | null> = {};
      const itemAvailByWh: Record<string, number | null> = {};
      if (!skips) {
        for (const wh of warehouses) {
          itemOnHandByWh[wh.name] = item.on_hand_by_warehouse?.[wh.name] ?? null;
          itemAvailByWh[wh.name] = item.available_by_warehouse?.[wh.name] ?? null;
        }
      }

      // Combined available = sum across all warehouses (null if no warehouse data at all)
      const whAvailValues = Object.values(itemAvailByWh);
      const itemAvailCombined =
        !skips && whAvailValues.some((v) => v !== null)
          ? whAvailValues.reduce<number>((sum, v) => sum + (v ?? 0), 0)
          : null;

      const existing = map.get(item.product_id);
      if (existing) {
        existing.total_ordered += item.quantity_ordered;
        existing.total_fulfilled += item.quantity_fulfilled;
        existing.total_pending += item.quantity_pending ?? 0;
        // Fill in inventory data the first time we see a non-skipping item
        if (!skips && existing.on_hand === null) {
          existing.on_hand = item.on_hand;
          existing.reserved = item.reserved;
          existing.available = item.available;
          existing.on_hand_by_wh = itemOnHandByWh;
          existing.available_by_wh = itemAvailByWh;
          existing.available_combined = itemAvailCombined;
        }
      } else {
        map.set(item.product_id, {
          product_id: item.product_id,
          part_number: item.part_number,
          total_ordered: item.quantity_ordered,
          total_fulfilled: item.quantity_fulfilled,
          total_pending: item.quantity_pending ?? 0,
          on_hand: skips ? null : item.on_hand,
          reserved: skips ? null : item.reserved,
          available: skips ? null : item.available,
          on_hand_by_wh: skips ? {} : itemOnHandByWh,
          available_by_wh: skips ? {} : itemAvailByWh,
          available_combined: skips ? null : itemAvailCombined,
        });
      }
    }

    return sortByTotalCountDesc(Array.from(map.values()), (row) => row.total_ordered);
  }, [filteredItems, warehouses, orderType]);

  const totalUniqueProducts = productSummaries.length;
  const totalOrdered = productSummaries.reduce((s, p) => s + p.total_ordered, 0);
  const totalFulfilled = productSummaries.reduce((s, p) => s + p.total_fulfilled, 0);
  const productsWithInventory = productSummaries.filter(
    (p) =>
      p.on_hand !== null ||
      Object.values(p.on_hand_by_wh).some((v) => v !== null)
  );
  const allHaveEnoughStock =
    productsWithInventory.length > 0 &&
    productsWithInventory.every((p) => hasEnoughStock(p, orderType));

  const pendingLabel = isOutgoingType(orderType) ? "Reserved" : "Ordered";

  // Total columns: Part Number + Total Ordered + pendingLabel + Fulfilled + Remaining
  //                + one per warehouse + Available + Stock Status
  const colCount = 5 + warehouses.length + 2;

  return (
    <div className="p-4 space-y-4">
      {/* Building filter */}
      {buildings.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Building:</label>
          <select
            className="select select-sm select-bordered"
            value={selectedBuilding}
            onChange={(e) => onSelectedBuildingChange(e.target.value)}
          >
            <option value="__all__">All Buildings</option>
            {buildings.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-xs text-gray-500">Unique Products</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-800">{totalUniqueProducts}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-xs text-gray-500">Total Ordered</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-800">{totalOrdered}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-xs text-gray-500">Total Fulfilled</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-800">{totalFulfilled}</div>
        </div>
        <div
          className={`rounded-lg p-3 border ${
            allHaveEnoughStock
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="text-xs text-gray-500">Stock Status</div>
          <div
            className={`text-lg font-bold ${
              allHaveEnoughStock ? "text-green-700" : "text-red-700"
            }`}
          >
            {productsWithInventory.length === 0
              ? "—"
              : allHaveEnoughStock
              ? "✓ Sufficient"
              : "✗ Insufficient"}
          </div>
        </div>
      </div>

      {/* Product breakdown table */}
      <div className="overflow-x-auto">
        <table className="table w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th>Part Number</th>
              <th className="text-center">Total Ordered</th>
              <th className="text-center">{pendingLabel}</th>
              <th className="text-center">Fulfilled</th>
              <th className="text-center">Remaining</th>
              {warehouses.map((wh) => (
                <th key={wh.id} className="text-center">
                  {wh.name} - On Hand
                </th>
              ))}
              <th className="text-center">Available</th>
              <th className="text-center">Stock Status</th>
            </tr>
          </thead>
          <tbody>
            {productSummaries.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="text-gray-400 italic p-4">
                  No products found
                </td>
              </tr>
            ) : (
              productSummaries.map((product) => {
                const remaining = product.total_ordered - product.total_fulfilled;
                const enough = hasEnoughStock(product, orderType);
                const hasInventory =
                  product.on_hand !== null ||
                  Object.values(product.on_hand_by_wh).some((v) => v !== null);
                const displayAvailable =
                  product.available_combined ?? product.available;
                return (
                  <tr key={product.product_id} className="hover:bg-gray-50">
                    <td className="font-semibold">
                      <Link
                        to={`/products/${product.product_id}`}
                        className="hover:text-[#3A7BD5] hover:underline"
                      >
                        {product.part_number}
                      </Link>
                    </td>
                    <td className="text-center">{product.total_ordered}</td>
                    <td className="text-center">{product.total_pending}</td>
                    <td className="text-center">{product.total_fulfilled}</td>
                    <td className="text-center">{remaining}</td>
                    {warehouses.map((wh) => (
                      <td key={wh.id} className="text-center">
                        {product.on_hand_by_wh[wh.name] !== null &&
                        product.on_hand_by_wh[wh.name] !== undefined
                          ? product.on_hand_by_wh[wh.name]
                          : "—"}
                      </td>
                    ))}
                    <td className="text-center">
                      {displayAvailable !== null ? displayAvailable : "—"}
                    </td>
                    <td className="text-center">
                      {!hasInventory ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={`badge badge-sm ${
                            enough ? "badge-success" : "badge-error"
                          }`}
                        >
                          {enough ? (
                            "✓"
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-4 my-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {productSummaries.length > 1 && (
            <tfoot>
              <tr className="font-semibold border-t-2 border-gray-300 bg-gray-50">
                <td>Totals</td>
                <td className="text-right">{totalOrdered}</td>
                <td className="text-right">
                  {productSummaries.reduce((s, p) => s + p.total_pending, 0)}
                </td>
                <td className="text-right">{totalFulfilled}</td>
                <td className="text-right">{totalOrdered - totalFulfilled}</td>
                {warehouses.map((wh) => (
                  <td key={wh.id} className="text-right">—</td>
                ))}
                <td className="text-right">—</td>
                <td className="text-center">
                  {productsWithInventory.length === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span
                      className={`badge badge-sm ${
                        allHaveEnoughStock ? "badge-success" : "badge-error"
                      }`}
                    >
                      {allHaveEnoughStock ? "✓" : "✗"}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
