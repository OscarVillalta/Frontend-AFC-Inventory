import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useContext } from "react";
import AuthProvider from "./context/AuthContext";
import { AuthContext } from "./context/authContextDef";
import WarehouseProvider from "./context/WarehouseContext";
import ToastProvider from "./context/ToastContext";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import SignInPage from "./pages/SignInPage";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Order from "./pages/Orders";
import OrdersSearch from "./pages/OrdersSearch";
import TransactionsPage from "./pages/Transactions";
import OrderDetailPage from "./components/order/OrderDetailPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ChildProductDetailPage from "./pages/ChildProductDetailPage";
import ConversionsPage from "./pages/Conversions";
import PackingSlipTrackerPage from "./pages/PackingSlipTrackerPage";
import ManageUsersPage from "./pages/ManageUsersPage";

function RequireAuth() {
  const auth = useContext(AuthContext);
  if (!auth || !auth.isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <WarehouseProvider>
      <ToastProvider>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Dashboard/>}/>

            {/* Product / Catalog Management — requires catalog:edit */}
            <Route element={<ProtectedRoute requiredPermission="inventory:view" />}>
              <Route path="/products/:productId" element={<ProductDetailPage />} />
              <Route path="/child-products/:childProductId" element={<ChildProductDetailPage />} />
              <Route path="/inventory" element={<Inventory />} />
            </Route>

            {/* User Management — requires roles:manage */}
            <Route element={<ProtectedRoute requiredPermission="roles:manage" />}>
              <Route path="/users:view" element={<ManageUsersPage />} />
            </Route>

            {/* Inventory & Order pages — requires orders:view */}
            <Route element={<ProtectedRoute requiredPermission="orders:view" />}>
              <Route path="/order" element={<Order />} />
              <Route path="/orders/search" element={<OrdersSearch />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="tracker:view"/>}>
              <Route path="/packing-slip-tracker" element={<PackingSlipTrackerPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="conversions:view"/>}>
              <Route path="/conversions" element={<ConversionsPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="catalog:view"/>}>
              <Route path="/transactions" element={<TransactionsPage/>}/>
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
      </WarehouseProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
