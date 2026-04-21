interface KpiCardProps {
  label: string;
  value: number | null | undefined;
  icon: any;
  color: "success" | "info" | "warning" | "primary" | "error";
  percentageChange?: number | null;
}

const bgColorClasses = {
  success: "bg-[#2fb379]",
  info: "bg-[#3c87e2]",
  warning: "bg-[#f1c13a]",
  primary: "bg-[#2ca6a7]",
  error: "bg-[#e54c46]",
};

const bgColorClassesDark = {
  success: "bg-[#22935f]",
  info: "bg-[#3271c1]",
  warning: "bg-[#d5a421]",
  primary: "bg-[#258d91]",
  error: "bg-[#c23634]",
}


export default function KpiCard({ label, value, icon, color, percentageChange }: KpiCardProps) {
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercentage = (pct: number) => {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  return (
    <div className={`${bgColorClasses[color]} rounded-xl shadow-lg p-6 text-white flex gap-3`}>
      <div className={`self-center ${bgColorClassesDark[color]} p-2 rounded-md`}>
        <span className="text-3xl opacity-80" role="img" aria-label={label}>
          {icon}
        </span>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium uppercase opacity-90">{label}</div>
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
    </div>
  );
}
