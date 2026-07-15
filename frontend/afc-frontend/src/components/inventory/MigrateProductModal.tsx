import { useEffect, useMemo, useState } from "react";
import type { ChildProductSummary, ProductDetail, ProductMigrateTargetType } from "../../api/productDetail";
import { migrateProduct } from "../../api/productDetail";
import { fetchAirFilterCategories } from "../../api/airfilters";
import { fetchStockItemCategories } from "../../api/stockItems";
import { fetchMediaCategories } from "../../api/media";

interface MigrateProductModalProps {
  open: boolean;
  product: ProductDetail;
  onClose: () => void;
  onMigrated: (product: ProductDetail) => void;
}

const TARGET_LABELS: Record<ProductMigrateTargetType, string> = {
  air_filters: "Air Filter",
  stock_items: "Stock Item",
  media: "Media",
};

const CATEGORY_TO_TARGET: Record<string, ProductMigrateTargetType> = {
  "Air Filters": "air_filters",
  "Stock Items": "stock_items",
  "Media Items": "media",
};

function getIdentifier(product: ProductDetail): string {
  return product.details.part_number ?? product.details.name ?? "";
}

function getChildIdentifier(child: ChildProductSummary): string {
  return child.details.part_number ?? child.details.name ?? "";
}

export default function MigrateProductModal({
  open,
  product,
  onClose,
  onMigrated,
}: MigrateProductModalProps) {
  const sourceTarget = CATEGORY_TO_TARGET[product.category] ?? null;
  const targetOptions = (["air_filters", "stock_items", "media"] as ProductMigrateTargetType[]).filter(
    (type) => type !== sourceTarget,
  );

  const [targetType, setTargetType] = useState<ProductMigrateTargetType>(targetOptions[0] ?? "air_filters");
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [identifier, setIdentifier] = useState(getIdentifier(product));
  const [description, setDescription] = useState(product.details.description ?? "");
  const [mervRating, setMervRating] = useState(product.details.merv_rating ?? 0);
  const [height, setHeight] = useState(product.details.height ?? 0);
  const [width, setWidth] = useState(product.details.width ?? 0);
  const [depth, setDepth] = useState(product.details.depth ?? 0);
  const [length, setLength] = useState<number | "">("");
  const [mediaWidth, setMediaWidth] = useState<number | "">("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [childFields, setChildFields] = useState<Record<number, {
    identifier: string;
    description: string;
    merv_rating: number;
    height: number;
    width: number;
    depth: number;
  }>>({});
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTargetType(targetOptions[0] ?? "air_filters");
    setTargetCategoryId("");
    setIdentifier(getIdentifier(product));
    setDescription(product.details.description ?? "");
    setMervRating(product.details.merv_rating ?? 0);
    setHeight(product.details.height ?? 0);
    setWidth(product.details.width ?? 0);
    setDepth(product.details.depth ?? 0);
    setLength("");
    setMediaWidth("");
    setUnitOfMeasure("");
    setError(null);
    setChildFields(
      Object.fromEntries(
        (product.child_products ?? []).map((child) => [
          child.id,
          {
            identifier: getChildIdentifier(child),
            description: child.details.description ?? "",
            merv_rating: child.details.merv_rating ?? 0,
            height: child.details.height ?? 0,
            width: child.details.width ?? 0,
            depth: child.details.depth ?? 0,
          },
        ]),
      ),
    );
  }, [open, product]);

  useEffect(() => {
    if (!open) return;
    const loader =
      targetType === "air_filters"
        ? fetchAirFilterCategories
        : targetType === "stock_items"
          ? fetchStockItemCategories
          : fetchMediaCategories;
    loader()
      .then((rows) => setCategories(rows))
      .catch(() => setCategories([]));
    setTargetCategoryId("");
  }, [open, targetType]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ label: c.name, value: String(c.id) })),
    [categories],
  );

  if (!open || !sourceTarget) return null;

  async function handleSubmit() {
    if (!targetCategoryId) {
      setError("Select a target category.");
      return;
    }

    setLoading(true);
    setError(null);

    const overrides: Record<string, string | number | null> = {
      description: description || null,
    };

    if (targetType === "stock_items") {
      overrides.name = identifier;
    } else {
      overrides.part_number = identifier;
    }

    if (targetType === "air_filters") {
      overrides.merv_rating = mervRating;
      overrides.height = height;
      overrides.width = width;
      overrides.depth = depth;
    }

    if (targetType === "media") {
      if (length !== "") overrides.length = length;
      if (mediaWidth !== "") overrides.width = mediaWidth;
      if (unitOfMeasure) overrides.unit_of_measure = unitOfMeasure;
    }

    const child_overrides: Record<string, Record<string, string | number | null>> = {};
    for (const [childId, fields] of Object.entries(childFields)) {
      const childOverride: Record<string, string | number | null> = {
        description: fields.description || null,
      };
      if (targetType === "stock_items") {
        childOverride.name = fields.identifier;
      } else {
        childOverride.part_number = fields.identifier;
      }
      if (targetType === "air_filters") {
        childOverride.merv_rating = fields.merv_rating;
        childOverride.height = fields.height;
        childOverride.width = fields.width;
        childOverride.depth = fields.depth;
      }
      child_overrides[childId] = childOverride;
    }

    try {
      const result = await migrateProduct(product.id, {
        target_type: targetType,
        target_category_id: Number(targetCategoryId),
        overrides,
        child_overrides: Object.keys(child_overrides).length ? child_overrides : undefined,
      });
      onMigrated(result.product);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Migration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg">Migrate Catalog Type</h3>
        <p className="text-sm text-gray-500 mt-1">
          Move this product from {product.category} to another catalog type. Quantities and transaction history are preserved across all warehouses.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label">
              <span className="label-text font-semibold">Target Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as ProductMigrateTargetType)}
              disabled={loading}
            >
              {targetOptions.map((type) => (
                <option key={type} value={type}>
                  {TARGET_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">
              <span className="label-text font-semibold">Target Category</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={targetCategoryId}
              onChange={(e) => setTargetCategoryId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select category…</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">
                <span className="label-text font-semibold">
                  {targetType === "stock_items" ? "Name" : "Part Number"}
                </span>
              </label>
              <input
                className="input input-bordered w-full"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">
                <span className="label-text font-semibold">Description</span>
              </label>
              <input
                className="input input-bordered w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {targetType === "air_filters" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label"><span className="label-text">MERV</span></label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={mervRating}
                  onChange={(e) => setMervRating(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label"><span className="label-text">Height</span></label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label"><span className="label-text">Width</span></label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label"><span className="label-text">Depth</span></label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {targetType === "media" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label"><span className="label-text">Length</span></label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={length}
                  onChange={(e) => setLength(e.target.value === "" ? "" : Number(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label"><span className="label-text">Width</span></label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={mediaWidth}
                  onChange={(e) => setMediaWidth(e.target.value === "" ? "" : Number(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label"><span className="label-text">Unit</span></label>
                <input
                  className="input input-bordered w-full"
                  value={unitOfMeasure}
                  onChange={(e) => setUnitOfMeasure(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {(product.child_products?.length ?? 0) > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Child Product Overrides</p>
              {product.child_products!.map((child) => {
                const fields = childFields[child.id];
                if (!fields) return null;
                return (
                  <div key={child.id} className="bg-gray-50 rounded p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500">Child #{child.id}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        className="input input-bordered input-sm w-full"
                        value={fields.identifier}
                        onChange={(e) =>
                          setChildFields((prev) => ({
                            ...prev,
                            [child.id]: { ...prev[child.id], identifier: e.target.value },
                          }))
                        }
                        placeholder={targetType === "stock_items" ? "Name" : "Part Number"}
                        disabled={loading}
                      />
                      <input
                        className="input input-bordered input-sm w-full"
                        value={fields.description}
                        onChange={(e) =>
                          setChildFields((prev) => ({
                            ...prev,
                            [child.id]: { ...prev[child.id], description: e.target.value },
                          }))
                        }
                        placeholder="Description"
                        disabled={loading}
                      />
                    </div>
                    {targetType === "air_filters" && (
                      <div className="grid grid-cols-4 gap-2">
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          value={fields.merv_rating}
                          onChange={(e) =>
                            setChildFields((prev) => ({
                              ...prev,
                              [child.id]: { ...prev[child.id], merv_rating: Number(e.target.value) },
                            }))
                          }
                          placeholder="MERV"
                          disabled={loading}
                        />
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          value={fields.height}
                          onChange={(e) =>
                            setChildFields((prev) => ({
                              ...prev,
                              [child.id]: { ...prev[child.id], height: Number(e.target.value) },
                            }))
                          }
                          placeholder="H"
                          disabled={loading}
                        />
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          value={fields.width}
                          onChange={(e) =>
                            setChildFields((prev) => ({
                              ...prev,
                              [child.id]: { ...prev[child.id], width: Number(e.target.value) },
                            }))
                          }
                          placeholder="W"
                          disabled={loading}
                        />
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          value={fields.depth}
                          onChange={(e) =>
                            setChildFields((prev) => ({
                              ...prev,
                              [child.id]: { ...prev[child.id], depth: Number(e.target.value) },
                            }))
                          }
                          placeholder="D"
                          disabled={loading}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Migrating…" : "Migrate Product"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/40" onClick={loading ? undefined : onClose} />
    </div>
  );
}
