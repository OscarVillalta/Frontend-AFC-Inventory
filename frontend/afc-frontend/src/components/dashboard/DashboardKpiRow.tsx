import KpiCard from "../KpiCard";
import type { NetKpisResponse } from "../../api/dashboard";
import {
  NetDeliveredIcon,
  NetReceivedIcon,
  NetReservedIcon,
  NetOrderedIcon,
  NetBackorderedIcon,
} from "./dashboardIcons";

interface DashboardKpiRowProps {
  netKpis: NetKpisResponse | null;
  loading: boolean;
  error: string | null;
}

export default function DashboardKpiRow({ netKpis, loading, error }: DashboardKpiRowProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center py-4 text-red-500 text-sm">{error}</p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard
        label="Net Delivered"
        value={netKpis?.net_delivered}
        icon={<NetDeliveredIcon />}
        color="success"
        percentageChange={netKpis?.net_delivered_pct}
      />
      <KpiCard
        label="Net Received"
        value={netKpis?.net_received}
        icon={<NetReceivedIcon />}
        color="info"
        percentageChange={netKpis?.net_received_pct}
      />
      <KpiCard
        label="Net Reserved"
        value={netKpis?.net_reserved}
        icon={<NetReservedIcon />}
        color="warning"
      />
      <KpiCard
        label="Net Ordered"
        value={netKpis?.net_ordered}
        icon={<NetOrderedIcon />}
        color="primary"
      />
      <KpiCard
        label="Net Backordered"
        value={netKpis?.net_backordered}
        icon={<NetBackorderedIcon />}
        color="error"
      />
    </div>
  );
}
