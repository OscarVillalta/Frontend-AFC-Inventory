import { createContext } from "react";

export const AUTH_TOKEN_KEY = "access_token";

export interface AuthUser {
  email: string;
  role: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, email: string, role: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
