import { apiRequest } from "./apiClient";

export interface UserRecord {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: string;
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  role?: string;
}

export function fetchUsers(): Promise<UserRecord[]> {
  return apiRequest("/users");
}

export function fetchUser(id: number): Promise<UserRecord> {
  return apiRequest(`/users/${id}`);
}

export function createUser(data: CreateUserPayload): Promise<UserRecord> {
  return apiRequest("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateUser(
  id: number,
  data: UpdateUserPayload,
): Promise<UserRecord> {
  return apiRequest(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteUser(id: number): Promise<{ message: string }> {
  return apiRequest(`/users/${id}`, {
    method: "DELETE",
  });
}
