import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useContext } from "react";
import AuthProvider from "./context/AuthContext";
import { AuthContext } from "./context/authContextDef";
import WarehouseProvider from "./context/WarehouseContext";
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
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Dashboard/>}/>
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/order" element={<Order />} />
            <Route path="/orders/search" element={<OrdersSearch />} />
            <Route path="/transactions" element={<TransactionsPage/>}/>
            <Route path="/conversions" element={<ConversionsPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="/products/:productId" element={<ProductDetailPage />} />
            <Route path="/child-products/:childProductId" element={<ChildProductDetailPage />} />
            <Route path="/packing-slip-tracker" element={<PackingSlipTrackerPage />} />
          </Route>
        </Routes>
      </WarehouseProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
