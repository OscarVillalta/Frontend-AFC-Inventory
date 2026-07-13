import { Link, useLocation, useNavigate } from "react-router-dom";
import { useWarehouse } from "../hooks/useWarehouse";
import { useAuth } from "../hooks/useAuth";

interface Props {
  onMenuToggle?: () => void;
}

export default function Topbar({ onMenuToggle }: Props) {
  const { pathname } = useLocation();
  const { warehouses, activeWarehouseId, setActiveWarehouseId, loading } =
    useWarehouse();
  const { hasPermission, logout, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = hasPermission("users:manage");

  type Breadcrumb = { label: string; to?: string };

  const breadcrumbs = (() => {
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 0) return [{ label: "Dashboard" }] as Breadcrumb[];

    // Orders
    if (segments[0] === "orders") {
      // "/orders/search" is the listing page; any other second segment is a detail id
      if (segments[1] && segments[1] !== "search") {
        return [
          { label: "Orders", to: "/orders/search" },
          { label: segments[1] },
        ] as Breadcrumb[];
      }
      return [{ label: "Orders", to: "/orders/search" }] as Breadcrumb[];
    }

    // Inventory + product detail paths
    if (["inventory", "products", "child-products"].includes(segments[0])) {
      const crumbs: Breadcrumb[] = [{ label: "Inventory", to: "/inventory" }];
      if (segments[1]) crumbs.push({ label: segments[1] });
      if (segments[2]) crumbs.push({ label: segments[2] });
      return crumbs;
    }

    // Fallback: generic breadcrumbs with cumulative links
    return segments.map((seg, idx) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1),
      to: idx < segments.length - 1
        ? "/" + segments.slice(0, idx + 1).join("/")
        : undefined,
    }));
  })();

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    setActiveWarehouseId(id);
  };

  return (
    <div className="w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-base-200 shadow-sm">
      
      {/* LEFT SIDE - MENU TOGGLE + BREADCRUMBS */}
      <div className="flex items-center gap-2 text-sm font-medium text-[#7B809A]">
        {onMenuToggle && (
          <button
            className="btn btn-sm btn-ghost min-[1300px]:hidden"
            onClick={onMenuToggle}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
        )}
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-2">
            {idx > 0 && <span>/</span>}
            {crumb.to ? (
              <Link to={crumb.to} className="text-[#344767] hover:text-blue-600">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-[#344767]">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* RIGHT SIDE - WAREHOUSE SELECTOR + SEARCH & ICONS */}
      <div className="flex items-center gap-2 sm:gap-4">
        
        {/* Warehouse Selector */}
        {!loading && warehouses.length > 0 && (
          <select
            className="select select-sm bg-white rounded-lg shadow-sm font-medium text-sm"
            value={activeWarehouseId ?? ""}
            onChange={handleWarehouseChange}
            aria-label="Select warehouse"
          >
            {warehouses
              .filter((w) => w.is_active)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  🏭 {w.name}
                </option>
              ))}
          </select>
        )}



        {/* Settings Dropdown */}
        <div className="dropdown dropdown-end">
          <button tabIndex={0} className="btn btn-sm btn-circle bg-white shadow-sm">
            ⚙️
          </button>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-box z-50 w-48 p-2 shadow"
          >
              <li>
                <Link to="/manage-users">Manage Users</Link>
              </li>
          </ul>
        </div>


        {/* User Avatar Dropdown */}
        <div className="dropdown dropdown-end">
          <button tabIndex={0} className="btn btn-ghost btn-circle avatar" aria-label="User menu">
            <div className="w-8 h-8 rounded-full shadow bg-neutral text-neutral-content text-xs flex items-center justify-center">
              {user?.email?.charAt(0).toUpperCase() ?? "U"}
            </div>
          </button>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow"
          >
            <li className="menu-title">
              <span className="text-xs truncate">{user?.email ?? "User"}</span>
            </li>
            <li>
              <button
                onClick={() => {
                  logout();
                  navigate("/signin");
                }}
                className="text-error"
              >
                🚪 Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
