import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { Settings } from "lucide-react";
import landing from "../assets/landing.png";
import { ChatbotPanel } from "../components/chatbot/ChatbotPanel";

const navLinkBaseClass =
  "h-[45px] px-6 pb-1 flex items-end font-bold transition-colors";

export function AppLayout() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-black">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-end justify-between">
            <div className="flex items-end gap-4 flex-1">
              <Link to="/" className="flex items-end h-[45px] cursor-pointer" aria-label="Go to landing page">
                <img src={landing} alt="Landing" style={{ height: "45px", width: "auto" }} />
              </Link>
              <div className="flex items-end gap-4 ml-auto">
                <NavLink
                  to="/receiving"
                  className={({ isActive }) =>
                    `${navLinkBaseClass} ${isActive ? "text-white font-black" : "text-gray-400 hover:text-gray-200"}`
                  }
                >
                  Lens Receiving
                </NavLink>
                <NavLink
                  to="/reconciliation"
                  className={({ isActive }) =>
                    `${navLinkBaseClass} ${isActive ? "text-white font-black" : "text-gray-400 hover:text-gray-200"}`
                  }
                >
                  Lens Usage & Invoice Reconciliation
                </NavLink>
                <NavLink
                  to="/inventory"
                  className={({ isActive }) =>
                    `${navLinkBaseClass} ${isActive ? "text-white font-black" : "text-gray-400 hover:text-gray-200"}`
                  }
                >
                  Lens Inventory
                </NavLink>
                <NavLink
                  to="/invoices"
                  className={({ isActive }) =>
                    `${navLinkBaseClass} ${isActive ? "text-white font-black" : "text-gray-400 hover:text-gray-200"}`
                  }
                >
                  Invoice List
                </NavLink>
                <NavLink
                  to="/chatbot"
                  className={({ isActive }) =>
                    `${navLinkBaseClass} ${isActive ? "text-white font-black" : "text-gray-400 hover:text-gray-200"}`
                  }
                >
                  AI Chatbot
                </NavLink>
              </div>
            </div>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `h-[45px] px-2 pb-1 flex items-end transition-colors ${
                  isActive ? "text-white" : "text-gray-400 hover:text-gray-200"
                }`
              }
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </NavLink>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="min-h-[800px] pb-8">
          <Outlet />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setChatOpen((open) => !open)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-gray-800"
      >
        {chatOpen ? "Close chat" : "AI Chat"}
      </button>

      {chatOpen ? (
        <div className="fixed bottom-20 right-6 z-40 w-[380px] rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
          <ChatbotPanel title="AI Chatbot" compact />
        </div>
      ) : null}
    </div>
  );
}
