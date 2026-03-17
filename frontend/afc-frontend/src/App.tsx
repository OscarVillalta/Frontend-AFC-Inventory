import { BrowserRouter, Routes, Route } from "react-router-dom";
import WarehouseProvider from "./context/WarehouseContext";
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

function App() {
  return (
    <BrowserRouter>
      <WarehouseProvider>
        <Routes>
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
        </Routes>
      </WarehouseProvider>
    </BrowserRouter>
  );
}

export default App;
