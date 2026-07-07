import { useState, useEffect, useCallback, useMemo } from "react";
import React from "react";
import { Link } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import {
  fetchPackingSlips,
  initOrderTracker,
  updateOrderTracker,
  patchOrderPaidInvoiced,
  type PackingSlipResult,
  type Department,
  type OrderTrackerPayload,
  type OrderHistoryPayload,
  type OrderTrackerStagePayload,
  type TrackerFilters,
} from "../api/tracker";
import DateSelection from "../components/DateSelection";
import FilterMultiSelect from "../components/FilterMultiSelect";
import PullFromQBModal from "../components/order/Table/PullFromQBModal";
import { ORDER_TYPE_LABELS } from "../constants/orderTypes";
import { useWarehouse } from "../hooks/useWarehouse";
import { useAuth } from "../hooks/useAuth";
import {
  TRACKER_FILTERS_STORAGE_KEY,
  usePersistedFilters,
} from "../hooks/usePersistedFilters";
import {
  getStepsTemplate,
  getInlineStepAction,
  canUserActOnStepIndex,
  getFirstIncompleteIndex,
  TRACKER_UPDATE_ANY,
  TRACKER_DEPARTMENT_FILTER_OPTIONS,
} from "../utils/trackerSteps";
import { toggleTrackerStep } from "../utils/toggleTrackerStep";
import { orderNumberSearchTerm } from "../utils/orderNumberSearch";
import { maybeSyncCalendarOnTrackerComplete } from "../utils/syncCalendarOnTrackerCompleted";
import { fetchCustomers, type Customer } from "../api/customers";
import { fetchSuppliers, type Supplier } from "../api/suppliers";

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  }
  if (typeof value === "string" && value.trim() !== "") return [value];
  return [];
}

const ORDER_TYPE_FILTER_OPTIONS = [
  { value: "installation", label: "Installation" },
  { value: "delivery", label: "Delivery" },
  { value: "shipment", label: "Shipment" },
  { value: "will_call", label: "Will Call" },
  { value: "incoming", label: "Purchase Order" },
  { value: "void", label: "Void" },
];

