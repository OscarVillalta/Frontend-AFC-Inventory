import { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../../context/authContextDef";

interface ProtectedRouteProps {
  allowedRoles: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const auth = useContext(AuthContext);

  if (!auth || !auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(auth.user!.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
