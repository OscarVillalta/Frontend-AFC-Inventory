import { useEffect, useMemo, useState } from "react";
import type { ProductDetail } from "../../api/productDetail";
import {
  absorbProductIntoParent,
  fetchProductTransactions,
} from "../../api/productDetail";
import { fetchProducts, type Product } from "../../api/products";

interface AbsorbProductModalProps {
  open: boolean;
  product: ProductDetail;
  onClose: () => void;
  onAbsorbed: (parentProductId: number) => void;
}

function getIdentifier(product: ProductDetail | Product): string {
  if ("details" in product) {
    return product.details.part_number ?? product.details.name ?? `Product #${product.id}`;
  }
  return product.part_number ?? `Product #${product.id}`;
}

export default function AbsorbProductModal({
  open,
  product,
  onClose,
  onAbsorbed,
}: AbsorbProductModalProps) {
  const [parentProductId, setParentProductId] = useState("");
  const [parentOptions, setParentOptions] = useState<Product[]>([]);
  const [pendingTxnCount, setPendingTxnCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setParentProductId("");
    setError(null);
    setPendingTxnCount(null);

    fetchProducts()
      .then((rows) =>
        setParentOptions(
          rows.filter(
            (row) =>
              row.id !== product.id &&
              row.category === product.category,
          ),
        ),
      )
      .catch(() => setParentOptions([]));

    fetchProductTransactions(product.id, 1, 1, undefined, "pending")
      .then((response) => setPendingTxnCount(response.total))
      .catch(() => setPendingTxnCount(null));
  }, [open, product]);

  const selectedParent = useMemo(
    () => parentOptions.find((row) => String(row.id) === parentProductId) ?? null,
    [parentOptions, parentProductId],
  );

  const childCount = product.child_products?.length ?? 0;

  if (!open) return null;

  const handleSubmit = async () => {
    if (!parentProductId) {
      setError("Select a parent product.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await absorbProductIntoParent(product.id, Number(parentProductId));
      onAbsorbed(response.product.id);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to merge product into parent.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-1">Merge into Parent Product</h3>
        <p className="text-sm text-gray-600 mb-4">
          Convert this duplicate product into a child alias under a canonical parent.
          Stock, reservations, and order lines will move to the parent across all warehouses.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Source (will archive)</p>
              <p className="font-medium text-[#363b4c]">{getIdentifier(product)}</p>
              <p className="text-xs text-gray-500 mt-1">Becomes a child part number</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Parent (keeps stock)</p>
              <p className="font-medium text-[#363b4c]">
                {selectedParent ? getIdentifier(selectedParent) : "Not selected"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Canonical inventory owner</p>
            </div>
          </div>

          <div>
            <label className="label">
              <span className="label-text font-medium">Parent product</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={parentProductId}
              onChange={(e) => setParentProductId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select parent product…</option>
              {parentOptions.map((row) => (
                <option key={row.id} value={String(row.id)}>
                  {getIdentifier(row)} (ID {row.id})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
            <p>
              Category: <strong>{product.category}</strong> (source and parent must match)
            </p>
            {childCount > 0 && (
              <p>
                This product has <strong>{childCount}</strong> existing child product
                {childCount === 1 ? "" : "s"} that will be reparented.
              </p>
            )}
            {pendingTxnCount !== null && pendingTxnCount > 0 && (
              <p>
                <strong>{pendingTxnCount}</strong> pending transaction
                {pendingTxnCount === 1 ? "" : "s"} will be repointed to the new child alias.
              </p>
            )}
            {product.details.description && (
              <p className="text-amber-800">
                Description preserved: {product.details.description}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn bg-[#363b4c] text-white hover:bg-[#4a5063] border-0"
            onClick={handleSubmit}
            disabled={loading || !parentProductId}
          >
            {loading ? "Merging…" : "Merge into Parent"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/40" onClick={loading ? undefined : onClose} />
    </div>
  );
}
