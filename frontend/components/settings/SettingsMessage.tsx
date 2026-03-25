import { AlertCircle, CheckCircle, X } from "lucide-react";

interface SettingsMessageProps {
  error: string | null;
  message: string | null;
  onDismiss: () => void;
}

export function SettingsMessage({ error, message, onDismiss }: SettingsMessageProps) {
  if (!error && !message) return null;

  return (
    <div
      className={`flex items-center gap-3 border p-4 text-sm font-bold transition-colors ${
        error
          ? "border-red-200 bg-red-50 text-red-600"
          : "border-green-200 bg-green-50 text-green-800"
      }`}
      style={{ fontFamily: "Jost, sans-serif" }}
    >
      {error ? (
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
      ) : (
        <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
      )}
      <span className="flex-1">{error || message}</span>
      <button
        onClick={onDismiss}
        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-black/5 rounded transition-colors"
        aria-label="Dismiss message"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
