import { useState, useEffect, useCallback } from "react";
import MainLayout from "../layouts/MainLayout";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../api/users";
import type { UserRecord, CreateUserPayload, UpdateUserPayload } from "../api/users";

const VALID_ROLES = ["Admin", "Sales", "Warehouse", "Service"];

/* ------------------------------------------------------------------ */
/*  Add / Edit Modal                                                   */
/* ------------------------------------------------------------------ */

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingUser: UserRecord | null; // null ⇒ create mode
}

function UserModal({ open, onClose, onSaved, editingUser }: UserModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(VALID_ROLES[0]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync fields when the modal opens / switches between create/edit
  useEffect(() => {
    if (open) {
      setError("");
      setPassword("");
      if (editingUser) {
        setEmail(editingUser.email);
        setRole(editingUser.role);
      } else {
        setEmail("");
        setRole(VALID_ROLES[0]);
      }
    }
  }, [open, editingUser]);

  async function handleSubmit() {
    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!editingUser && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (editingUser && password.length > 0 && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      if (editingUser) {
        const patch: UpdateUserPayload = {};
        if (email !== editingUser.email) patch.email = email;
        if (role !== editingUser.role) patch.role = role;
        if (password) patch.password = password;

        if (Object.keys(patch).length === 0) {
          onClose();
          return;
        }

        await updateUser(editingUser.id, patch);
      } else {
        const payload: CreateUserPayload = { email, password, role };
        await createUser(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white w-[440px] rounded-xl shadow-xl p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          {editingUser ? "Edit User" : "Add User"}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Email */}
        <div className="mb-4">
          <label className="font-medium text-sm text-gray-600">Email</label>
          <input
            type="email"
            className="input input-bordered w-full mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            disabled={loading}
          />
        </div>

        {/* Role */}
        <div className="mb-4">
          <label className="font-medium text-sm text-gray-600">Role</label>
          <select
            className="select select-bordered w-full mt-1"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
          >
            {VALID_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Password */}
        <div className="mb-4">
          <label className="font-medium text-sm text-gray-600">
            {editingUser ? "New Password (leave blank to keep current)" : "Password"}
          </label>
          <input
            type="password"
            className="input input-bordered w-full mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={editingUser ? "••••••••" : "Min 8 characters"}
            disabled={loading}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? editingUser
                ? "Saving..."
                : "Creating..."
              : editingUser
                ? "Save Changes"
                : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Confirmation Modal                                          */
/* ------------------------------------------------------------------ */

interface DeleteModalProps {
  open: boolean;
  user: UserRecord | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string;
}

function DeleteModal({ open, user, onClose, onConfirm, loading, error }: DeleteModalProps) {
  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white w-[400px] rounded-xl shadow-xl p-6">
        <h2 className="text-xl font-semibold mb-2 text-gray-800">Delete User</h2>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{user.email}</strong>? This action cannot be undone.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn bg-red-600 text-white hover:bg-red-700"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ManageUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openAdd() {
    setEditingUser(null);
    setModalOpen(true);
  }

  function openEdit(user: UserRecord) {
    setEditingUser(user);
    setModalOpen(true);
  }

  function openDelete(user: UserRecord) {
    setDeleteError("");
    setDeletingUser(user);
    setDeleteModalOpen(true);
  }

  async function handleDelete() {
    if (!deletingUser) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteUser(deletingUser.id);
      setDeleteModalOpen(false);
      setDeletingUser(null);
      loadUsers();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setDeleteLoading(false);
    }
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      Admin: "bg-purple-100 text-purple-700 border-purple-200",
      Sales: "bg-blue-100 text-blue-700 border-blue-200",
      Warehouse: "bg-green-100 text-green-700 border-green-200",
      Service: "bg-orange-100 text-orange-700 border-orange-200",
    };
    return colors[role] ?? "bg-gray-100 text-gray-700 border-gray-200";
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Manage Users</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
          <table className="table w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-gray-500">{u.id}</td>
                    <td className="py-3 px-4 font-medium">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${roleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.is_active ? (
                        <span className="badge bg-green-100 text-green-700 border-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="badge bg-gray-100 text-gray-500 border-gray-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => openEdit(u)}
                        title="Edit user"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-ghost text-red-500"
                        onClick={() => openDelete(u)}
                        title="Delete user"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add User button */}
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={openAdd}>
            + Add User
          </button>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadUsers}
        editingUser={editingUser}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        open={deleteModalOpen}
        user={deletingUser}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingUser(null);
        }}
        onConfirm={handleDelete}
        loading={deleteLoading}
        error={deleteError}
      />
    </MainLayout>
  );
}