function partyFilterValue(kind: "customer" | "supplier", id: number): string {
  return `${kind}:${id}`;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PackingSlipRow = {
  id: number;
  packingSlipNo: string;
  customer: string;
  type: string;
  status: string;                    // order fulfillment status (Pending / Partially Fulfilled / Completed)
  stockState: string;                // "Reserved" | "Delivered"
  trackerStatus: string;             // derived from tracker step
  trackerDept: string;               // current department label for "IN X" badge
  lastUpdated: string;
  externalOrderNumber?: string | null;
  notes?: string;
  is_paid: boolean;
  is_invoiced: boolean;
  tracker: OrderTrackerPayload | null;
  history: OrderHistoryPayload[];
  stages: OrderTrackerStagePayload[];
};

type Step = {
  key: string;
  label: string;
  dept: Department;
  index: number;
  timestamp: string;
  performedBy: string;
  isCompleted: boolean;
};

// ─────────────────────────────────────────────
// Helper: dept → human label
// ─────────────────────────────────────────────

function deptLabel(dept: string): string {
  switch (dept) {
    case "SALES": return "Sales";
    case "LOGISTICS": return "Logistics";
    case "DELIVERY_DEPT": return "Delivery";
    case "SERVICE": return "Service";
    case "ACCOUNTING": return "Accounting";
    default: return dept;
  }
}

// ─────────────────────────────────────────────
// Helper: find the most recently completed stage
// ─────────────────────────────────────────────

function latestCompletedStage(stages: OrderTrackerStagePayload[]): OrderTrackerStagePayload | undefined {
  return stages
    .filter((s) => s.is_completed && s.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];
}

function deriveTrackerDeptLabel(orderType: string, stages: OrderTrackerStagePayload[]): string {
  const stepsTemplate = getStepsTemplate(orderType);
  if (stepsTemplate.length === 0) return "IN PROGRESS";

  const stageMap = new Map(stages.map((s) => [s.stage_index, s]));
  const firstIncompleteIdx = stepsTemplate.findIndex((_, i) => !stageMap.get(i)?.is_completed);
  const dept =
    firstIncompleteIdx >= 0
      ? stepsTemplate[firstIncompleteIdx].dept
      : stepsTemplate[0].dept;

  return `IN ${deptLabel(dept).toUpperCase()}`;
}

function deriveTrackerStatus(
  orderType: string,
  stages: OrderTrackerStagePayload[],
  options?: { isBackordered?: boolean }
): { trackerStatus: string; trackerDept: string } {
  const stepsTemplate = getStepsTemplate(orderType);
  const totalSteps = stepsTemplate.length;
  const completedCount = stages.filter((s) => s.is_completed).length;

  if (options?.isBackordered) {
    return { trackerStatus: "Backordered", trackerDept: "" };
  }
  if (totalSteps > 0 && completedCount >= totalSteps) {
    return { trackerStatus: "Completed", trackerDept: "" };
  }
  return {
    trackerStatus: "In Progress",
    trackerDept: deriveTrackerDeptLabel(orderType, stages),
  };
}

// ─────────────────────────────────────────────
// Helper: convert API result → PackingSlipRow
// ─────────────────────────────────────────────

function toPackingSlipRow(r: PackingSlipResult): PackingSlipRow {
  const stages = r.stages ?? [];
  const { trackerStatus, trackerDept } = deriveTrackerStatus(r.order_type ?? "", stages, {
    isBackordered: r.tracker?.is_backordered,
  });
  const stockState = r.status === "Completed" ? "Delivered" : "Reserved";

  // Use the most recent completed_at from stages, falling back to tracker updated_at
  const latestStage = latestCompletedStage(stages);
  const updated = latestStage?.completed_at ?? r.tracker?.updated_at ?? r.created_at;
  const lastUpdated = updated ? new Date(updated).toLocaleDateString() : "";

  return {
    id: r.id,
    packingSlipNo: r.order_number,
    customer: (r.order_type?.toLowerCase() === "incoming" ? r.supplier_name : r.customer_name) ?? "—",
    type: r.order_type ?? "—",
    status: r.status,
    stockState,
    trackerStatus,
    trackerDept,
    lastUpdated,
    externalOrderNumber: r.external_order_number ?? null,
    notes: r.description ?? undefined,
    is_paid: r.is_paid ?? false,
    is_invoiced: r.is_invoiced ?? false,
    tracker: r.tracker,
    history: r.history,
    stages,
  };
}

// ─────────────────────────────────────────────
// Helper: build stepper steps from a row
// ─────────────────────────────────────────────

export function buildSteps(row: PackingSlipRow): Step[] {
  const stepsTemplate = getStepsTemplate(row.type ?? "");
  const stageMap = new Map<number, OrderTrackerStagePayload>(
    (row.stages ?? []).map((s) => [s.stage_index, s])
  );

  return stepsTemplate.map((d, i) => {
    const stage = stageMap.get(i);
    const isCompleted = stage?.is_completed ?? false;

    const timestamp = stage?.completed_at
      ? new Date(stage.completed_at).toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      : "";
    const performedBy = stage?.completed_by ?? "";

    return {
      key: `${d.dept}-${i}`,
      label: d.label,
      dept: d.dept,
      index: i,
      timestamp,
      performedBy,
      isCompleted,
    };
  });
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StockStateBadge({ state }: { state: string }) {
  if (state === "Delivered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-600 text-white">
        ✓ Delivered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
      ◆ Reserved
    </span>
  );
}

function TrackerStatusBadge({ status, deptLabel: dept }: { status: string; deptLabel: string }) {
  if (status === "Completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold bg-green-100 text-green-700 uppercase tracking-wide">
        ✓ COMPLETED
      </span>
    );
  }
  if (status === "Backordered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 uppercase tracking-wide">
        ⚠ BACKORDERED
      </span>
    );
  }
  if (status === "In Progress" && dept) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 uppercase tracking-wide">
        ● {dept}
      </span>
    );
  }
  if (status === "In Progress") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 uppercase tracking-wide">
        ● IN PROGRESS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-500 uppercase tracking-wide">
      ● {status}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const t = type.toLowerCase();
  let cls = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-semibold ";
  if (t.includes("installation")) cls += "bg-blue-100 text-blue-700";
  else if (t.includes("delivery")) cls += "bg-teal-100 text-teal-700";
  else if (t.includes("shipment")) cls += "bg-cyan-100 text-cyan-700";
  else if (t.includes("will_call") || t.includes("will call")) cls += "bg-purple-100 text-purple-700";
  else if (t === "incoming") cls += "bg-orange-100 text-orange-700";
  else if (t === "void") cls += "bg-gray-100 text-gray-700";
  else cls += "bg-slate-100 text-slate-600";

  // Display "Purchase Order" for incoming orders; use canonical label otherwise
  let displayLabel: string;
  if (t === "incoming") {
    displayLabel = "Purchase Order";
  } else {
    displayLabel = ORDER_TYPE_LABELS[t as keyof typeof ORDER_TYPE_LABELS] ?? type;
  }

  return (
    <span className={cls}>
      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
      </svg>
      {displayLabel}
    </span>
  );
}

