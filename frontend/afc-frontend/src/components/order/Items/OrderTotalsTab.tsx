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
  rowKey: string;
  product_id: number;
  part_number: string;
  description: string;
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
}

function summaryKey(partNumber: string, description: string): string {
  return `${partNumber}\0${description}`;
}

function getDisplayOnHand(
  product: ProductSummary,
  activeWarehouseName: string | null,
): number | null {
  if (activeWarehouseName) {
    return product.on_hand_by_wh[activeWarehouseName] ?? null;
  }
  return product.on_hand;
}

function getDisplayAvailable(
  product: ProductSummary,
  activeWarehouseName: string | null,
): number | null {
  if (activeWarehouseName) {
    return product.available_by_wh[activeWarehouseName] ?? null;
  }
  return product.available;
}

function hasInventoryInWarehouse(
  product: ProductSummary,
  activeWarehouseName: string | null,
): boolean {
  if (activeWarehouseName) {
    const onHand = product.on_hand_by_wh[activeWarehouseName];
    return onHand !== null && onHand !== undefined;
  }
  return product.on_hand !== null;
}

function hasEnoughStock(
  product: ProductSummary,
  orderType: OrderType,
  activeWarehouseName: string | null,
): boolean {
  const available = getDisplayAvailable(product, activeWarehouseName);
  const onHand = getDisplayOnHand(product, activeWarehouseName);
  if (available === null && onHand === null) return true;
  const remaining = product.total_ordered - product.total_fulfilled;
  if (isOutgoingType(orderType)) {
    return (available ?? 0) >= remaining;
  }
  return product.total_pending + product.total_fulfilled >= product.total_ordered;
}

export default function OrderTotalsTab({
  items,
  orderType,
  selectedBuilding,
  onSelectedBuildingChange,
}: Props) {
  const { warehouses, activeWarehouseId } = useWarehouse();
  const activeWarehouseName =
    warehouses.find((w) => w.id === activeWarehouseId)?.name ?? null;

  const buildings = useMemo(() => extractBuildingNames(items), [items]);

  const filteredItems = useMemo(
    () => filterItemsByBuilding(items, selectedBuilding),
    [items, selectedBuilding],
  );

  const productSummaries = useMemo(() => {
    const map = new Map<string, ProductSummary>();

    for (const item of filteredItems) {
      if (item.type === "Unit_Separator" || item.type === "Section_Separator") continue;
      if (!item.product_id) continue;

      const description = item.note?.trim() ?? "";
      const key = summaryKey(item.part_number, description);
      const skips = itemSkipsInventory(item, orderType);

      const itemOnHandByWh: Record<string, number | null> = {};
      const itemAvailByWh: Record<string, number | null> = {};
      if (!skips) {
        for (const wh of warehouses) {
          itemOnHandByWh[wh.name] = item.on_hand_by_warehouse?.[wh.name] ?? null;
          itemAvailByWh[wh.name] = item.available_by_warehouse?.[wh.name] ?? null;
        }
      }

      const existing = map.get(key);
      if (existing) {
        existing.total_ordered += item.quantity_ordered;
        existing.total_fulfilled += item.quantity_fulfilled;
        existing.total_pending += item.quantity_pending ?? 0;
        if (!skips && existing.on_hand === null) {
          existing.on_hand = item.on_hand;
          existing.reserved = item.reserved;
          existing.available = item.available;
          existing.on_hand_by_wh = itemOnHandByWh;
          existing.available_by_wh = itemAvailByWh;
        }
      } else {
        map.set(key, {
          rowKey: key,
          product_id: item.product_id,
          part_number: item.part_number,
          description,
          total_ordered: item.quantity_ordered,
          total_fulfilled: item.quantity_fulfilled,
          total_pending: item.quantity_pending ?? 0,
          on_hand: skips ? null : item.on_hand,
          reserved: skips ? null : item.reserved,
          available: skips ? null : item.available,
          on_hand_by_wh: skips ? {} : itemOnHandByWh,
          available_by_wh: skips ? {} : itemAvailByWh,
        });
      }
    }

    return sortByTotalCountDesc(Array.from(map.values()), (row) => row.total_ordered);
  }, [filteredItems, warehouses, orderType]);

  const totalUniqueProducts = productSummaries.length;
  const totalOrdered = productSummaries.reduce((s, p) => s + p.total_ordered, 0);
  const totalFulfilled = productSummaries.reduce((s, p) => s + p.total_fulfilled, 0);
  const productsWithInventory = productSummaries.filter((p) =>
    hasInventoryInWarehouse(p, activeWarehouseName),
  );
  const allHaveEnoughStock =
    productsWithInventory.length > 0 &&
    productsWithInventory.every((p) =>
      hasEnoughStock(p, orderType, activeWarehouseName),
    );

  const colCount = 7;

  return (
    <div className="p-4 space-y-4">
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

      <div className="overflow-x-auto">
        <table className="table w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th>Part Number</th>
              <th>Description</th>
              <th className="text-center">Total Ordered</th>
              <th className="text-center">Remaining</th>
              <th className="text-center">On Hand</th>
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
                const enough = hasEnoughStock(product, orderType, activeWarehouseName);
                const hasInventory = hasInventoryInWarehouse(product, activeWarehouseName);
                const displayOnHand = getDisplayOnHand(product, activeWarehouseName);
                const displayAvailable = getDisplayAvailable(product, activeWarehouseName);
                return (
                  <tr key={product.rowKey} className="hover:bg-gray-50">
                    <td className="font-semibold">
                      <Link
                        to={`/products/${product.product_id}`}
                        className="hover:text-[#3A7BD5] hover:underline"
                      >
                        {product.part_number}
                      </Link>
                    </td>
                    <td>{product.description || "—"}</td>
                    <td className="text-center">{product.total_ordered}</td>
                    <td className="text-center">{remaining}</td>
                    <td className="text-center">
                      {displayOnHand !== null ? displayOnHand : "—"}
                    </td>
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
                <td />
                <td className="text-right">{totalOrdered}</td>
                <td className="text-right">{totalOrdered - totalFulfilled}</td>
                <td className="text-right">—</td>
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
