import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import { fetchOrders, type OrderRowItemPayload, type OrderSearchParams } from "../api/ordersTable";
import { fetchProducts, type Product } from "../api/products";
import type { Customer } from "../api/customers";
import type { Supplier } from "../api/suppliers";
import { fetchCustomers } from "../api/customers";
import { fetchSuppliers } from "../api/suppliers";
import FilterMultiSelect from "../components/FilterMultiSelect";
import { usePersistedFilters } from "../hooks/usePersistedFilters";
import CreateOrderModal from "../components/order/Table/CreateOrderModal";
import PullFromQBModal from "../components/order/Table/PullFromQBModal";
import { ALL_ORDER_TYPES, ORDER_TYPE_LABELS, type OrderType } from "../constants/orderTypes";
import { useWarehouse } from "../hooks/useWarehouse";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { formatQbExternalRef } from "../utils/qbDocType";

function sortOrdersByOrderNumberDesc(orders: OrderRowItemPayload[]): OrderRowItemPayload[] {
  return [...orders].sort((a, b) => {
    const aNum = a.order_number ?? `AFC-${String(a.id).padStart(6, "0")}`;
    const bNum = b.order_number ?? `AFC-${String(b.id).padStart(6, "0")}`;
    return bNum.localeCompare(aNum, undefined, { numeric: true });
  });
}

/** Light-background badge classes keyed by order type. */
const ORDER_TYPE_BADGE_CLASSES: Record<OrderType, string> = {
  incoming:     "bg-green-100  text-green-700",
  installation: "bg-blue-100   text-blue-700",
  will_call:    "bg-purple-100 text-purple-700",
  delivery:     "bg-teal-100   text-teal-700",
  shipment:     "bg-cyan-100   text-cyan-700",
  void:         "bg-gray-100   text-gray-700",
};

function asNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((v) => !Number.isNaN(v));
  }
  return [];
}

