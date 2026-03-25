import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { useMemo, type RefObject } from "react";
import star from "../../assets/star.png";
import starBlue from "../../assets/star-blue.png";
import starGrey from "../../assets/star-grey.png";

interface ClinicOption {
  value: string;
  label: string;
}

interface ClinicSelectorProps {
  selectedSite: string;
  setSelectedSite: (value: string) => void;
  clinicMenuOpen: boolean;
  setClinicMenuOpen: (open: boolean) => void;
  clinicMenuRect: { top: number; left: number; width: number } | null;
  setClinicMenuRect: (rect: { top: number; left: number; width: number } | null) => void;
  clinicButtonRef: RefObject<HTMLButtonElement>;
  calculateRect: (el: HTMLButtonElement | null) => { top: number; left: number; width: number } | null;
  clinicOptions: ClinicOption[];
  entriesCount: number;
  learningEntriesCount: number;
  showStudyMode: boolean;
  showLearningModeTooltip: boolean;
  setShowLearningModeTooltip: (show: boolean) => void;
  handleLearningModeToggle: () => void;
}

export function ClinicSelector({
  selectedSite,
  setSelectedSite,
  clinicMenuOpen,
  setClinicMenuOpen,
  clinicMenuRect,
  setClinicMenuRect,
  clinicButtonRef,
  calculateRect,
  clinicOptions,
  entriesCount,
  learningEntriesCount,
  showStudyMode,
  showLearningModeTooltip,
  setShowLearningModeTooltip,
  handleLearningModeToggle,
}: ClinicSelectorProps) {
  const isDisabled = useMemo(() => {
    const hasEntries = entriesCount > 0;
    const hasLearningEntries = learningEntriesCount > 0;
    return (hasEntries && !showStudyMode) || (showStudyMode && hasLearningEntries);
  }, [entriesCount, learningEntriesCount, showStudyMode]);

  const starSrc = showStudyMode ? starBlue : isDisabled ? starGrey : star;
  const textColor = showStudyMode
    ? "text-[#0dcaf0]"
    : isDisabled
      ? "text-gray-400"
      : "text-gray-600";

  return (
    <div className="mb-6">
      <style>{`
        .clinic-select-input::placeholder {
          color: ${selectedSite ? "#9ca3af" : "#000000"} !important;
        }
      `}</style>
      <p className="text-gray-400 text-sm font-bold mb-2">
        Select a clinic before uploading lens records.
      </p>
      <div className="flex items-center justify-between">
        <div className="relative" style={{ width: "200px" }}>
          <div className="relative">
            <button
              ref={clinicButtonRef}
              onClick={(event) => {
                event.stopPropagation();
                setClinicMenuRect(calculateRect(clinicButtonRef.current));
                setClinicMenuOpen(!clinicMenuOpen);
              }}
              className={`w-full px-4 py-3 bg-white font-bold text-sm focus:outline-none hover:bg-gray-200 transition-colors flex items-center justify-between ${
                !selectedSite
                  ? "border-2 border-[#0dcaf0]"
                  : "border border-gray-200"
              }`}
            >
              <span
                className={`text-left truncate ${
                  !selectedSite ? "text-[#0dcaf0]" : "text-gray-900"
                }`}
              >
                {selectedSite || "Select Clinic..."}
              </span>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${
                  clinicMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {clinicMenuOpen &&
              clinicMenuRect &&
              createPortal(
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="bg-white border border-gray-200 shadow-lg z-[2000] max-h-60 overflow-y-auto"
                  style={{
                    position: "fixed",
                    top: clinicMenuRect.top,
                    left: clinicMenuRect.left,
                    width: clinicMenuRect.width,
                  }}
                >
                  {clinicOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSelectedSite(option.value);
                        setClinicMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left transition-colors text-sm ${
                        selectedSite === option.value
                          ? "bg-white text-gray-900 font-bold"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold"
                      }`}
                      style={{ fontFamily: "Jost, sans-serif" }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>,
                document.body,
              )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px" }}
            onMouseEnter={() => isDisabled && setShowLearningModeTooltip(true)}
            onMouseLeave={() => setShowLearningModeTooltip(false)}
          >
            <img src={starSrc} alt="Learning Mode" style={{ height: "20px", width: "20px" }} />
            <span className={`font-bold ${textColor}`}>Learning Mode</span>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div
                style={{
                  width: "44px",
                  height: "24px",
                  backgroundColor: showStudyMode ? "#0dcaf0" : "#d1d5db",
                  borderRadius: "9999px",
                  position: "relative",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  transition: "background-color 0.2s",
                  opacity: isDisabled ? 0.5 : 1,
                }}
                onClick={isDisabled ? undefined : handleLearningModeToggle}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    backgroundColor: "white",
                    borderRadius: "50%",
                    position: "absolute",
                    top: "3px",
                    left: showStudyMode ? "23px" : "3px",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
              {isDisabled && showLearningModeTooltip && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#1f2937",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                    zIndex: 1000,
                    pointerEvents: "none",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  }}
                >
                  {showStudyMode && learningEntriesCount > 0
                    ? "Please clear or upload all serial numbers before closing learning mode."
                    : "Please clear or upload all serial numbers before opening learning mode."}
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 0,
                      height: 0,
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderTop: "6px solid #1f2937",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
