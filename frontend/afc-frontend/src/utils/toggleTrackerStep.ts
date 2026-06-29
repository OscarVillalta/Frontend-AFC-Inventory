import {
  initOrderTracker,
  toggleTrackerStage,
  type Department,
  type OrderTrackerPayload,
  type OrderTrackerStagePayload,
} from "../api/tracker";
import {
  getDepartmentForStageIndex,
  getFirstIncompleteIndex,
  getLastCompletedIndex,
  getStepsTemplate,
  canUserActOnDepartment,
} from "./trackerSteps";

export interface ToggleTrackerStepParams {
  orderId: number;
  orderType: string;
  stages: OrderTrackerStagePayload[];
  tracker: OrderTrackerPayload | null;
  stageIndex: number;
  isCompleted: boolean;
  userEmail?: string | null;
  hasPermission: (permission: string) => boolean;
}

export async function toggleTrackerStep({
  orderId,
  orderType,
  stages,
  tracker,
  stageIndex,
  isCompleted,
  userEmail,
  hasPermission,
}: ToggleTrackerStepParams): Promise<OrderTrackerStagePayload> {
  const department = getDepartmentForStageIndex(orderType, stageIndex);
  if (!department) {
    throw new Error("Invalid step for this order type.");
  }

  if (!canUserActOnDepartment(hasPermission, department)) {
    throw new Error("You do not have the permissions to complete this department's step.");
  }

  const firstIncomplete = getFirstIncompleteIndex(stages, orderType);
  const lastCompleted = getLastCompletedIndex(stages, orderType);

  if (isCompleted && stageIndex !== firstIncomplete) {
    throw new Error("Steps must be completed in order.");
  }
  if (!isCompleted && stageIndex !== lastCompleted) {
    throw new Error("Only the most recently completed step can be undone.");
  }

  if (!tracker) {
    const template = getStepsTemplate(orderType);
    await initOrderTracker(orderId, {
      current_department: template[0].dept,
      step_index: 0,
    });
  }

  return toggleTrackerStage(orderId, stageIndex, {
    is_completed: isCompleted,
    department,
    completed_by: isCompleted ? userEmail ?? undefined : undefined,
  });
}