export default function OrdersSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeWarehouseId } = useWarehouse();
  const { hasPermission } = useAuth();
  const { showToast } = useToast();

  //Customer and supplier list
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Create Order Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPullQBModal, setShowPullQBModal] = useState(false);

  // Advanced Filters: inline sidebar at xl+, overlay below
  const XL_BREAKPOINT = 1280;
  const [filtersOpen, setFiltersOpen] = useState(() => window.innerWidth >= XL_BREAKPOINT);

  const handleResize = useCallback(() => {
    if (window.innerWidth >= XL_BREAKPOINT) {
      setFiltersOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);
  
  const typeFilterOptions = useMemo(
    () =>
      ALL_ORDER_TYPES.map((type, index) => ({
        value: String(index),
        label: ORDER_TYPE_LABELS[type],
      })),
    []
  );

  const customerFilterOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.name,
      })),
    [customers]
  );

  const supplierFilterOptions = useMemo(
    () =>
      suppliers.map((supplier) => ({
        value: String(supplier.id),
        label: supplier.name,
      })),
    [suppliers]
  );
  
  // Search filters (PERSISTED)
  const [filters, setFilter] = usePersistedFilters("filters_orders_search", {
    searchId: "",
    searchQBId: "",
    searchDescription: "",
    selectedCustomers: [] as number[],
    selectedSuppliers: [] as number[],
    selectedTypes: [] as number[],
    dateFrom: "",
    dateTo: "",
    dateFilterType: "created" as "created" | "completed",
    selectedProducts: [] as number[],
    productSearch: "",
  });

  const selectedCustomers = asNumberArray(filters.selectedCustomers);
  const selectedSuppliers = asNumberArray(filters.selectedSuppliers);
  const selectedTypes = asNumberArray(filters.selectedTypes);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  
  // Available products for filtering
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  
  // Results
  const [results, setResults] = useState<OrderRowItemPayload[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  
  // Load products customer and suppliers on mount
  useEffect(() => {
    fetchProducts().then(setAvailableProducts).catch(console.error);
    fetchCustomers().then(setCustomers).catch(console.error);
    fetchSuppliers().then(setSuppliers).catch(console.error);
  }, [activeWarehouseId]);
  
  // Handle URL parameters on mount
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const productIdsParam = searchParams.get('product_ids');
    
    if (typeParam || productIdsParam) {
      // Update filters from URL params and trigger search in one go
      const updatedFilters: Record<string, string | number[]> = {};
      
      if (typeParam) {
        const typeIndex = ALL_ORDER_TYPES.indexOf(typeParam as OrderType);
        if (typeIndex >= 0) {
          updatedFilters.selectedTypes = [typeIndex];
        }
      }
      if (productIdsParam) {
        const productIds = productIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        updatedFilters.selectedProducts = productIds;
      }
      
      // Perform the search directly with the URL parameters
      performSearch(1, updatedFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const performSearch = async (
    page: number,
    additionalFilters: Record<string, string | number[]> = {}
  ) => {
    setLoading(true);
    setSearched(true);
    setCurrentPage(page);
    
    try {
      const activeFilters = { ...filters, ...additionalFilters };

      const activeCustomers = asNumberArray(activeFilters.selectedCustomers);
      const activeSuppliers = asNumberArray(activeFilters.selectedSuppliers);
      const activeTypes = asNumberArray(activeFilters.selectedTypes);

      const apiFilters: OrderSearchParams = {};
      
      if (activeFilters.searchId) apiFilters.order_number = activeFilters.searchId as string;
      if (activeFilters.searchQBId) apiFilters.external_order_number = activeFilters.searchQBId as string;
      if (activeFilters.searchDescription) apiFilters.description = activeFilters.searchDescription as string;
      if (activeCustomers.length > 0) apiFilters.customer_id = activeCustomers;
      if (activeSuppliers.length > 0) apiFilters.supplier_id = activeSuppliers;
      if (activeTypes.length > 0) {
        apiFilters.type = activeTypes
          .map((index) => ALL_ORDER_TYPES[index])
          .filter((type): type is OrderType => Boolean(type));
      }
      
      // Date filters based on selected type
      if (activeFilters.dateFilterType === "created") {
        if (activeFilters.dateFrom) apiFilters.created_from = activeFilters.dateFrom as string;
        if (activeFilters.dateTo) apiFilters.created_to = activeFilters.dateTo as string;
      } else {
        if (activeFilters.dateFrom) apiFilters.completed_from = activeFilters.dateFrom as string;
        if (activeFilters.dateTo) apiFilters.completed_to = activeFilters.dateTo as string;
      }
      
      // Product filters
      const selectedProducts = activeFilters.selectedProducts as number[];
      if (selectedProducts && selectedProducts.length > 0) {
        apiFilters.product_ids = selectedProducts.join(",");
      }
      
      const response = await fetchOrders(page, pageSize, apiFilters);
      setResults(sortOrdersByOrderNumberDesc(response.results || []));
      setTotalResults(response.total || 0);
      
      // Update the persisted filters if we used additional filters
      if (Object.keys(additionalFilters).length > 0) {
        Object.entries(additionalFilters).forEach(([key, value]) => {
          setFilter(key as keyof typeof filters, value);
        });
      }
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (page = 1) => {
    await performSearch(page);
  };

  async function handleOrderCreated(orderId?: number) {
    showToast(
      orderId
        ? `Order #${orderId} created successfully`
        : "Order created successfully",
      "success",
    );
    await performSearch(1);
  }

  //Perform initial search if URL has relevant params
  useEffect(() => {
    handleSearch(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWarehouseId]);

  const handleClearSearch = () => {
    setFilter("searchId", "");
    setFilter("searchQBId", "");
    setFilter("searchDescription", "");
    setFilter("selectedCustomers", []);
    setFilter("selectedSuppliers", []);
    setFilter("selectedTypes", []);
    setFilter("dateFrom", "");
    setFilter("dateTo", "");
    setFilter("dateFilterType", "created");
    setFilter("selectedProducts", []);
    setFilter("productSearch", "");
    setResults([]);
    setTotalResults(0);
    setSearched(false);
    setCurrentPage(1);
  };

  const setPresetDateRange = (preset: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (preset) {
      case 'today':
        setFilter("dateFrom", todayStr);
        setFilter("dateTo", todayStr);
        break;
      case 'last7': {
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        setFilter("dateFrom", last7.toISOString().split('T')[0]);
        setFilter("dateTo", todayStr);
        break;
      }
      case 'last30': {
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        setFilter("dateFrom", last30.toISOString().split('T')[0]);
        setFilter("dateTo", todayStr);
        break;
      }
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", { 
      timeZone: "UTC",
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const advancedFiltersContent = (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">
          Advanced Filters
        </h2>
        <button
          className="btn btn-ghost btn-sm btn-square"
          onClick={() => setFiltersOpen(false)}
          title="Close filters"
        >
          ✕
        </button>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Date Range
        </h3>
        <div className="mb-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                filters.dateFilterType === "created"
                  ? "bg-primary text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setFilter("dateFilterType", "created")}
            >
              Creation Date
            </button>
            <button
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                filters.dateFilterType === "completed"
                  ? "bg-primary text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setFilter("dateFilterType", "completed")}
            >
              Completion Date
            </button>
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <button className="btn btn-sm btn-outline flex-1" onClick={() => setPresetDateRange('today')}>
            Today
          </button>
          <button className="btn btn-sm btn-outline flex-1" onClick={() => setPresetDateRange('last7')}>
            Last 7d
          </button>
          <button className="btn btn-sm btn-outline flex-1" onClick={() => setPresetDateRange('last30')}>
            Last 30d
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              className="input input-bordered input-sm w-full"
              value={filters.dateFrom}
              onChange={(e) => setFilter("dateFrom", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              className="input input-bordered input-sm w-full"
              value={filters.dateTo}
              onChange={(e) => setFilter("dateTo", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Products Included
        </h3>
        <input
          type="text"
          placeholder="Search products..."
          className="input input-bordered input-sm w-full mb-3"
          value={filters.productSearch}
          onChange={(e) => setFilter("productSearch", e.target.value)}
        />
        {filters.selectedProducts.length > 0 && (
          <div className="text-xs text-gray-600 mb-2">
            {filters.selectedProducts.length} product{filters.selectedProducts.length !== 1 ? 's' : ''} selected
          </div>
        )}
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
          {(() => {
            const filteredProducts = availableProducts.filter((product) =>
              filters.productSearch === "" ||
              (product.part_number?.toLowerCase().includes(filters.productSearch.toLowerCase()) ?? false) ||
              product.category.toLowerCase().includes(filters.productSearch.toLowerCase())
            );
            return filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <label
                  key={product.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={filters.selectedProducts.includes(product.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilter("selectedProducts", [...filters.selectedProducts, product.id]);
                      } else {
                        setFilter("selectedProducts",
                          filters.selectedProducts.filter((id) => id !== product.id)
                        );
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {product.part_number}
                    </div>
                    <div className="text-xs text-gray-500">{product.category}</div>
                  </div>
                </label>
              ))
            ) : (
              <div className="p-4 text-xs text-gray-400 text-center">No products found</div>
            );
          })()}
        </div>
        {filters.selectedProducts.length > 0 && (
          <button
            className="btn btn-ghost btn-sm w-full mt-2"
            onClick={() => setFilter("selectedProducts", [])}
          >
            Clear Selection
          </button>
        )}
      </div>

      <button
        className="btn btn-primary btn-block"
        onClick={() => handleSearch(1)}
        disabled={loading}
      >
        Apply Filters
      </button>
    </>
  );

  return (
    <MainLayout>
      <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 relative">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {/* Header Search Controls */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                Search Orders
              </h1>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {hasPermission("qb:pull_orders") && (
                <button
                  className="
                    px-5 py-2.5 rounded-lg
                    text-sm font-semibold text-white
                    shadow-md transition
                    cursor-pointer
                    hover:shadow-lg hover:-translate-y-0.5
                    active:translate-y-0
                  "
                  style={{
                    background:
                      "linear-gradient(90deg, #2B8A3E 0%, #237032 100%)",
                  }}
                  onClick={() => setShowPullQBModal(true)}
                >
                  Pull From QB
                </button>
                )}
                {hasPermission("orders:create") && (
                  <button
                    className="
                      px-5 py-2.5 rounded-lg
                      text-sm font-semibold text-white
                      shadow-md transition
                      cursor-pointer
                      hover:shadow-lg hover:-translate-y-0.5
                      active:translate-y-0
                    "
                    style={{
                      background:
                        "linear-gradient(90deg, #3A7BD5 0%, #2B60C8 100%)",
                    }}
                    onClick={() => setShowCreateModal(true)}
                  >
                    + Create Order
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex gap-4 items-end flex-wrap">
              {/* ID Input with AFC- prefix */}
              <div className="flex-1 min-w-[140px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order ID
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-600 text-sm font-medium">
                    AFC-
                  </span>
                  <input
                    type="text"
                    placeholder="123"
                    className="input input-bordered w-full rounded-l-none"
                    value={filters.searchId}
                    onChange={(e) => setFilter("searchId", e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>

              {/* QuickBooks ID Input */}
              <div className="flex-1 min-w-[140px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Books ID
                </label>
                <input
                  type="text"
                  placeholder="Search QB reference..."
                  className="input input-bordered w-full"
                  value={filters.searchQBId}
                  onChange={(e) => setFilter("searchQBId", e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              {/* Description Input */}
              <div className="flex-1 min-w-[140px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Search description..."
                  className="input input-bordered w-full"
                  value={filters.searchDescription}
                  onChange={(e) => setFilter("searchDescription", e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              {/* Customer */}
              <FilterMultiSelect
                label="Customer"
                placeholder="All Customers"
                options={customerFilterOptions}
                selected={selectedCustomers.map(String)}
                searchable
                searchPlaceholder="Search customers…"
                className="flex-1 min-w-[180px]"
                onChange={(values) =>
                  setFilter(
                    "selectedCustomers",
                    values.map((value) => Number(value)).filter((id) => !Number.isNaN(id))
                  )
                }
              />

              {/* Supplier */}
              <FilterMultiSelect
                label="Supplier"
                placeholder="All Suppliers"
                options={supplierFilterOptions}
                selected={selectedSuppliers.map(String)}
                searchable
                searchPlaceholder="Search suppliers…"
                className="flex-1 min-w-[180px]"
                onChange={(values) =>
                  setFilter(
                    "selectedSuppliers",
                    values.map((value) => Number(value)).filter((id) => !Number.isNaN(id))
                  )
                }
              />

              {/* Type */}
              <FilterMultiSelect
                label="Type"
                placeholder="All Types"
                options={typeFilterOptions}
                selected={selectedTypes.map(String)}
                className="flex-1 min-w-[180px]"
                onChange={(values) =>
                  setFilter(
                    "selectedTypes",
                    values.map((value) => Number(value)).filter((id) => !Number.isNaN(id))
                  )
                }
              />

              {/* Search Button */}
              <button
                className="btn btn-primary px-8"
                onClick={() => handleSearch(1)}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Search"
                )}
              </button>

              {/* Toggle Advanced Filters */}
              <button
                className="btn btn-outline px-4"
                onClick={() => setFiltersOpen((o) => !o)}
                title={filtersOpen ? "Hide advanced filters" : "Show advanced filters"}
                aria-label={filtersOpen ? "Hide advanced filters" : "Show advanced filters"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Results Summary */}
          {searched && (
            <div className="bg-white rounded-lg shadow-sm px-6 py-4 mb-4 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
              <div className="text-sm text-gray-600">
                Found <span className="font-semibold text-gray-900">{totalResults}</span> result{totalResults !== 1 ? 's' : ''}
              </div>
              
              {totalResults > pageSize && (
                <div className="flex gap-2 order-last sm:order-none sm:mx-auto">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleSearch(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    Previous
                  </button>
                  <span className="flex items-center px-4 text-sm font-medium text-gray-700">
                    Page {currentPage} of {Math.ceil(totalResults / pageSize)}
                  </span>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleSearch(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalResults / pageSize) || loading}
                  >
                    Next
                  </button>
                </div>
              )}
              
              <button
                className="btn btn-ghost btn-sm self-start sm:self-auto sm:ml-auto"
                onClick={handleClearSearch}
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Results List */}
          <div className="space-y-3">
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-gray-500 mt-4">Searching...</p>
              </div>
            ) : results.length === 0 && searched ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500 text-base sm:text-lg">No orders found</p>
                <p className="text-gray-400 text-sm mt-2">Try adjusting your search criteria</p>
              </div>
            ) : results.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500 text-base sm:text-lg">Start searching for orders</p>
                <p className="text-gray-400 text-sm mt-2">Use the search filters above to find orders</p>
              </div>
            ) : (
              <>
                {results.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer p-5 border border-gray-100"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      {/* Left section */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Order #{order.id}
                          </h3>
                          {order.external_order_number && (
                            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 truncate max-w-[200px] sm:max-w-none">
                              {formatQbExternalRef(order.external_order_number, order.qb_doc_type)}
                            </span>
                          )}
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              ORDER_TYPE_BADGE_CLASSES[order.type as OrderType] ?? "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {ORDER_TYPE_LABELS[order.type as OrderType] ?? order.type.charAt(0).toUpperCase() + order.type.slice(1)}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>
                            <span className="font-medium">
                              {order.type === "incoming" ? "Supplier:" : "Customer:"}
                            </span> {order.cs_name}
                          </div>
                          {order.description && (
                            <div className="text-gray-500 truncate">
                              {order.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right section */}
                      <div className="sm:text-right self-start sm:self-auto flex-shrink-0">
                        <div
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${
                            order.status === "Completed"
                              ? "bg-green-100 text-green-700"
                              : order.status.includes("Partial")
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {order.status}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(order.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Advanced Filters — desktop inline sidebar */}
        {filtersOpen && (
          <div className="hidden xl:block w-80 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-0">
              {advancedFiltersContent}
            </div>
          </div>
        )}

        {/* Advanced Filters — mobile/tablet overlay */}
        {filtersOpen && (
          <>
            <div
              className="xl:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setFiltersOpen(false)}
              aria-hidden="true"
            />
            <div className="xl:hidden fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto bg-white shadow-xl p-6">
              {advancedFiltersContent}
            </div>
          </>
        )}
      </div>

      {/* ===================== CREATE MODAL ===================== */}
      <CreateOrderModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleOrderCreated}
      />

      {/* ===================== PULL FROM QB MODAL ===================== */}
      <PullFromQBModal
        open={showPullQBModal}
        onClose={() => setShowPullQBModal(false)}
        onCreated={handleOrderCreated}
      />
    </MainLayout>
  );
}
