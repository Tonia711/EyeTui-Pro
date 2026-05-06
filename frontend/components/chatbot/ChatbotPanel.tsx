import { FormEvent, useState } from "react";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:8000";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  text: string;
  sources?: Array<{ source_type: string; source_value: string }>;
}

interface ChatAskResponse {
  route: string;
  intent: string;
  answer: string;
  data: Record<string, unknown>;
  sources: Array<{ source_type: string; source_value: string }>;
}

interface ChatbotPanelProps {
  title?: string;
  compact?: boolean;
}

export function ChatbotPanel({
  title = "Business Chatbot",
  compact = false,
}: ChatbotPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text:
        "Hello, I can answer system usage / troubleshooting questions, and I can also help with inventory overview, invoice details, and unmatched reconciliation status.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setQuestion("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!response.ok) {
        throw new Error("Chat request failed");
      }
      const data: ChatAskResponse = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      console.error("Chat request error:", err);
      setError("Request failed. Please try again later.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, the chatbot service is temporarily unavailable. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full space-y-4">
      <h1 className="text-xl font-bold text-black">{title}</h1>
      <p className="text-sm text-gray-600">
        Example questions: Current inventory status, Invoice 9140481167 details, Unmatched reconciliation records, How to start the backend.
      </p>

      <div
        className={`overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 ${
          compact ? "h-[360px]" : "h-[520px]"
        }`}
      >
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {message.text}
                {message.role === "assistant" && message.sources?.length ? (
                  <div className="mt-2 border-t border-gray-200/80 pt-2 text-xs text-gray-500">
                    Sources: {message.sources.map((source) => source.source_value).join(", ")}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {isLoading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-700">
                Thinking...
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Type your question..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-black"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
