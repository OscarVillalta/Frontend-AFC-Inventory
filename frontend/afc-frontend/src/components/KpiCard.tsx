interface KpiCardProps {
  label: string;
  value: number | null | undefined;
  icon: string;
  color: "success" | "info" | "warning" | "primary" | "error";
}

const colorClasses = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  primary: "text-primary",
  error: "text-error",
};

export default function KpiCard({ label, value, icon, color }: KpiCardProps) {
  return (
    <div className="stat bg-white rounded-xl shadow border border-gray-100 p-4">
      <div className="stat-title text-gray-500 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        {label}
      </div>
      <div className={`stat-value ${colorClasses[color]}`}>{value ?? 0}</div>
    </div>
  );
}
