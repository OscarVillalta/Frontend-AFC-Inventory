interface DateSelectionProps{
    label: string;
    setFilter: (key: any, value: any) => void;
    filters: Record<string, any>;
    startdateKey: string;
    enddatekey: string;
    datemodekey: string;
}

export default function DateSelection({
    label,
    setFilter,
    filters,
    startdateKey,
    enddatekey,
    datemodekey
}: DateSelectionProps) {
    return (
         <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
            <select
                className="select select-bordered select-sm w-full"
                value={filters[datemodekey]}
                onChange={(e) => {
                setFilter(datemodekey, e.target.value);
                setFilter(startdateKey, "");
                setFilter(enddatekey, "");
                }}
            >
                <option value="none">All Dates</option>
                <option value="between">Between</option>
                <option value="before">Before</option>
                <option value="after">After</option>
            </select>
            {filters[datemodekey] === "between" && (
                <div className="flex gap-2 mt-1">
                <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={filters[startdateKey]}
                    onChange={(e) => setFilter(startdateKey, e.target.value)}
                />
                <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={filters[enddatekey]}
                    onChange={(e) => setFilter(enddatekey, e.target.value)}
                />
                </div>
            )}
            {(filters[datemodekey] === "before" || filters[datemodekey] === "after") && (
                <input
                type="date"
                className="input input-bordered input-sm w-full mt-1"
                value={filters[startdateKey]}
                onChange={(e) => setFilter(startdateKey, e.target.value)}
                />
            )}
            </div>
    )
}