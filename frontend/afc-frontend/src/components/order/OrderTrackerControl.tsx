import { useState } from "react";
import type { OrderWithTracking, OrderTrackerStagePayload } from "../../api/tracker";
import { useAuth } from "../../hooks/useAuth";
import {
  getStepsTemplate,
  getActionableStepIndex,
  getInlineStepAction,
} from "../../utils/trackerSteps";
import { toggleTrackerStep } from "../../utils/toggleTrackerStep";

interface Props {
  trackingData: OrderWithTracking | null;
  onRefresh: () => void;
}

function StepCircle({
  isCompleted,
  saving,
  onClick,
}: {
  isCompleted: boolean;
  saving: boolean;
  onClick?: () => void;
}) {
  const base = "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0 transition-all select-none";
  const interactive = onClick ? "cursor-pointer" : "cursor-default";
  if (saving)
    return (
      <div className={`${base} bg-gray-300 animate-pulse`} title="Saving…">
        ◌
      </div>
    );
  if (isCompleted)
    return (
      <div
        className={`${base} ${interactive} bg-green-500 ${onClick ? "hover:bg-green-600" : ""} shadow-sm`}
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
      className={`${base} ${interactive} bg-gray-200 ${onClick ? "hover:bg-blue-400 hover:text-white" : ""} text-gray-400`}
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

export default function OrderTrackerControl({ trackingData, onRefresh }: Props) {
  const { hasPermission, user } = useAuth();
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!trackingData) return null;

  const orderId = trackingData.order.id;
  const orderType = trackingData.order.type ?? "";
  const stages = trackingData.stages ?? [];
  const TRACKER_STEPS = getStepsTemplate(orderType);

  const stageMap = new Map<number, OrderTrackerStagePayload>(
    stages.map((s) => [s.stage_index, s])
  );

  const allCompleted = TRACKER_STEPS.every((_, i) => stageMap.get(i)?.is_completed);
  const actionableStepIndex = getActionableStepIndex(orderType, stages, hasPermission);
  const inlineAction = getInlineStepAction(orderType, stages, hasPermission);

  async function handleToggle(index: number) {
    if (!orderId || savingIndex !== null || actionableStepIndex !== index || !inlineAction) return;
    setSavingIndex(index);
    setError(null);
    try {
      const isCompleted = inlineAction.kind === "complete";
      await toggleTrackerStep({
        orderId,
        orderType,
        stages,
        tracker: trackingData!.tracker,
        stageIndex: index,
        isCompleted,
        userEmail: user?.email,
        hasPermission,
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle stage:", err);
      setError(err instanceof Error ? err.message : "Failed to update stage. Please try again.");
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-700">Order Tracker</h2>
        {allCompleted && (
          <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
            ✓ Tracking Complete
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      <div className="overflow-x-auto">
        <div className="flex items-start gap-0 min-w-max">
          {TRACKER_STEPS.map((step, i) => {
            const stage = stageMap.get(i);
            const isCompleted = stage?.is_completed ?? false;
            const saving = savingIndex === i;

            const timestamp = stage?.completed_at
              ? new Date(stage.completed_at).toLocaleString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                  hour: "numeric", minute: "2-digit",
                })
              : null;

            return (
              <div key={`${step.dept}-${i}`} className="flex items-start">
                <div className="flex flex-col items-center w-28">
                  <StepCircle
                    isCompleted={isCompleted}
                    saving={saving}
                    onClick={actionableStepIndex === i ? () => handleToggle(i) : undefined}
                  />
                  <span className="text-xs font-medium text-gray-700 mt-1 text-center leading-tight">
                    {step.label}
                  </span>
                  {timestamp && (
                    <span className="text-xs text-gray-400 text-center mt-0.5 leading-tight">
                      {timestamp}
                    </span>
                  )}
                  {stage?.completed_by && (
                    <span className="text-xs text-blue-500 text-center mt-0.5 italic leading-tight">
                      by {stage.completed_by}
                    </span>
                  )}
                </div>
                {i < TRACKER_STEPS.length - 1 && (
                  <div
                    className={`w-6 h-0.5 mt-3.5 shrink-0 ${
                      isCompleted ? "bg-green-400" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
