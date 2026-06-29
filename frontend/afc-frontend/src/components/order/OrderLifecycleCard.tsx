import { useState, useEffect } from "react";
import type { OrderWithTracking, OrderTrackerStagePayload } from "../../api/tracker";
import { patchOrderPaidInvoiced } from "../../api/tracker";
import { useAuth } from "../../hooks/useAuth";
import {
  getStepsTemplate,
  getFirstIncompleteIndex,
  getInlineStepAction,
  getActionableStepIndex,
} from "../../utils/trackerSteps";
import { toggleTrackerStep } from "../../utils/toggleTrackerStep";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type StepState = "completed" | "active" | "pending";

interface Props {
  trackingData: OrderWithTracking | null;
  createdAt: string;
  status: string;
  isPaid: boolean;
  isInvoiced: boolean;
  orderId: number;
  orderType: string;
  onRefresh: () => void;
}

// ─────────────────────────────────────────────
// Step icon
// ─────────────────────────────────────────────

function StepIcon({
  state,
  onClick,
  saving,
}: {
  state: StepState;
  onClick?: () => void;
  saving: boolean;
}) {
  const interactive = onClick ? "cursor-pointer" : "cursor-default";
  if (saving) {
    return (
      <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center shrink-0 animate-pulse" />
    );
  }
  if (state === "completed") {
    return (
      <div
        className={`w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shrink-0 ${interactive} ${onClick ? "hover:bg-green-600" : ""} transition-colors`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        title={onClick ? "Click to mark incomplete" : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      >
        <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div
        className={`relative w-9 h-9 flex items-center justify-center shrink-0 ${interactive}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        title={onClick ? "Click to mark complete" : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      >
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full border-2 border-blue-200 bg-blue-50" />
        {/* Blue circle outline */}
        <div className="absolute w-7 h-7 rounded-full border-2 border-blue-500 bg-white" />
        {/* Inner solid dot */}
        <div className="absolute w-3 h-3 rounded-full bg-blue-500" />
      </div>
    );
  }
  return (
    <div
      className={`w-7 h-7 rounded-full border-[3px] border-gray-300 bg-white shrink-0 ${onClick ? "cursor-pointer hover:border-blue-400" : ""} transition-colors`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={onClick ? "Click to mark complete" : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    />
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function OrderLifecycleCard({
  trackingData,
  createdAt,
  status,
  isPaid,
  isInvoiced,
  orderId,
  orderType,
  onRefresh,
}: Props) {
  const { hasPermission, user } = useAuth()
  const canMarkPaid = hasPermission("orders:mark_paid");
  const canMarkInvoiced = hasPermission("orders:mark_invoiced");
  const [paid, setPaid] = useState(isPaid);
  const [invoiced, setInvoiced] = useState(isInvoiced);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savingPaid, setSavingPaid] = useState(false);
  const [savingInvoiced, setSavingInvoiced] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Sync local state when props change (fixes bug where checkboxes appear unchecked after refresh)
  useEffect(() => { setPaid(isPaid); }, [isPaid]);
  useEffect(() => { setInvoiced(isInvoiced); }, [isInvoiced]);

  const TRACKER_STEPS = getStepsTemplate(orderType);

  const tracker = trackingData?.tracker ?? null;
  const stages = trackingData?.stages ?? [];

  const stageMap = new Map<number, OrderTrackerStagePayload>(
    stages.map((s) => [s.stage_index, s])
  );

  const firstIncompleteIndex = getFirstIncompleteIndex(stages, orderType);
  const allCompleted = firstIncompleteIndex === -1 && stages.some((s) => s.is_completed);
  const actionableStepIndex = getActionableStepIndex(orderType, stages, hasPermission);
  const inlineAction = getInlineStepAction(orderType, stages, hasPermission);

  const steps = TRACKER_STEPS.map((step, i) => {
    const stage = stageMap.get(i);
    const isStageCompleted = stage?.is_completed ?? false;

    let state: StepState;
    if (isStageCompleted) state = "completed";
    else if (i === firstIncompleteIndex) state = "active";
    else state = "pending";

    const timestamp = stage?.completed_at
      ? new Date(stage.completed_at).toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    return { ...step, number: i + 1, state, timestamp };
  });

  // Last updated at: use tracker updated_at, fall back to createdAt
  const lastUpdatedSource = tracker?.updated_at ?? createdAt;
  const lastUpdatedAt = lastUpdatedSource
    ? new Date(lastUpdatedSource).toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  async function handleToggle(index: number) {
    if (!orderId || savingIndex !== null || actionableStepIndex !== index || !inlineAction) return;
    setSavingIndex(index);
    setToggleError(null);
    try {
      const isCompleted = inlineAction.kind === "complete";
      await toggleTrackerStep({
        orderId,
        orderType,
        stages,
        tracker,
        stageIndex: index,
        isCompleted,
        userEmail: user?.email,
        hasPermission,
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle stage:", err);
      setToggleError(err instanceof Error ? err.message : "Failed to update stage. Please try again.");
    } finally {
      setSavingIndex(null);
    }
  }

  async function handlePaidChange(checked: boolean) {
    setPaid(checked);
    setSavingPaid(true);
    try {
      await patchOrderPaidInvoiced(orderId, { is_paid: checked });
      onRefresh();
    } catch (err) {
      console.error("Failed to update paid status:", err);
      setPaid(!checked);
    } finally {
      setSavingPaid(false);
    }
  }

  async function handleInvoicedChange(checked: boolean) {
    setInvoiced(checked);
    setSavingInvoiced(true);
    try {
      await patchOrderPaidInvoiced(orderId, { is_invoiced: checked });
      onRefresh();
    } catch (err) {
      console.error("Failed to update invoiced status:", err);
      setInvoiced(!checked);
    } finally {
      setSavingInvoiced(false);
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <h2 className="text-lg sm:text-xl font-extrabold text-gray-900">Progress Tracker</h2>
        {allCompleted && (
          <span className="text-sm font-semibold text-green-700 bg-green-100 border border-green-300 px-3 py-1 rounded-full">
            ✓ Tracking Complete
          </span>
        )}
      </div>

      {toggleError && (
        <p className="text-sm text-red-500 mb-3">{toggleError}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Column 1: Vertical lifecycle tracker ── */}
        <div>
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              {/* Icon + connector line */}
              <div className="flex flex-col items-center">
                <StepIcon
                  state={step.state}
                  onClick={actionableStepIndex === i ? () => handleToggle(i) : undefined}
                  saving={savingIndex === i}
                />
                {i < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-8 mt-0.5 ${
                      step.state === "completed" ? "bg-green-400" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>

              {/* Step label */}
              <div className="pb-1 pt-0.5">
                <p
                  className={`text-sm font-bold leading-tight ${
                    step.state === "completed"
                      ? "text-green-700"
                      : step.state === "active"
                      ? "text-blue-700"
                      : "text-gray-500"
                  }`}
                >
                  {step.number}. {step.label}
                </p>
                <p
                  className={`text-xs font-medium mt-0.5 ${
                    step.state === "completed"
                      ? "text-green-600"
                      : step.state === "active"
                      ? "text-blue-600"
                      : "text-gray-400"
                  }`}
                >
                  {step.state === "completed"
                    ? "Completed"
                    : step.state === "active"
                    ? "Action Required"
                    : "Pending"}
                </p>
                {step.timestamp && (
                  <p className="text-xs text-gray-400 mt-0.5">{step.timestamp}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Column 2: Last updated at ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last updated at</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{lastUpdatedAt}</p>
        </div>

        {/* ── Column 3: Category & checkboxes ── */}
        <div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{status}</p>
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <button
              disabled={savingInvoiced || !canMarkInvoiced}
              onClick={() => handleInvoicedChange(!invoiced)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                invoiced
                  ? "bg-green-500 text-white border-green-500 shadow-sm"
                  : "bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 hover:border-green-400"
              } ${!canMarkInvoiced ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {savingInvoiced ? "…" : invoiced ? "✓ INVOICED" : "INVOICED"}
            </button>
            <button
              disabled={savingPaid || !canMarkPaid}
              onClick={() => handlePaidChange(!paid)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                paid
                  ? "bg-green-500 text-white border-green-500 shadow-sm"
                  : "bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 hover:border-green-400"
              } ${!canMarkPaid ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {savingPaid ? "…" : paid ? "✓ PAID" : "PAID"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