function StepCircle({
  isCompleted,
  saving,
  onClick,
}: {
  isCompleted: boolean;
  saving?: boolean;
  onClick?: () => void;
}) {
  const base = "w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 transition-all";
  const interactive = onClick ? "cursor-pointer select-none" : "";

  if (saving)
    return (
      <div className={`${base} bg-gray-300 animate-pulse text-white`} title="Saving…">
        ◌
      </div>
    );
  if (isCompleted)
    return (
      <div
        className={`${base} ${interactive} bg-green-500 hover:bg-green-600 text-white shadow-sm`}
        onClick={onClick}
        title={onClick ? "Click to mark incomplete" : undefined}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      >
        ✓
      </div>
    );
  return (
    <div
      className={`${base} ${interactive} bg-gray-200 hover:bg-blue-400 hover:text-white text-gray-400`}
      onClick={onClick}
      title={onClick ? "Click to mark complete" : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      ○
    </div>
  );
}

function ProgressStepper({
  steps,
  onToggleStep,
  savingIndex,
  canToggleStep,
}: {
  steps: Step[];
  onToggleStep?: (index: number) => void;
  savingIndex?: number | null;
  canToggleStep?: (index: number) => boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-start gap-0 min-w-max">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-start">
            <div className="flex flex-col items-center w-32">
              <StepCircle
                isCompleted={step.isCompleted}
                saving={savingIndex === step.index}
                onClick={
                  onToggleStep && canToggleStep?.(step.index)
                    ? () => onToggleStep(step.index)
                    : undefined
                }
              />
              <span className="text-xs font-semibold text-gray-700 mt-1 text-center">
                {step.label}
              </span>
              <span className="text-xs text-gray-500 text-center mt-0.5">
                {step.isCompleted ? "Completed" : "Pending"}
              </span>
              {step.timestamp && (
                <span className="text-xs text-gray-400 text-center mt-0.5">{step.timestamp}</span>
              )}
              {step.performedBy && (
                <span className="text-xs text-blue-500 text-center mt-0.5 italic">
                  by {step.performedBy}
                </span>
              )}
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mt-4 shrink-0 ${
                  step.isCompleted ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// QuickStepAction — inline complete/undo without expanding row
// ─────────────────────────────────────────────

function QuickStepAction({
  row,
  saving,
  onSavingChange,
  onStagesUpdate,
}: {
  row: PackingSlipRow;
  saving: boolean;
  onSavingChange: (orderId: number | null) => void;
  onStagesUpdate: (orderId: number, updatedStage: OrderTrackerStagePayload) => void;
}) {
  const { hasPermission, user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const action = getInlineStepAction(row.type, row.stages ?? [], hasPermission, {
    isVoid: row.type?.toLowerCase() === "void",
  });

  if (!action) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;
    onSavingChange(row.id);
    setError(null);
    try {
      const updated = await toggleTrackerStep({
        orderId: row.id,
        orderType: row.type,
        stages: row.stages ?? [],
        tracker: row.tracker,
        stageIndex: action.stageIndex,
        isCompleted: true,
        userEmail: user?.email,
        hasPermission,
      });
      onStagesUpdate(row.id, updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update step.");
    } finally {
      onSavingChange(null);
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        disabled={saving}
        onClick={handleClick}
        className="px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all border whitespace-nowrap bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "…" : `Complete ${action.label}`}
      </button>
      {error && <span className="text-[10px] text-red-600 max-w-[140px]">{error}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// PaidInvoicedToggle
// ─────────────────────────────────────────────

function PaidInvoicedToggle({
  orderId,
  isPaid,
  isInvoiced,
  field,
  onUpdate,
}: {
  orderId: number;
  isPaid: boolean;
  isInvoiced: boolean;
  field?: "is_paid" | "is_invoiced";
  onUpdate: (field: "is_paid" | "is_invoiced", value: boolean) => void;
}) {
  const {hasPermission} = useAuth()
  const canMarkPaid = hasPermission("orders:mark_paid");
  const canMarkInvoiced = hasPermission("orders:mark_invoiced");
  const [savingPaid, setSavingPaid] = useState(false);
  const [savingInvoiced, setSavingInvoiced] = useState(false);

  const toggle = async (f: "is_paid" | "is_invoiced", current: boolean) => {
    const setter = f === "is_paid" ? setSavingPaid : setSavingInvoiced;
    setter(true);
    try {
      await patchOrderPaidInvoiced(orderId, { [f]: !current });
      onUpdate(f, !current);
    } finally {
      setter(false);
    }
  };

  if (field === "is_paid") {
    return (
      <button
        disabled={savingPaid || !canMarkPaid}
        onClick={(e) => { e.stopPropagation(); toggle("is_paid", isPaid); }}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
          isPaid
            ? "bg-green-500 text-white border-green-500 shadow-sm"
            : "bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 hover:border-green-400"
        } ${!canMarkPaid ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {savingPaid ? "…" : isPaid ? "✓ PAID" : "PAID"}
      </button>
    );
  }

  if (field === "is_invoiced") {
    return (
      <button
        disabled={savingInvoiced || !canMarkInvoiced}
        onClick={(e) => { e.stopPropagation(); toggle("is_invoiced", isInvoiced); }}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
          isInvoiced
            ? "bg-green-500 text-white border-green-500 shadow-sm"
            : "bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 hover:border-green-400"
        } ${!canMarkInvoiced ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {savingInvoiced ? "…" : isInvoiced ? "✓ INVOICED" : "INVOICED"}
      </button>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        disabled={savingPaid}
        onClick={() => toggle("is_paid", isPaid)}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
          isPaid
            ? "bg-green-500 text-white border-green-500 shadow-sm"
            : "bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 hover:border-green-400"
        } ${!canMarkPaid ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {savingPaid ? "…" : isPaid ? "✓ PAID" : "PAID"}
      </button>
      <button
        disabled={savingInvoiced}
        onClick={() => toggle("is_invoiced", isInvoiced)}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
          isInvoiced
            ? "bg-green-500 text-white border-green-500 shadow-sm"
            : "bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 hover:border-green-400"
        } ${!canMarkInvoiced ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {savingInvoiced ? "…" : isInvoiced ? "✓ INVOICED" : "INVOICED"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────

type FilterTab = "All" | "In Progress" | "Completed" | "Backordered";

// ─────────────────────────────────────────────
// Expanded Detail Panel
// ─────────────────────────────────────────────

function ExpandedPanel({
  row,
  onStagesUpdate,
  onBackorderedUpdate,
}: {
  row: PackingSlipRow;
  onStagesUpdate: (orderId: number, updatedStage: OrderTrackerStagePayload) => void;
  onBackorderedUpdate: (orderId: number, isBackordered: boolean) => void;
}) {
  const { hasPermission, user } = useAuth();
  const canToggleBackorder = hasPermission("tracker:set_backordered") || hasPermission(TRACKER_UPDATE_ANY);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingBackordered, setSavingBackordered] = useState(false);
  const steps = buildSteps(row);

  const handleToggleStep = async (index: number) => {
    if (!canUserActOnStepIndex(row.type, index, hasPermission)) return;
    const step = steps.find((s) => s.index === index);
    if (!step) return;
    setSavingIndex(index);
    setSaveError(null);
    try {
      const updated = await toggleTrackerStep({
        orderId: row.id,
        orderType: row.type,
        stages: row.stages ?? [],
        tracker: row.tracker,
        stageIndex: index,
        isCompleted: !step.isCompleted,
        userEmail: user?.email,
        hasPermission,
      });
      onStagesUpdate(row.id, updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update step.");
    } finally {
      setSavingIndex(null);
    }
  };

  const handleToggleBackordered = async () => {
    setSavingBackordered(true);
    setSaveError(null);
    try {
      const newValue = !row.tracker?.is_backordered;
      if (!row.tracker) {
        const template = getStepsTemplate(row.type ?? "");
        await initOrderTracker(row.id, {
          current_department: template[0].dept,
          step_index: 0,
        });
      }
      await updateOrderTracker(row.id, { is_backordered: newValue });
      onBackorderedUpdate(row.id, newValue);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update backordered status.");
    } finally {
      setSavingBackordered(false);
    }
  };

  return (
    <tr>
      <td colSpan={10} className="p-0 border-b border-slate-200/60">
        <div className="bg-slate-50/60 mx-3 my-2 rounded-xl border border-slate-200/60 p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/orders/${row.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-base font-bold text-blue-700 hover:underline"
              >
                {row.packingSlipNo}
              </Link>
              <span className="text-slate-400">·</span>
              <span className="text-base font-semibold text-slate-600">{row.customer}</span>
              {row.externalOrderNumber && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Ext #</span>
                  <Link
                    to={`/orders/${row.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-semibold text-blue-700 hover:underline"
                  >
                    {row.externalOrderNumber}
                  </Link>
                </>
              )}
            </div>
            <button
              disabled={savingBackordered || !canToggleBackorder}
              onClick={(e) => { e.stopPropagation(); handleToggleBackordered(); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                row.tracker?.is_backordered
                  ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                  : "bg-white text-gray-500 border-gray-300 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-400"
              } ${!canToggleBackorder ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {savingBackordered ? "…" : row.tracker?.is_backordered ? "⚠ BACKORDERED" : "Set Backordered"}
            </button>
          </div>

          {/* Three-column layout */}
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── Left Section: Progress Tracker ── */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                {row.type?.toLowerCase() === "installation"
                  ? "6-Step Installation Path"
                  : row.type?.toLowerCase() === "incoming"
                  ? "3-Step Purchase Order Path"
                  : "4-Step Progress"}
              </p>

              <ProgressStepper
                steps={steps}
                onToggleStep={handleToggleStep}
                savingIndex={savingIndex}
                canToggleStep={(index) =>
                  canUserActOnStepIndex(row.type, index, hasPermission)
                }
              />

              {saveError && (
                <p className="mt-2 text-xs text-red-600">{saveError}</p>
              )}
            </div>

            {/* ── Right Section: Description/Notes ── */}
            {row.notes && (
              <>
                <div className="hidden lg:block w-px bg-slate-200 shrink-0" />
                <div className="lg:w-56 shrink-0">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-slate-600 break-words leading-relaxed">
                    {row.notes}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────

function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++)
      pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-200/70 text-sm">
      <span className="text-slate-500">
        {total === 0 ? "No results" : `${start}–${end} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                page === p
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────

function KpiCards({
  total,
  statusCounts,
}: {
  total: number;
  statusCounts: { "In Progress": number; Completed: number; Backordered: number };
}) {
  const cards = [
    { label: "Total Orders", value: total, color: "text-gray-800" },
    { label: "In Progress", value: statusCounts["In Progress"], color: "text-yellow-600" },
    { label: "Completed", value: statusCounts["Completed"], color: "text-green-600" },
    { label: "Backordered", value: statusCounts["Backordered"], color: "text-orange-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="stat bg-white rounded-xl shadow-sm border border-gray-100 p-4"
        >
          <div className="stat-title text-gray-500 text-sm">{c.label}</div>
          <div className={`stat-value text-2xl font-bold ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

const PAGE_SIZE = 100;

const DEFAULT_STATUS_COUNTS = { "In Progress": 0, Completed: 0, Backordered: 0 };

function normalizeStatusCounts(
  raw: Partial<Record<"Not Started" | "In Progress" | "Completed" | "Backordered", number>>
): typeof DEFAULT_STATUS_COUNTS {
  return {
    "In Progress": (raw["In Progress"] ?? 0) + (raw["Not Started"] ?? 0),
    Completed: raw.Completed ?? 0,
    Backordered: raw.Backordered ?? 0,
  };
}

export default function PackingSlipTrackerPage() {
  const { activeWarehouseId } = useWarehouse();
  const { hasPermission } = useAuth();

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savingStepOrderId, setSavingStepOrderId] = useState<number | null>(null);
  const [showPullQBModal, setShowPullQBModal] = useState(false);

  const [rows, setRows] = useState<PackingSlipRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState(DEFAULT_STATUS_COUNTS);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* ── Additional filter state ── */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // === FILTER STATES (PERSISTED) ===
  const [filters, setFilter] = usePersistedFilters(TRACKER_FILTERS_STORAGE_KEY, {
    page: 1,
    limit: 50,
    search: "",
    tracker_status: "",
    stock_state: "",
    tracker_department: [] as string[],
    order_type: [] as string[],
    party: [] as string[],
    start_date: "",
    end_date: "",
    dateFilterMode: "none" as "between" | "before" | "after" | "none",
    updated_start_date: "",
    updated_end_date: "",
    lastUpdatedMode: "none" as "between" | "before" | "after" | "none",
  });

  const selectedOrderTypes = asStringArray(filters.order_type);
  const selectedTrackerDepartments = asStringArray(filters.tracker_department);
  const selectedParties = asStringArray(filters.party);

  const partyFilterOptions = useMemo(
    () =>
      [
        ...customers.map((customer) => ({
          value: partyFilterValue("customer", customer.id),
          label: customer.name,
        })),
        ...suppliers.map((supplier) => ({
          value: partyFilterValue("supplier", supplier.id),
          label: `${supplier.name} (Supplier)`,
        })),
      ].sort((a, b) => a.label.localeCompare(b.label)),
    [customers, suppliers]
  );

  useEffect(() => {
    fetchCustomers().then(setCustomers).catch(() => setCustomers([]));
    fetchSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
  }, [activeWarehouseId]);

  useEffect(() => {
    if (filters.tracker_status === "Not Started") {
      setFilter("tracker_status", "In Progress");
    }
  }, []);

  // Debounce search to reduce API calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  const loadData = () => {
    setLoading(true);
    setFetchError(null);
    const apiFilters: TrackerFilters = {
      ...filters,
      order_type: selectedOrderTypes,
      tracker_department: selectedTrackerDepartments,
      party: selectedParties,
      search: filters.search ? orderNumberSearchTerm(filters.search) : filters.search,
    };
    Promise.resolve(
      fetchPackingSlips(apiFilters)
    ).then((resp) => {
      setRows(resp.results.map(toPackingSlipRow));
      setTotal(resp.total);
      setStatusCounts(normalizeStatusCounts(resp.status_counts));
      setLoading(false);
    })
  }

  useEffect(() => {
    loadData();
  }, [filters.page, filters.limit, filters.end_date, filters.updated_end_date, filters.updated_start_date, selectedOrderTypes.join(","), filters.search, filters.start_date, filters.tracker_status, filters.stock_state, selectedTrackerDepartments.join(","), selectedParties.join(","), activeWarehouseId]);

  // Reset page when search or tab changes
  const handleSearch = (v: string) => {
    setFilter("search", v);
    setFilter("page", 1)
  };

  const handlePullQBCreated = () => {
    setFilter("page", 1);
    loadData();
  };

  const handleTabChange = (tab: FilterTab) => {
    setFilter("tracker_status", tab);
    setFilter("page", 1)
  };

  // Optimistic update: update a stage in local state without a full reload
  const handleStagesUpdate = useCallback((orderId: number, updatedStage: OrderTrackerStagePayload) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== orderId) return row;

        const wasCompleted = row.trackerStatus === "Completed";

        // Update the stages array
        const existingIndex = row.stages.findIndex((s) => s.stage_index === updatedStage.stage_index);
        const newStages = existingIndex >= 0
          ? row.stages.map((s) => s.stage_index === updatedStage.stage_index ? updatedStage : s)
          : [...row.stages, updatedStage];

        const stepsTemplate = getStepsTemplate(row.type ?? "");
        const totalSteps = stepsTemplate.length;
        const completedCount = newStages.filter((s) => s.is_completed).length;

        // Clear backordered when a stage is toggled (mirrors backend behaviour)
        const firstIncompleteIdx = getFirstIncompleteIndex(newStages, row.type ?? "");
        let newTracker = row.tracker
          ? { ...row.tracker, is_backordered: false }
          : null;

        if (firstIncompleteIdx >= 0) {
          const dept = stepsTemplate[firstIncompleteIdx].dept;
          newTracker = {
            ...(newTracker ?? {
              id: 0,
              order_id: row.id,
              is_backordered: false,
              updated_at: new Date().toISOString(),
            }),
            current_department: dept,
            step_index: firstIncompleteIdx,
            is_backordered: false,
          };
        } else if (newTracker && totalSteps > 0) {
          newTracker = {
            ...newTracker,
            current_department: stepsTemplate[totalSteps - 1].dept,
            step_index: totalSteps - 1,
            is_backordered: false,
          };
        }

        const { trackerStatus, trackerDept } = deriveTrackerStatus(row.type ?? "", newStages, {
          isBackordered: newTracker?.is_backordered,
        });

        const latest = latestCompletedStage(newStages);
        const lastUpdated = latest?.completed_at
          ? new Date(latest.completed_at).toLocaleDateString()
          : row.lastUpdated;

        const isNowCompleted = completedCount >= totalSteps;
        if (!wasCompleted && isNowCompleted && updatedStage.is_completed) {
          void maybeSyncCalendarOnTrackerComplete(
            {
              orderId: row.id,
              orderNumber: row.packingSlipNo,
              externalOrderNumber: row.externalOrderNumber,
              type: row.type,
              status: row.status,
              description: row.notes,
            },
            row.type,
            row.stages,
            updatedStage,
          ).catch((err) => {
            console.error("Failed to sync calendar after tracker completion:", err);
          });
        }

        return {
          ...row,
          tracker: newTracker,
          stages: newStages,
          trackerStatus,
          trackerDept,
          lastUpdated,
        };
      })
    );
  }, []);

  // Optimistic update for backordered toggle
  const handleBackorderedUpdate = useCallback((orderId: number, isBackordered: boolean) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== orderId) return row;
        const newTracker = row.tracker ? { ...row.tracker, is_backordered: isBackordered } : row.tracker;

        const { trackerStatus, trackerDept } = deriveTrackerStatus(row.type ?? "", row.stages, {
          isBackordered,
        });
        return { ...row, tracker: newTracker, trackerStatus, trackerDept };
      })
    );
  }, []);

  // Optimistic update for paid/invoiced toggles
  const handlePaidInvoicedUpdate = useCallback(
    (orderId: number, field: "is_paid" | "is_invoiced", value: boolean) => {
      setRows((prev) =>
        prev.map((row) =>
          row.id === orderId ? { ...row, [field]: value } : row
        )
      );
    },
    []
  );

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const allCount =
    (statusCounts["In Progress"] ?? 0) +
    (statusCounts["Completed"] ?? 0) +
    (statusCounts["Backordered"] ?? 0);

  /* ── Server-side filters; rows match current page from API ── */
  const hasActiveFilters =
    selectedOrderTypes.length > 0 ||
    selectedParties.length > 0 ||
    filters.stock_state !== "" ||
    filters.search !== "" ||
    (filters.tracker_status !== "" && filters.tracker_status !== "All") ||
    selectedTrackerDepartments.length > 0;

  const handleClearFilters = () => {
    setFilter("order_type", []);
    setFilter("party", []);
    setFilter("search", "");
    setFilter("tracker_status", "");
    setFilter("stock_state", "");
    setFilter("tracker_department", []);
  };

  const STATUS_TABS: FilterTab[] = ["All", "In Progress", "Completed", "Backordered"];
  const statusTabCounts: Record<FilterTab, number> = {
    All: allCount,
    "In Progress": statusCounts["In Progress"] ?? 0,
    Completed: statusCounts["Completed"] ?? 0,
    Backordered: statusCounts["Backordered"] ?? 0,
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── Page Header ─────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Packing Slip Tracker</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Track shipment progress through each checkpoint
            </p>
          </div>
          {hasPermission("qb:pull_orders") && (
            <button
              type="button"
              className="
                inline-flex items-center rounded-lg px-5 py-2.5
                text-sm font-semibold text-white shadow-md transition
                hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0
              "
              style={{
                background: "linear-gradient(90deg, #2B8A3E 0%, #237032 100%)",
              }}
              onClick={() => setShowPullQBModal(true)}
            >
              Pull From QB
            </button>
          )}
        </div>

        {/* ── Global Filter Bar (Inventory.tsx style) ─── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">

          {/* Search */}
          <div className="flex flex-col gap-0.5 min-w-[160px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Search</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
                <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Slip # or ext #…"
                className="border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
              />
            </div>
          </div>

          {/* Customer / Supplier */}
          <FilterMultiSelect
            label="Customer / Supplier"
            placeholder="All Customers & Suppliers"
            options={partyFilterOptions}
            selected={selectedParties}
            searchable
            searchPlaceholder="Search customers & suppliers…"
            onChange={(values) => {
              setFilter("party", values);
              setFilter("page", 1);
            }}
          />

          {/* Order Type */}
          <FilterMultiSelect
            label="Order Type"
            placeholder="All Types"
            options={ORDER_TYPE_FILTER_OPTIONS}
            selected={selectedOrderTypes}
            onChange={(values) => {
              setFilter("order_type", values);
              setFilter("page", 1);
            }}
          />

          {/* Tracker State (department) */}
          <FilterMultiSelect
            label="Tracker State"
            placeholder="All States"
            options={TRACKER_DEPARTMENT_FILTER_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            selected={selectedTrackerDepartments}
            onChange={(values) => {
              setFilter("tracker_department", values);
              setFilter("page", 1);
            }}
          />

          {/* Stock State */}
          <div className="flex flex-col gap-0.5 min-w-[140px]">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Stock State</label>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={filters.stock_state}
              onChange={(e) => { setFilter("stock_state", e.target.value); setFilter("page", 1); }}
            >
              <option value="">All States</option>
              <option value="Reserved">Reserved</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
          {/* Created dated */}
          <div className="min-w-[140px]">
            <DateSelection
            label="Created Date"
            setFilter={setFilter}
            filters={filters}
            startdateKey="start_date"
            enddatekey="end_date"
            datemodekey="dateFiltermode"/>
          </div>

          {/* last updated date */}
          <div className="min-w-[140px]">
            <DateSelection
            label="Last Update Date"
            setFilter={setFilter}
            filters={filters}
            startdateKey="updated_start_date"
            enddatekey="updated_end_date"
            datemodekey="lastUpdatedMode"/>
          </div>
          {/* Clear All */}
          <div className="flex items-center ml-auto">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* ── Quick-Filter Status Pills ──────────────── */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter("tracker_status", tab)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                filters.tracker_status === tab
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab}{" "}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                  filters.tracker_status === tab
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {statusTabCounts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* ── KPI Cards ───────────────────────────── */}
        <KpiCards total={allCount} statusCounts={statusCounts} />

        {/* ── Table Card ──────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-3 sm:p-4">

          {fetchError && (
            <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {/* Table scroll wrapper */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-separate border-spacing-0 text-xs">
              <colgroup>
                <col className="w-32" />
                <col className="w-28" />
                <col className="w-56" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-36" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-10" />
              </colgroup>
              <thead>
                <tr>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60 rounded-tl-xl">
                    Packing Slip #
                  </th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    External Order #
                  </th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Company
                  </th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Type
                  </th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Stock State
                  </th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Tracker Status
                  </th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    <span className="inline-flex items-center gap-1">
                      Last Updated
                    </span>
                  </th>
                  <th className="px-3 py-1.5 text-center text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Paid
                  </th>
                  <th className="px-3 py-1.5 text-center text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200/70 border-r border-slate-200/60">
                    Invoiced
                  </th>
                  <th className="px-3 py-1.5 bg-slate-50 border-b border-slate-200/70 rounded-tr-xl w-10" />
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No records found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((row, rowIndex) => (
                    <React.Fragment key={row.id}>
                      <tr
                        role="button"
                        tabIndex={0}
                        className={`cursor-pointer transition-colors ${
                          expandedId === row.id
                            ? "bg-blue-50/60"
                            : rowIndex % 2 === 0
                            ? "bg-white hover:bg-slate-100/60"
                            : "bg-slate-50/40 hover:bg-slate-100/60"
                        }`}
                        onClick={() => toggleExpand(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpand(row.id);
                          }
                        }}
                      >
                        <td className="px-3 py-1.5 border-b border-slate-200/60 border-r border-slate-200/50">
                          <Link
                            to={`/orders/${row.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-blue-700 hover:underline"
                          >
                            {row.packingSlipNo}
                          </Link>
                        </td>
                        {/* External Order # */}
                        <td className="px-3 py-1.5 border-b border-slate-200/60 border-r border-slate-200/50">
                          {row.externalOrderNumber ? (
                            <Link
                              to={`/orders/${row.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-blue-700 hover:underline text-xs"
                            >
                              {row.externalOrderNumber}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-200/60 border-r border-slate-200/50 font-medium text-slate-800">
                          <span className="truncate block" title={row.customer}>
                            {row.customer}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-200/60 border-r border-slate-200/50">
                          <TypePill type={row.type} />
                        </td>
                        {/* Stock State */}
                        <td className="px-3 py-1.5 border-b border-slate-200/60 border-r border-slate-200/50">
                          <StockStateBadge state={row.stockState} />
                        </td>
                        {/* Tracker Status */}
                        <td className="px-3 py-1.5 border-b border-slate-200/60 border-r border-slate-200/50">
                          <div className="flex flex-col gap-1 items-start">
                            <TrackerStatusBadge
                              status={row.trackerStatus}
                              deptLabel={row.trackerDept}
                            />
                            <QuickStepAction
                              row={row}
                              saving={savingStepOrderId === row.id}
                              onSavingChange={setSavingStepOrderId}
                              onStagesUpdate={handleStagesUpdate}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-200/60 border-r border-slate-200/50 text-slate-700 font-medium">
                          {row.lastUpdated}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-200/60 border-r border-slate-200/50 text-center">
                          <PaidInvoicedToggle
                            orderId={row.id}
                            isPaid={row.is_paid}
                            isInvoiced={row.is_invoiced}
                            field="is_paid"
                            onUpdate={(field, value) => handlePaidInvoicedUpdate(row.id, field, value)}
                          />
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-200/60 border-r border-slate-200/50 text-center">
                          <PaidInvoicedToggle
                            orderId={row.id}
                            isPaid={row.is_paid}
                            isInvoiced={row.is_invoiced}
                            field="is_invoiced"
                            onUpdate={(field, value) => handlePaidInvoicedUpdate(row.id, field, value)}
                          />
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-200/60 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(row.id);
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors mx-auto"
                            aria-label={expandedId === row.id ? "Collapse" : "Expand"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {expandedId === row.id ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              )}
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {expandedId === row.id && (
                        <ExpandedPanel
                          row={row}
                          onStagesUpdate={handleStagesUpdate}
                          onBackorderedUpdate={handleBackorderedUpdate}
                        />
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            total={total}
            page={filters.page}
            pageSize={PAGE_SIZE}
            onPageChange={(v) => {setFilter("page", v)}}
          />
        </div>

      </div>

      <PullFromQBModal
        open={showPullQBModal}
        onClose={() => setShowPullQBModal(false)}
        onCreated={handlePullQBCreated}
      />
    </MainLayout>
  );
}
