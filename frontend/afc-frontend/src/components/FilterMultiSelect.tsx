import { useEffect, useMemo, useRef, useState } from "react";

export type FilterMultiSelectOption = {
  value: string;
  label: string;
};

export interface FilterMultiSelectProps {
  label: string;
  placeholder: string;
  options: FilterMultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** When true, shows a text field inside the dropdown to filter options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  dropdownMinWidth?: string;
}

export default function FilterMultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  searchable = false,
  searchPlaceholder = "Search…",
  className = "",
  dropdownMinWidth = "min-w-[180px]",
}: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchable) {
      searchInputRef.current?.focus();
    }
    if (!open) {
      setSearchText("");
    }
  }, [open, searchable]);

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} selected`;

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchText.trim()) return options;
    const query = searchText.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, searchable, searchText]);

  return (
    <div
      className={`relative flex flex-col gap-0.5 min-w-[140px] ${className}`}
      ref={wrapperRef}
    >
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-left"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{displayText}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute z-30 top-full mt-1 w-full ${dropdownMinWidth} bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden`}
          role="listbox"
          aria-multiselectable="true"
        >
          {searchable && (
            <div className="border-b border-gray-200 p-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
            ) : (
              filteredOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                    checked={selected.includes(option.value)}
                    onChange={() => toggleValue(option.value)}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
