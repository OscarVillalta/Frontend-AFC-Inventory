import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import { AuthContext, AUTH_TOKEN_KEY } from "./authContextDef";
import type { AuthUser } from "./authContextDef";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const email = localStorage.getItem("user_email");
    const permissionsRaw = localStorage.getItem("user_permissions");
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token && email && permissionsRaw) {
      try {
        const permissions: string[] = JSON.parse(permissionsRaw);
        return { email, permissions };
      } catch {
        return null;
      }
    }
    return null;
  });

  const isAuthenticated = user !== null;

  const login = useCallback((token: string, email: string, permissions: string[]) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem("user_email", email);
    localStorage.setItem("user_permissions", JSON.stringify(permissions));
    setUser({ email, permissions });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_permissions");
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}
