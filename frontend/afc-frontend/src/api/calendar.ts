import { apiRequest } from "./apiClient";

export interface SyncCalendarPayload {
  description?: string;
  title?: string;
  starts_at?: string;
  ends_at?: string;
  all_day?: boolean;
}

export function syncCalendarForOrder(
  orderId: number,
  payload?: SyncCalendarPayload,
) {
  return apiRequest(`/calendar/order/${orderId}/sync`, {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined,
  });
}