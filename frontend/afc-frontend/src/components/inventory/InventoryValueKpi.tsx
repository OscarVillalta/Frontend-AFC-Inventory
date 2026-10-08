import { Component, useEffect, useState, type ReactNode } from "react";
import { fetchInventoryValue } from "../../api/inventoryValue";
import type { InventoryValue } from "../../api/inventoryValue";
import type { Supplier } from "../../api/suppliers";
import { AUTH_TOKEN_KEY } from "../../context/authContextDef";
import { useWarehouse } from "../../hooks/useWarehouse";
import { formatUnitPrice } from "../../utils/currency";

type Breakdown = "total" | "supplier" | "product";

interface InventoryValueKpiProps {
  refreshToken?: number;
  suppliers: Supplier[];
}

interface BoundaryState {
  failed: boolean;
}

class InventoryValueBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Inventory value KPI failed:", error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function isAdminSession(): boolean {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return false;
    const part = token.split(".")[1];
    if (!part) return false;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload: unknown = JSON.parse(atob(padded));
    if (!payload || typeof payload !== "object") return false;
    const role = (payload as { role?: unknown }).role;
    return typeof role === "string" && role.trim().toLowerCase() === "admin";
  } catch {
    return false;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function isForbidden(error: unknown): boolean {
  return error instanceof Error && /forbidden|\b403\b/i.test(error.message);
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

const inputCls =
  "border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400";

function InventoryValueKpiInner({ refreshToken, suppliers }: InventoryValueKpiProps) {
  const isAdmin = isAdminSession();
  const { activeWarehouseId, warehouses } = useWarehouse();
  const [breakdown, setBreakdown] = useState<Breakdown>("total");
  const [supplierId, setSupplierId] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [data, setData] = useState<InventoryValue | null>(null);
  const [dataKey, setDataKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isAdmin || hidden) return;
    const controller = new AbortController();
    let cancelled = false;

    const supplier = supplierId ? Number(supplierId) : undefined;
    const requestKey = `${activeWarehouseId ?? ""}|${breakdown}|${supplierId}|${debouncedQuery}|${refreshToken ?? 0}|${reloadKey}`;
    fetchInventoryValue(
      {
        supplierId: supplier && supplier > 0 ? supplier : undefined,
        groupBy: breakdown === "total" ? undefined : breakdown,
        q: debouncedQuery || undefined,
        limit: 50,
      },
      controller.signal,
    )
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setDataKey(requestKey);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled || isAbortError(err)) return;
        if (isForbidden(err)) {
          setHidden(true);
          setData(null);
          return;
        }
        console.error("Failed to load inventory value:", err);
        setError("Inventory value is unavailable right now.");
        setErrorKey(requestKey);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAdmin, hidden, refreshToken, activeWarehouseId, breakdown, supplierId, debouncedQuery, reloadKey]);

  if (!isAdmin || hidden) return null;

  const requestKey = `${activeWarehouseId ?? ""}|${breakdown}|${supplierId}|${debouncedQuery}|${refreshToken ?? 0}|${reloadKey}`;
  const shown = dataKey === requestKey ? data : null;
  const visibleError = errorKey === requestKey ? error : null;
  const warehouseName = warehouses.find((warehouse) => warehouse.id === activeWarehouseId)?.name;
  const providers = suppliers
    .filter((supplier) => Number.isFinite(supplier?.id) && typeof supplier?.name === "string" && supplier.name.trim() !== "")
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const groups = shown?.groups ?? [];
  const scope = debouncedQuery
    ? "Matching products"
    : supplierId
      ? "This provider"
      : "Everything in inventory";

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden border-t-4 border-emerald-500">
      <div className="px-5 py-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Inventory value</p>
            <p className="text-3xl font-bold text-gray-800 mt-1" aria-live="polite">
              {shown ? formatUnitPrice(shown.gross_total) : visibleError ? "—" : "…"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {scope} · sum of gross amount (on hand × unit price)
              {warehouseName ? ` · ${warehouseName}` : ""}
            </p>
            {shown && (
              <p className="text-xs text-gray-500 mt-1">
                {formatCount(shown.sku_count)} SKUs · {formatCount(shown.on_hand_units)} on hand
                {shown.unpriced_skus > 0
                  ? ` · ${formatCount(shown.unpriced_skus)} stocked SKUs have no unit price and add $0`
                  : ""}
              </p>
            )}
            {visibleError && (
              <p className="text-xs text-red-600 mt-2">
                {visibleError}{" "}
                <button
                  type="button"
                  className="underline font-medium"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  Retry
                </button>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Inventory value breakdown">
            {(
              [
                ["total", "Complete total"],
                ["supplier", "Per provider"],
                ["product", "Per product"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setBreakdown(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                  breakdown === key
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-0.5 min-w-[180px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide" htmlFor="inventory-value-provider">
              Provider
            </label>
            <select
              id="inventory-value-provider"
              className={inputCls}
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">All providers</option>
              {providers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5 min-w-[200px] flex-1 max-w-sm">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide" htmlFor="inventory-value-product">
              Product
            </label>
            <input
              id="inventory-value-product"
              type="text"
              className={inputCls}
              placeholder="Filter by product name"
              value={query}
              maxLength={80}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {(supplierId !== "" || query !== "") && (
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800 font-medium pb-2"
              onClick={() => {
                setSupplierId("");
                setQuery("");
              }}
            >
              Clear value filters
            </button>
          )}
        </div>

        {breakdown !== "total" && shown && (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {groups.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No inventory matches these filters.</p>
            ) : (
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">
                        {breakdown === "supplier" ? "Provider" : "Product"}
                      </th>
                      {breakdown === "product" && (
                        <>
                          <th className="text-left font-medium px-3 py-2">Provider</th>
                          <th className="text-right font-medium px-3 py-2">Unit price</th>
                        </>
                      )}
                      <th className="text-right font-medium px-3 py-2">On hand</th>
                      <th className="text-right font-medium px-3 py-2">SKUs</th>
                      <th className="text-right font-medium px-3 py-2">Gross</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group, index) => (
                      <tr key={`${group.supplier_id ?? "s"}-${group.product_id ?? "p"}-${index}`} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">
                          {breakdown === "supplier"
                            ? group.supplier_name ?? "Unknown provider"
                            : group.product_name ?? "Unknown product"}
                        </td>
                        {breakdown === "product" && (
                          <>
                            <td className="px-3 py-2 text-gray-500">{group.supplier_name ?? "—"}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatUnitPrice(group.unit_price)}</td>
                          </>
                        )}
                        <td className="px-3 py-2 text-right text-gray-600">{formatCount(group.on_hand_units)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatCount(group.sku_count)}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">{formatUnitPrice(group.gross_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {shown.groups_truncated && (
              <p className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
                Showing the highest 50 matches. Narrow by provider or product name to see the rest.
              </p>
            )}
          </div>
        )}

        {!shown && !visibleError && (
          <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

export default function InventoryValueKpi(props: InventoryValueKpiProps) {
  return (
    <InventoryValueBoundary>
      <InventoryValueKpiInner {...props} />
    </InventoryValueBoundary>
  );
}
