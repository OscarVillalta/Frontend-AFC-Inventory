import { apiRequest } from "./apiClient";

export interface User {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
}

export interface Role {
  id: number;
  name: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role_id: number;
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  role_id?: number;
}

export function fetchUsers(): Promise<User[]> {
  return apiRequest("/users");
}

export function fetchRoles(): Promise<Role[]> {
  return apiRequest("/roles");
}

export function createUser(data: CreateUserPayload): Promise<User> {
  return apiRequest("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateUser(id: number, data: UpdateUserPayload): Promise<User> {
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
