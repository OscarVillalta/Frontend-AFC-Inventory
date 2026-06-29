import type { OrderTrackerStagePayload } from "../api/tracker";
import { syncCalendarForOrder } from "../api/calendar";
import { getStepsTemplate } from "./trackerSteps";

export interface CalendarOrderContext {
  orderId: number;
  orderNumber?: string | null;
  externalOrderNumber?: string | null;
  type: string;
  status: string;
  description?: string | null;
}

function formatTypeLabel(orderType: string): string {
  return (orderType || "order").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mergeTrackerStage(
  stages: OrderTrackerStagePayload[],
  updatedStage: OrderTrackerStagePayload,
): OrderTrackerStagePayload[] {
  const existingIndex = stages.findIndex((s) => s.stage_index === updatedStage.stage_index);
  if (existingIndex >= 0) {
    return stages.map((s) =>
      s.stage_index === updatedStage.stage_index ? updatedStage : s,
    );
  }
  return [...stages, updatedStage];
}

export function isTrackerFullyCompleted(
  stages: OrderTrackerStagePayload[],
  orderType: string,
): boolean {
  const template = getStepsTemplate(orderType);
  if (template.length === 0) return false;
  const stageMap = new Map(stages.map((s) => [s.stage_index, s]));
  return template.every((_, index) => stageMap.get(index)?.is_completed);
}

export function buildCalendarEventDescription(
  order: CalendarOrderContext,
  trackerStatus: string,
): string {
  const lines = [
    `Order: ${order.orderNumber || order.orderId}`,
    `Type: ${formatTypeLabel(order.type)}`,
    `Status: ${order.status}`,
    `Tracker: ${trackerStatus}`,
  ];

  if (order.externalOrderNumber) {
    lines.push(`External #: ${order.externalOrderNumber}`);
  }
  if (order.description) {
    lines.push(`Description: ${order.description}`);
  }

  if (typeof window !== "undefined") {
    lines.push(`Link: ${window.location.origin}/orders/${order.orderId}`);
  }

  return lines.join("\n");
}

/** Sync calendar when the tracker has just reached Completed. Best-effort. */
export async function syncCalendarWhenTrackerCompleted(
  order: CalendarOrderContext,
): Promise<void> {
  await syncCalendarForOrder(order.orderId, {
    description: buildCalendarEventDescription(order, "Completed"),
  });
}

export async function maybeSyncCalendarOnTrackerComplete(
  order: CalendarOrderContext,
  orderType: string,
  stages: OrderTrackerStagePayload[],
  updatedStage: OrderTrackerStagePayload,
): Promise<void> {
  if (!updatedStage.is_completed) return;

  const newStages = mergeTrackerStage(stages, updatedStage);
  if (!isTrackerFullyCompleted(newStages, orderType)) return;

  await syncCalendarWhenTrackerCompleted(order);
}
