import { apiRequest } from "./apiClient";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Permission {
  id: number;
  name: string;
}

export interface RoleDetail {
  id: number;
  name: string;
  permissions: string[];
}

export interface CreateRolePayload {
  name: string;
  permissions: string[];
}

export interface UpdateRolePayload {
  name?: string;
  permissions?: string[];
}

/* ------------------------------------------------------------------ */
/*  API Functions                                                      */
/* ------------------------------------------------------------------ */

export function fetchPermissions(): Promise<Permission[]> {
  return apiRequest("/permissions");
}

export function createRole(data: CreateRolePayload): Promise<RoleDetail> {
  return apiRequest("/roles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateRole(id: number, data: UpdateRolePayload): Promise<RoleDetail> {
  return apiRequest(`/roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
