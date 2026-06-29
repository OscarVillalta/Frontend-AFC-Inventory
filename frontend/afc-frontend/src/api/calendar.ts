import { apiRequest } from "./apiClient";

export function syncCalendarForOrder(orderId: number) {
  return apiRequest(`/calendar/order/${orderId}/sync`, {
    method: "POST",
  });
}
