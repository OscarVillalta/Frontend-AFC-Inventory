import type { DashboardKPIs } from "../../api/dashboard";

interface DashboardOverviewRowProps {
  kpis: DashboardKPIs | null;
  loading: boolean;
  error: string | null;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value.toLocaleString()}</p>
    </div>
  );
}

export default function DashboardOverviewRow({ kpis, loading, error }: DashboardOverviewRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-lg animate-pulse border border-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center py-4 text-red-500 text-sm">{error}</p>
    );
  }

  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard label="Open Orders" value={kpis.open_orders} />
      <StatCard label="Pending Txns" value={kpis.pending_txns} />
      <StatCard label="Low Stock" value={kpis.low_stock} />
      <StatCard label="Backordered SKUs" value={kpis.backordered} />
      <StatCard label="Active Batches" value={kpis.active_batches} />
    </div>
  );
}
