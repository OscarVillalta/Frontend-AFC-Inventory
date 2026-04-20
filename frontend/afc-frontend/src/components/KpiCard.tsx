interface KpiCardProps {
  label: string;
  value: number | null | undefined;
  icon: string;
  color: "success" | "info" | "warning" | "primary" | "error";
  percentageChange?: number | null;
}

const bgColorClasses = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  primary: "bg-primary",
  error: "bg-error",
};

export default function KpiCard({ label, value, icon, color, percentageChange }: KpiCardProps) {
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercentage = (pct: number) => {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  return (
    <div className={`${bgColorClasses[color]} rounded-xl shadow-lg p-6 text-white`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium uppercase opacity-90">{label}</div>
        <span className="text-3xl opacity-80" role="img" aria-label={label}>
          {icon}
        </span>
      </div>
      <div className="text-4xl font-bold mb-1">
        {value != null ? formatNumber(value) : '0'}
      </div>
      {percentageChange != null && (
        <div className="text-sm font-medium opacity-90">
          {formatPercentage(percentageChange)}
        </div>
      )}
    </div>
  );
}
