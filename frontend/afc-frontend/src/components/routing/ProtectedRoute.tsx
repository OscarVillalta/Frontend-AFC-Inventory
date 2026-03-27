import { useEffect, useRef } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";

interface ProtectedRouteProps {
  requiredPermission: string;
}

export default function ProtectedRoute({ requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission } = useAuth();
  const { showToast } = useToast();
  const toastFired = useRef(false);

  const isUnauthorized = isAuthenticated && !hasPermission(requiredPermission);

  useEffect(() => {
    if (isUnauthorized && !toastFired.current) {
      toastFired.current = true;
      showToast("Your Role does not have the permission to access this", "error");
    }
  }, [isUnauthorized, showToast]);

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (isUnauthorized) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
