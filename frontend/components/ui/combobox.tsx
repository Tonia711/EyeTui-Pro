"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "./utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
  showClearButton?: boolean;
  hideBorder?: boolean;
  disableFilter?: boolean;
  selectionOnly?: boolean;
  usePortal?: boolean;
  portalZIndex?: number;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Type or select...",
  emptyText = "No option found.",
  className,
  inputClassName,
  inputStyle,
  disabled = false,
  readOnly = false,
  showClearButton = false,
  hideBorder = false,
  disableFilter = false,
  selectionOnly = false,
  usePortal = false,
  portalZIndex = 99999,
}: ComboboxProps) {
  const [inputValue, setInputValue] = React.useState(() => {
    if (!value) return "";
    const option = options.find((opt) => opt.value === value);
    return option ? option.label : value;
  });
  const [isFocused, setIsFocused] = React.useState(false);
  const [hoveredOption, setHoveredOption] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [portalRect, setPortalRect] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const previousValueRef = React.useRef<string | undefined>(value);
  const isUserEditingRef = React.useRef(false);

  React.useEffect(() => {
    // Keep the displayed input text in sync with the selected value.
    // Important: options may load after the value is already set, so we must
    // also update when options change (even if value did not).
    if (isUserEditingRef.current) return;

    previousValueRef.current = value;
    if (value) {
      const option = options.find((opt) => opt.value === value);
      setInputValue(option ? option.label : value);
      return;
    }
    setInputValue("");
  }, [value, options]);

  const syncInputToValue = React.useCallback(() => {
    if (value) {
      const option = options.find((opt) => opt.value === value);
      setInputValue(option ? option.label : value);
      return;
    }
    setInputValue("");
  }, [value, options]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsFocused(false);
        setHoveredOption(null);
        if (selectionOnly) {
          isUserEditingRef.current = false;
          syncInputToValue();
        }
      }
    };

    if (isFocused) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isFocused]);

  const calculateRect = React.useCallback(() => {
    if (!containerRef.current) return null;
    const input = containerRef.current.querySelector("input");
    const el = (input || containerRef.current) as HTMLElement;
    const rect = el.getBoundingClientRect();
    return { top: rect.bottom, left: rect.left, width: rect.width };
  }, []);

  React.useEffect(() => {
    if (!isFocused || !usePortal) return;

    const update = () => setPortalRect(calculateRect());
    update();

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isFocused, usePortal, calculateRect]);

  const handleSelect = (selectedValue: string) => {
    const option = options.find(
      (opt) => opt.value === selectedValue || opt.label === selectedValue
    );
    
    if (option) {
      // Display the label in the input, but store the value
      setInputValue(option.label);
      onValueChange(option.value);
      setIsFocused(false);
      setHoveredOption(null);
    } else {
      setInputValue(selectedValue);
      onValueChange(selectedValue);
      setIsFocused(false);
      setHoveredOption(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    isUserEditingRef.current = true;
    setInputValue(newValue);
    if (selectionOnly) {
      setIsFocused(true);
      return;
    }
    // Find if the input matches any option's value or label exactly
    const exactMatch = options.find(
      opt => opt.value === newValue || opt.label === newValue
    );
    // If there's an exact match, use the option's value, otherwise use the raw input
    // This allows users to freely edit the input without it being reset
    onValueChange(exactMatch ? exactMatch.value : newValue);
    setIsFocused(true);
    // Reset editing flag after a delay to allow for external updates
    // Use a longer delay to prevent race conditions
    setTimeout(() => {
      isUserEditingRef.current = false;
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsFocused(false);
    } else if (e.key === "Enter") {
      // If there's a single match, select it
      if (filteredOptions.length === 1) {
        handleSelect(filteredOptions[0].value);
        e.preventDefault();
      }
    }
  };

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setInputValue("");
    onValueChange("");
    setIsFocused(false);
    isUserEditingRef.current = false;
  };

  const hasValue = Boolean(value || inputValue);

  // Filter options based on input value for fuzzy matching
  const filteredOptions = React.useMemo(() => {
    if (disableFilter) return options;
    if (!inputValue.trim()) return options;
    const searchLower = inputValue.toLowerCase();
    return options.filter(
      (option) =>
        option.value.toLowerCase().includes(searchLower) ||
        option.label.toLowerCase().includes(searchLower)
    );
  }, [options, inputValue, disableFilter]);

  const isFullWidth = className?.includes('w-full');
  
  return (
    <div 
      className={cn("relative inline-block", className)}
      ref={containerRef} 
      style={isFullWidth ? { width: '100%' } : { maxWidth: 'fit-content', width: 'auto' }}
    >
      <div 
        className="relative inline-block" 
        style={isFullWidth ? { width: '100%', minWidth: '100%' } : { width: '200px', minWidth: '180px' }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          onFocus={() => {
            setIsFocused(true);
          }}
          onClick={() => {
            setIsFocused(true);
          }}
          onBlur={(e) => {
            // Delay to allow click on dropdown items
            setTimeout(() => {
              if (
                dropdownRef.current &&
                !dropdownRef.current.contains(document.activeElement) &&
                !dropdownRef.current.contains(e.relatedTarget as Node)
              ) {
                setIsFocused(false);
                setHoveredOption(null);
                if (selectionOnly) {
                  isUserEditingRef.current = false;
                  syncInputToValue();
                }
              }
            }, 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-5 px-0 py-0 outline-none bg-transparent text-gray-700 text-sm leading-5 cursor-text",
            !hideBorder && "border-b-2 border-[#0dcaf0] focus:border-[#0bb8d9]",
            inputClassName
          )}
          style={{ 
            // reserve space for right-side icons
            // - dropdown toggle: 24px
            // - optional clear button: 24px
            paddingRight: showClearButton && hasValue ? '48px' : '24px',
            boxSizing: 'border-box',
            width: '100%',
            minWidth: '100%',
            ...inputStyle
          }}
        />
        {showClearButton && hasValue && (
          <button
            type="button"
            onClick={handleClear}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={cn(
              "absolute top-0 flex items-center justify-center",
              "opacity-50 hover:opacity-70 transition-opacity cursor-pointer",
              "focus:outline-none bg-transparent border-0 p-0 m-0",
              "select-none touch-none pointer-events-auto"
            )}
            style={{
              position: 'absolute',
              // clear button sits LEFT of the dropdown toggle
              right: '24px',
              top: 0,
              width: '24px',
              height: '20px',
              minWidth: '24px',
              maxWidth: '24px',
              flexShrink: 0,
            }}
            tabIndex={-1}
            aria-label="Clear value"
          >
            <X className="h-4 w-4 pointer-events-none flex-shrink-0" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsFocused((prev) => !prev);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={cn(
            "absolute top-0 flex items-center justify-center",
            "opacity-50 hover:opacity-70 transition-opacity cursor-pointer",
            "focus:outline-none bg-transparent border-0 p-0 m-0",
            "select-none touch-none pointer-events-auto",
            isFocused && "opacity-70"
          )}
          style={{
            position: 'absolute',
            // dropdown toggle is always the RIGHTMOST icon
            right: '0',
            top: 0,
            width: '24px',
            height: '20px',
            minWidth: '24px',
            maxWidth: '24px',
            flexShrink: 0,
          }}
          tabIndex={-1}
          aria-label="Toggle dropdown"
        >
          <ChevronsUpDown className="h-4 w-4 pointer-events-none flex-shrink-0" />
        </button>
      </div>

      {/* Dropdown menu - rendered directly under the input so it follows the cell */}
      {isFocused &&
        (usePortal ? (
          portalRect
            ? createPortal(
                <div
                  ref={dropdownRef}
                  className="bg-white border border-gray-200 shadow-lg"
                  style={{
                    position: "fixed",
                    top: portalRect.top + 4,
                    left: portalRect.left,
                    width: portalRect.width,
                    zIndex: portalZIndex,
                    fontFamily: "Jost, sans-serif",
                  }}
                >
                  <div
                    className="custom-scrollbar"
                    style={{
                      maxHeight: "240px",
                      overflowY: "auto",
                      overflowX: "hidden",
                    }}
                  >
                    {filteredOptions.length > 0 ? (
                      <div>
                        {filteredOptions.map((option) => {
                          const isSelected = value === option.value;
                          const isHovered = hoveredOption === option.value;
                          return (
                            <div
                              key={option.value}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSelect(option.value);
                              }}
                              onMouseEnter={() => setHoveredOption(option.value)}
                              onMouseLeave={() => setHoveredOption(null)}
                              className={cn(
                                "w-full px-4 py-2 text-left transition-colors text-sm flex items-center",
                                isSelected
                                  ? "bg-white text-gray-900 font-bold"
                                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold",
                              )}
                            >
                              <span className="flex-1 leading-5">
                                {option.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-sm text-gray-400">
                        {emptyText}
                      </div>
                    )}
                  </div>
                </div>,
                document.body,
              )
            : null
        ) : (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg z-[9999]"
            style={{ fontFamily: "Jost, sans-serif" }}
          >
            <div
              className="custom-scrollbar"
              style={{
                maxHeight: "240px",
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              {filteredOptions.length > 0 ? (
                <div>
                  {filteredOptions.map((option) => {
                    const isSelected = value === option.value;
                    const isHovered = hoveredOption === option.value;
                    return (
                      <div
                        key={option.value}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelect(option.value);
                        }}
                        onMouseEnter={() => setHoveredOption(option.value)}
                        onMouseLeave={() => setHoveredOption(null)}
                        className={cn(
                          "w-full px-4 py-2 text-left transition-colors text-sm flex items-center",
                          isSelected
                            ? "bg-white text-gray-900 font-bold"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold",
                        )}
                      >
                        <span className="flex-1 leading-5">{option.label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-400">
                  {emptyText}
                </div>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

