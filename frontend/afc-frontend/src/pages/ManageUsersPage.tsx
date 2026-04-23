import { useCallback, useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import { fetchUsers, fetchRoles, createUser, updateUser, deleteUser } from "../api/users";
import type { User, Role, CreateUserPayload, UpdateUserPayload } from "../api/users";
import { fetchPermissions, createRole, updateRole } from "../api/admin";
import type { Permission, RoleDetail, CreateRolePayload, UpdateRolePayload } from "../api/admin";
import { useAuth } from "../hooks/useAuth";

/* ------------------------------------------------------------------ */
/*  Add / Edit Modal                                                   */
/* ------------------------------------------------------------------ */
interface UserModalProps {
  onClose: () => void;
  onSave: (data: CreateUserPayload | UpdateUserPayload) => Promise<void>;
  user: User | null; // null → create mode
  saving: boolean;
  roles: Role[];
}

function UserModal({ onClose, onSave, user, saving, roles }: UserModalProps) {
  const isEdit = user !== null;

  const [email, setEmail] = useState(user?.email ?? "");
  const matchingRole = roles.find((r) => r.name === user?.role);
  const [roleId, setRoleId] = useState<number>(matchingRole?.id ?? roles[0]?.id ?? 0);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isEdit) {
      // Create mode – all fields required
      if (!email || !password || roleId == null) {
        setError("All fields are required.");
        return;
      }
      try {
        await onSave({ email, password, role_id: roleId });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create user");
      }
    } else {
      // Edit mode – send only changed fields
      const patch: UpdateUserPayload = {};
      if (email !== user.email) patch.email = email;
      const currentRoleId = matchingRole?.id;
      if (roleId !== currentRoleId) patch.role_id = roleId;
      if (password) patch.password = password;

      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      try {
        await onSave(patch);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to update user");
      }
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">
          {isEdit ? "Edit User" : "Add User"}
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Email */}
          <label className="form-control w-full">
            <span className="label-text font-medium mb-1">Email</span>
            <input
              type="email"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </label>

          {/* Role */}
          <label className="form-control w-full">
            <span className="label-text font-medium mb-1">Role</span>
            <select
              className="select select-bordered w-full"
              value={roleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          {/* Password */}
          <label className="form-control w-full">
            <span className="label-text font-medium mb-1">
              {isEdit ? "New Password (leave blank to keep)" : "Password"}
            </span>
            <input
              type="password"
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required={!isEdit}
              placeholder={isEdit ? "••••••••" : ""}
              autoComplete="new-password"
            />
          </label>

          {error && (
            <div className="text-error text-sm">{error}</div>
          )}

          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <span className="loading loading-spinner loading-sm" />
              ) : isEdit ? (
                "Save"
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Confirmation Modal                                          */
/* ------------------------------------------------------------------ */
interface DeleteModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  user: User;
  deleting: boolean;
}

function DeleteModal({ onClose, onConfirm, user, deleting }: DeleteModalProps) {
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setError("");
    try {
      await onConfirm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg mb-2">Delete User</h3>
        <p>
          Are you sure you want to delete <strong>{user.email}</strong>?
        </p>
        {error && <div className="text-error text-sm mt-2">{error}</div>}
        <div className="modal-action">
          <button className="btn" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            className="btn btn-error"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Role Add / Edit Modal                                              */
/* ------------------------------------------------------------------ */
interface RoleModalProps {
  onClose: () => void;
  onSave: (data: CreateRolePayload | UpdateRolePayload) => Promise<void>;
  role: RoleDetail | null; // null → create mode
  saving: boolean;
  permissions: Permission[];
}

function RoleModal({ onClose, onSave, role, saving, permissions }: RoleModalProps) {
  const isEdit = role !== null;

  const [name, setName] = useState(role?.name ?? "");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    new Set(role?.permissions ?? []),
  );
  const [error, setError] = useState("");

  const togglePerm = (permName: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(permName)) {
        next.delete(permName);
      } else {
        next.add(permName);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }

    const permissionsArray = Array.from(selectedPerms);

    if (!isEdit) {
      try {
        await onSave({ name: name.trim(), permissions: permissionsArray });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create role");
      }
    } else {
      const patch: UpdateRolePayload = {};
      if (name.trim() !== role.name) patch.name = name.trim();

      const currentPerms = new Set(role.permissions);
      const permsChanged =
        permissionsArray.length !== currentPerms.size ||
        permissionsArray.some((p) => !currentPerms.has(p));
      if (permsChanged) patch.permissions = permissionsArray;

      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      try {
        await onSave(patch);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to update role");
      }
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">
          {isEdit ? "Edit Role" : "Add Role"}
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Role Name */}
          <label className="form-control w-full">
            <span className="label-text font-medium mb-1">Role Name</span>
            <input
              type="text"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
              placeholder="e.g. Manager"
            />
          </label>

          {/* Permissions Checklist */}
          <fieldset>
            <legend className="label-text font-medium mb-2">Permissions</legend>
            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto flex flex-col gap-2">
              {permissions.length === 0 ? (
                <span className="text-sm text-[#7B809A]">No permissions available.</span>
              ) : (
                permissions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary"
                      checked={selectedPerms.has(p.name)}
                      onChange={() => togglePerm(p.name)}
                    />
                    <span className="text-sm font-mono">{p.name}</span>
                  </label>
                ))
              )}
            </div>
          </fieldset>

          {error && (
            <div className="text-error text-sm">{error}</div>
          )}

          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <span className="loading loading-spinner loading-sm" />
              ) : isEdit ? (
                "Save"
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleDetails, setRoleDetails] = useState<RoleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  //permission Checker function
  const {hasPermission} = useAuth()

  // User modal state – modalKey forces remount so form state resets
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteKey, setDeleteKey] = useState(0);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Role modal state
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalKey, setRoleModalKey] = useState(0);
  const [editingRole, setEditingRole] = useState<RoleDetail | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [userData, roleData, permData] = await Promise.all([
        fetchUsers(),
        fetchRoles(),
        fetchPermissions(),
      ]);
      setUsers(userData);
      setRoles(roleData);
      setPermissions(permData);

      // Build role details: role list augmented with permission names.
      // If the roles API already returns permissions, use them; otherwise
      // initialize with an empty array so the UI still works.
      setRoleDetails(
        roleData.map((r) => ({
          id: r.id,
          name: r.name,
          permissions: r.permissions ?? [],
        })),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---------- Handlers ---------- */

  const openAddModal = () => {
    setEditingUser(null);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  };

  const handleSave = async (data: CreateUserPayload | UpdateUserPayload) => {
    setSaving(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, data as UpdateUserPayload);
      } else {
        await createUser(data as CreateUserPayload);
      }
      setModalOpen(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (user: User) => {
    setDeletingUser(user);
    setDeleteKey((k) => k + 1);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await deleteUser(deletingUser.id);
      setDeleteModalOpen(false);
      await loadData();
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- Role Handlers ---------- */

  const openAddRoleModal = () => {
    setEditingRole(null);
    setRoleModalKey((k) => k + 1);
    setRoleModalOpen(true);
  };

  const openEditRoleModal = (role: RoleDetail) => {
    setEditingRole(role);
    setRoleModalKey((k) => k + 1);
    setRoleModalOpen(true);
  };

  const handleRoleSave = async (data: CreateRolePayload | UpdateRolePayload) => {
    setSavingRole(true);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, data as UpdateRolePayload);
      } else {
        await createRole(data as CreateRolePayload);
      }
      setRoleModalOpen(false);
      await loadData();
    } finally {
      setSavingRole(false);
    }
  };

  /* ---------- Render ---------- */

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#344767]">
            Manage Users &amp; Roles
          </h1>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : (
          <>
            {/* ========== User Management Section ========== */}
            <h2 className="text-lg font-semibold text-[#344767] mb-3">Users</h2>

            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr className="text-xs uppercase text-[#7B809A]">
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[#7B809A]">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td className="font-medium">{u.email}</td>
                        <td>
                          <span className="badge badge-outline badge-sm">
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-sm ${
                              u.is_active ? "badge-success" : "badge-ghost"
                            }`}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-right">
                          {hasPermission("users:edit") && (
                            <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => openEditModal(u)}
                            title="Edit user"
                            aria-label={`Edit ${u.email}`}
                          >
                            ✏️
                          </button>
                          )}
                          {hasPermission("users:delete") && (
                            <button
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => openDeleteModal(u)}
                            title="Delete user"
                            aria-label={`Delete ${u.email}`}
                          >
                            🗑️
                          </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add User button */}
            {hasPermission("users:create") && (
            <div className="flex justify-end mt-4">
              <button className="btn btn-primary" onClick={openAddModal}>
                + Add User
              </button>
            </div>
            )}

            {/* ========== Role Management Section ========== */}
            <div className="divider my-8" />
            <h2 className="text-lg font-semibold text-[#344767] mb-3">Roles</h2>

            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr className="text-xs uppercase text-[#7B809A]">
                    <th>Role Name</th>
                    <th>Permissions</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roleDetails.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-[#7B809A]">
                        No roles found.
                      </td>
                    </tr>
                  ) : (
                    roleDetails.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.name}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {r.permissions.length === 0 ? (
                              <span className="text-[#7B809A] text-xs italic">
                                None
                              </span>
                            ) : (
                              r.permissions.map((p) => (
                                <span
                                  key={p}
                                  className="badge badge-outline badge-xs font-mono"
                                >
                                  {p}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        {hasPermission("roles:manage") && (
                          <td className="text-right">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => openEditRoleModal(r)}
                            title="Edit role"
                            aria-label={`Edit role ${r.name}`}
                          >
                            ✏️
                          </button>
                        </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add Role button */}
            {hasPermission("roles:manage") && (
              <div className="flex justify-end mt-4">
                <button className="btn btn-secondary" onClick={openAddRoleModal}>
                  + Add Role
                </button>
              </div>               
            )}
          </>
        )}
      </div>

      {/* User Modals – key forces remount to reset form state */}
      {modalOpen && roles.length > 0 && (
        <UserModal
          key={modalKey}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          user={editingUser}
          saving={saving}
          roles={roles}
        />
      )}

      {deleteModalOpen && deletingUser && (
        <DeleteModal
          key={deleteKey}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDelete}
          user={deletingUser}
          deleting={deleting}
        />
      )}

      {/* Role Modal */}
      {roleModalOpen && (
        <RoleModal
          key={roleModalKey}
          onClose={() => setRoleModalOpen(false)}
          onSave={handleRoleSave}
          role={editingRole}
          saving={savingRole}
          permissions={permissions}
        />
      )}
    </MainLayout>
  );
}
