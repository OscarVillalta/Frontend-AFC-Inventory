import { useState, useEffect } from "react";
import { useWarehouse } from "../hooks/useWarehouse";
import { fetchProducts } from "../api/products";
import type { Product } from "../api/products";
import { createTransfer } from "../api/warehouses";

interface StockTransferModalProps {
  open: boolean;
  onClose: () => void;
  onTransferred?: () => void;
}

export default function StockTransferModal({
  open,
  onClose,
  onTransferred,
}: StockTransferModalProps) {
  const { warehouses, activeWarehouseId } = useWarehouse();

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [fromWarehouseId, setFromWarehouseId] = useState<string>("");
  const [toWarehouseId, setToWarehouseId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const activeWarehouses = warehouses.filter((w) => w.is_active);

  useEffect(() => {
    if (!open) return;
    fetchProducts()
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setProductId("");
    setFromWarehouseId(activeWarehouseId ? String(activeWarehouseId) : "");
    setToWarehouseId("");
    setQuantity(1);
    setError(null);
    setSuccess(false);
  }, [open, activeWarehouseId]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!productId) {
      setError("Please select a product.");
      return;
    }
    if (!fromWarehouseId) {
      setError("Please select a source warehouse.");
      return;
    }
    if (!toWarehouseId) {
      setError("Please select a destination warehouse.");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError("Source and destination warehouses must be different.");
      return;
    }
    if (quantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createTransfer({
        product_id: Number(productId),
        from_warehouse_id: Number(fromWarehouseId),
        to_warehouse_id: Number(toWarehouseId),
        quantity,
      });
      setSuccess(true);
      onTransferred?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50">
      <div className="bg-white w-[540px] max-h-[90vh] overflow-y-auto rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            Stock Transfer
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
              ✅ Transfer completed successfully.
            </div>
            <div className="flex justify-end">
              <button className="btn btn-primary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600">
                Product
              </label>
              <select
                className="select select-bordered w-full mt-1"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={loading}
              >
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.part_number ?? `Product #${p.id}`} — {p.category}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Source Warehouse
                </label>
                <select
                  className="select select-bordered w-full mt-1"
                  value={fromWarehouseId}
                  onChange={(e) => setFromWarehouseId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select source...</option>
                  {activeWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">
                  Destination Warehouse
                </label>
                <select
                  className="select select-bordered w-full mt-1"
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select destination...</option>
                  {activeWarehouses
                    .filter((w) => String(w.id) !== fromWarehouseId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">
                Quantity
              </label>
              <input
                type="number"
                className="input input-bordered w-full mt-1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min={1}
                disabled={loading}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Transferring..." : "Transfer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
