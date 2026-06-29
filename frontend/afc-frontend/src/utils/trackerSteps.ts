import type { Department, OrderTrackerStagePayload } from "../api/tracker";

export type TrackerStepTemplate = { dept: Department; label: string };

/** 6-step path used exclusively for Installation orders. */
export const INSTALLATION_STEPS: TrackerStepTemplate[] = [
  { dept: "SALES", label: "Sales" },
  { dept: "LOGISTICS", label: "Logistics" },
  { dept: "DELIVERY_DEPT", label: "Delivery" },
  { dept: "SERVICE", label: "Service" },
  { dept: "SALES", label: "Sales II" },
  { dept: "LOGISTICS", label: "Logistics II" },
];

/** 4-step path used for Will Call, Delivery, and Shipment orders. */
export const WILL_CALL_STEPS: TrackerStepTemplate[] = [
  { dept: "SALES", label: "Sales" },
  { dept: "LOGISTICS", label: "Logistics" },
  { dept: "DELIVERY_DEPT", label: "Delivery" },
  { dept: "LOGISTICS", label: "Logistics II" },
];

/** 3-step path used for Purchase Order (incoming) orders. */
export const PURCHASE_ORDER_STEPS: TrackerStepTemplate[] = [
  { dept: "LOGISTICS", label: "Logistics" },
  { dept: "DELIVERY_DEPT", label: "Delivery" },
  { dept: "LOGISTICS", label: "Logistics II" },
];

export const DEPARTMENT_PERMISSION: Record<Department, string> = {
  SALES: "tracker:update_sales",
  LOGISTICS: "tracker:update_logistics",
  DELIVERY_DEPT: "tracker:update_delivery",
  SERVICE: "tracker:update_service",
  ACCOUNTING: "tracker:update_accounting",
};

export const TRACKER_UPDATE_ANY = "tracker:update_any"

/** Department options for the Tracker State filter dropdown. */
export const TRACKER_DEPARTMENT_FILTER_OPTIONS: {
  value: Department;
  label: string;
}[] = [
  { value: "SALES", label: "Sales" },
  { value: "LOGISTICS", label: "Logistics" },
  { value: "DELIVERY_DEPT", label: "Delivery" },
  { value: "SERVICE", label: "Service" },
];

/** Returns the correct step template for the given order type string. */
export function getStepsTemplate(orderType: string): TrackerStepTemplate[] {
  const t = orderType?.toLowerCase();
  if (t === "installation") return INSTALLATION_STEPS;
  if (t === "incoming") return PURCHASE_ORDER_STEPS;
  return WILL_CALL_STEPS;
}

export function buildStageMap(
  stages: OrderTrackerStagePayload[]
): Map<number, OrderTrackerStagePayload> {
  return new Map(stages.map((s) => [s.stage_index, s]));
}

export function isStageCompleted(
  stages: OrderTrackerStagePayload[],
  stageIndex: number
): boolean {
  return buildStageMap(stages).get(stageIndex)?.is_completed ?? false;
}

/** Index of the earliest incomplete step, or -1 when all steps are complete. */
export function getFirstIncompleteIndex(
  stages: OrderTrackerStagePayload[],
  orderType: string
): number {
  const template = getStepsTemplate(orderType);
  const stageMap = buildStageMap(stages);
  return template.findIndex((_, i) => !stageMap.get(i)?.is_completed);
}

/** Index of the latest completed step in sequence, or -1 when none are complete. */
export function getLastCompletedIndex(
  stages: OrderTrackerStagePayload[],
  orderType: string
): number {
  const template = getStepsTemplate(orderType);
  const stageMap = buildStageMap(stages);
  for (let i = template.length - 1; i >= 0; i--) {
    if (stageMap.get(i)?.is_completed) return i;
  }
  return -1;
}

export function getDepartmentForStageIndex(
  orderType: string,
  stageIndex: number
): Department | undefined {
  return getStepsTemplate(orderType)[stageIndex]?.dept;
}

export function getStepLabel(orderType: string, stageIndex: number): string {
  return getStepsTemplate(orderType)[stageIndex]?.label ?? "Step";
}

export function getRequiredPermission(dept: Department): string {
  return DEPARTMENT_PERMISSION[dept];
}

export function canUserActOnDepartment(
  hasPermission: (permission: string) => boolean,
  dept: Department
): boolean {
  return hasPermission(TRACKER_UPDATE_ANY) || hasPermission(getRequiredPermission(dept));
}

export type InlineStepAction = {
  kind: "complete" | "undo";
  stageIndex: number;
  label: string;
  dept: Department;
};

export function getInlineStepAction(
  orderType: string,
  stages: OrderTrackerStagePayload[],
  hasPermission: (permission: string) => boolean,
  options?: { isVoid?: boolean }
): InlineStepAction | null {
  if (options?.isVoid || orderType?.toLowerCase() === "void") return null;

  const template = getStepsTemplate(orderType);
  if (template.length === 0) return null;

  const firstIncomplete = getFirstIncompleteIndex(stages, orderType);

  if (firstIncomplete >= 0) {
    const step = template[firstIncomplete];
    if (!canUserActOnDepartment(hasPermission, step.dept)) return null;
    return {
      kind: "complete",
      stageIndex: firstIncomplete,
      label: step.label,
      dept: step.dept,
    };
  }

  const lastCompleted = getLastCompletedIndex(stages, orderType);
  if (lastCompleted < 0) return null;

  const step = template[lastCompleted];
  if (!canUserActOnDepartment(hasPermission, step.dept)) return null;
  return {
    kind: "undo",
    stageIndex: lastCompleted,
    label: step.label,
    dept: step.dept,
  };
}

/** Single step index the user may toggle in the stepper UI, or null if none. */
export function getActionableStepIndex(
  orderType: string,
  stages: OrderTrackerStagePayload[],
  hasPermission: (permission: string) => boolean,
  options?: { isVoid?: boolean }
): number | null {
  const action = getInlineStepAction(orderType, stages, hasPermission, options);
  return action?.stageIndex ?? null;
}
