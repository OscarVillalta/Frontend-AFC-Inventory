import { useContext, useEffect, useRef } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../../context/authContextDef";
import { useToast } from "../../hooks/useToast";

interface ProtectedRouteProps {
  allowedRoles: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const auth = useContext(AuthContext);
  const { showToast } = useToast();
  const toastFired = useRef(false);

  const isUnauthorized =
    auth && auth.isAuthenticated && !allowedRoles.includes(auth.user!.role);

  useEffect(() => {
    if (isUnauthorized && !toastFired.current) {
      toastFired.current = true;
      showToast("Your Role does not have the permission to access this", "error");
    }
  }, [isUnauthorized, showToast]);

  if (!auth || !auth.isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (isUnauthorized) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
