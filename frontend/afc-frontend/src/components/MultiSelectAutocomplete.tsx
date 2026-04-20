import { useState, useRef, useEffect } from "react";

interface AutocompleteOption {
  id: number;
  name: string;
}

interface MultiSelectAutocompleteProps {
  label: string;
  placeholder?: string;
  options: AutocompleteOption[];
  selectedIds: number[];
  onChange: (selectedIds: number[]) => void;
  className?: string;
}

export default function MultiSelectAutocomplete({
  label,
  placeholder = "",
  options,
  selectedIds,
  onChange,
  className = "",
}: MultiSelectAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter options based on input value and exclude already selected
  const filteredOptions = options.filter(
    (option) =>
      option.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedIds.includes(option.id)
  );

  const selectedOptions = options.filter((opt) => selectedIds.includes(opt.id));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleOptionClick = (optionId: number) => {
    onChange([...selectedIds, optionId]);
    setInputValue("");
    setHighlightedIndex(-1);
    // Scroll to top when item is selected
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  };

  const handleRemoveOption = (optionId: number) => {
    onChange(selectedIds.filter((id) => id !== optionId));
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const newIndex = prev < filteredOptions.length - 1 ? prev + 1 : prev;
          // Scroll highlighted item into view
          setTimeout(() => {
            if (listRef.current) {
              const items = listRef.current.children;
              if (items[newIndex]) {
                items[newIndex].scrollIntoView({
                  block: "nearest",
                  behavior: "smooth",
                });
              }
            }
          }, 0);
          return newIndex;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : -1;
          // Scroll highlighted item into view
          setTimeout(() => {
            if (listRef.current && newIndex >= 0) {
              const items = listRef.current.children;
              if (items[newIndex]) {
                items[newIndex].scrollIntoView({
                  block: "nearest",
                  behavior: "smooth",
                });
              }
            }
          }, 0);
          return newIndex;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleOptionClick(filteredOptions[highlightedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case "Backspace":
        if (inputValue === "" && selectedIds.length > 0) {
          e.preventDefault();
          onChange(selectedIds.slice(0, -1));
        }
        break;
    }
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {/* Selected items */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedOptions.map((option) => (
            <div
              key={option.id}
              className="badge badge-primary gap-2"
            >
              {option.name}
              <button
                type="button"
                onClick={() => handleRemoveOption(option.id)}
                className="hover:text-error"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        type="text"
        placeholder={placeholder}
        className="input input-bordered w-full"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
      />

      {/* Dropdown */}
      {isOpen && filteredOptions.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredOptions.map((option, index) => (
            <div
              key={option.id}
              className={`px-4 py-2 cursor-pointer text-sm ${
                index === highlightedIndex
                  ? "bg-blue-100 text-blue-900"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => handleOptionClick(option.id)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {option.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
