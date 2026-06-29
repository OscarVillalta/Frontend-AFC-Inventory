import { fetchOrderTracking } from "../api/tracker";
import { toggleTrackerStep } from "./toggleTrackerStep";

export async function completeFirstTrackerStepOnCreate(
  orderId: number,
  orderType: string,
  userEmail: string | undefined,
  hasPermission: (permission: string) => boolean,
): Promise<void> {
  if (orderType?.toLowerCase() === "void") return;

  const tracking = await fetchOrderTracking(orderId);
  const resolvedType = tracking.order.type ?? orderType;

  await toggleTrackerStep({
    orderId,
    orderType: resolvedType,
    stages: tracking.stages,
    tracker: tracking.tracker,
    stageIndex: 0,
    isCompleted: true,
    userEmail,
    hasPermission,
  });
}
