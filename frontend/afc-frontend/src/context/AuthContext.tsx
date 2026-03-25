import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./authContextDef";
import type { AuthUser } from "./authContextDef";

const TOKEN_KEY = "access_token";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const email = localStorage.getItem("user_email");
    const role = localStorage.getItem("user_role");
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && email && role) {
      return { email, role };
    }
    return null;
  });

  const isAuthenticated = user !== null;

  const login = useCallback((token: string, email: string, role: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("user_email", email);
    localStorage.setItem("user_role", role);
    setUser({ email, role });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_role");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
