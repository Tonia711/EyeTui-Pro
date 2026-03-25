import { useState } from "react";
import { ClipboardList, FileText, List, Package, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import landing from "../assets/landing.png";

export function LandingPage() {
  const [isFlippedReceive, setIsFlippedReceive] = useState(false);
  const [isFlippedUsage, setIsFlippedUsage] = useState(false);
  const [isFlippedInventory, setIsFlippedInventory] = useState(false);
  const [isFlippedInvoiceList, setIsFlippedInvoiceList] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="h-screen overflow-hidden bg-black flex flex-col fixed inset-0">
      <div className="w-full flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-end justify-between">
            <div className="flex items-end gap-4">
              <img src={landing} alt="Auckland Eye" style={{ height: "45px", width: "auto" }} />
              <h1
                className="text-2xl font-black"
                style={{ fontFamily: "Jost, sans-serif", color: "#1A62AA", marginBottom: "-6px" }}
              >
                Auckland Eye IOL Tracking and Reconciliation Platform
              </h1>
            </div>
            <button
              onClick={() => navigate("/settings")}
              className="px-6 transition-colors"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5 text-gray-400 hover:text-gray-200" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex items-center">
        <div className="max-w-7xl mx-auto px-4 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div
              onClick={() => {
                if (isFlippedReceive) {
                  setIsFlippedReceive(false);
                } else {
                  navigate("/receiving");
                }
              }}
              className="bg-transparent rounded-3xl text-left cursor-pointer"
              style={{ perspective: "1000px", minHeight: "320px" }}
            >
              <div
                className="relative w-full h-full transition-transform duration-700"
                style={{
                  transformStyle: "preserve-3d",
                  transform: isFlippedReceive ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                <div
                  className="absolute inset-0 bg-white hover:bg-gray-50 rounded-3xl p-12 shadow-lg hover:shadow-2xl transition-all flex flex-col"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 shrink-0 rounded-full bg-black flex items-center justify-center">
                      <Package className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900" style={{ fontFamily: "Jost, sans-serif" }}>
                      Lens Receiving
                    </h2>
                  </div>
                  <p className="text-gray-600 text-lg mb-6">
                    Receive and register lenses using barcode scanning or file upload
                  </p>
                  <div className="mt-auto">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsFlippedReceive(true);
                      }}
                      className="text-gray-600 hover:text-gray-900 text-sm underline transition-colors"
                    >
                      Learn more
                    </button>
                  </div>
                </div>
                <div
                  className="absolute inset-0 bg-white rounded-3xl p-10 shadow-2xl flex flex-col"
                  style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
                >
                  <div className="text-gray-600 text-base space-y-3 leading-relaxed">
                    <p>Scan lens barcodes using computer camera or scanner, or upload an Excel file to record received lenses.</p>
                    <p>Select a clinic before uploading so lenses are assigned correctly.</p>
                    <p>If a new lens type is not recognized correctly, turn on Learning Mode to enter details manually and help the system learn for future scans.</p>
                    <p>New companies or lens types should be added in Settings first.</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              onClick={() => {
                if (isFlippedUsage) {
                  setIsFlippedUsage(false);
                } else {
                  navigate("/reconciliation");
                }
              }}
              className="bg-transparent rounded-3xl text-left cursor-pointer"
              style={{ perspective: "1000px", minHeight: "320px" }}
            >
              <div
                className="relative w-full h-full transition-transform duration-700"
                style={{
                  transformStyle: "preserve-3d",
                  transform: isFlippedUsage ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                <div
                  className="absolute inset-0 bg-white hover:bg-gray-50 rounded-3xl p-12 shadow-lg hover:shadow-2xl transition-all flex flex-col"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 shrink-0 rounded-full bg-black flex items-center justify-center">
                      <FileText className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900" style={{ fontFamily: "Jost, sans-serif" }}>
                      Lens Usage & Invoice Reconciliation
                    </h2>
                  </div>
                  <p className="text-gray-600 text-lg mb-6">
                    Upload used lens records or supplier invoice PDFs for reconciliation
                  </p>
                  <div className="mt-auto">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsFlippedUsage(true);
                      }}
                      className="text-gray-600 hover:text-gray-900 text-sm underline transition-colors"
                    >
                      Learn more
                    </button>
                  </div>
                </div>
                <div
                  className="absolute inset-0 bg-white rounded-3xl p-10 shadow-2xl flex flex-col"
                  style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
                >
                  <div className="text-gray-600 text-base space-y-3 leading-relaxed">
                    <p>Upload used lens Excel files or supplier invoice PDFs. These options are often used together but can be completed independently.</p>
                    <p>Invoice reconciliation results can be reviewed and exported.</p>
                    <p>If a new invoice format is not recognized correctly, click "Edit/Learn" to enter details manually and the system will learn for future scans.</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              onClick={() => {
                if (isFlippedInventory) {
                  setIsFlippedInventory(false);
                } else {
                  navigate("/inventory");
                }
              }}
              className="bg-transparent rounded-3xl text-left cursor-pointer"
              style={{ perspective: "1000px", minHeight: "320px" }}
            >
              <div
                className="relative w-full h-full transition-transform duration-700"
                style={{
                  transformStyle: "preserve-3d",
                  transform: isFlippedInventory ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                <div
                  className="absolute inset-0 bg-white hover:bg-gray-50 rounded-3xl p-12 shadow-lg hover:shadow-2xl transition-all flex flex-col"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 shrink-0 rounded-full bg-black flex items-center justify-center">
                      <ClipboardList className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900" style={{ fontFamily: "Jost, sans-serif" }}>
                      Lens Inventory
                    </h2>
                  </div>
                  <p className="text-gray-600 text-lg mb-6">
                    View lens inventory across all clinics with filtering options
                  </p>
                  <div className="mt-auto">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsFlippedInventory(true);
                      }}
                      className="text-gray-600 hover:text-gray-900 text-sm underline transition-colors"
                    >
                      Learn more
                    </button>
                  </div>
                </div>
                <div
                  className="absolute inset-0 bg-white rounded-3xl p-10 shadow-2xl flex flex-col"
                  style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
                >
                  <div className="text-gray-600 text-base space-y-3 leading-relaxed">
                    <p>Search by serial number or filter by lens type, power, company, status, and clinic.</p>
                    <p>Lens status includes Received, Used, and Invoiced. Invoiced lenses are hidden by default but can be shown using the status filter.</p>
                    <p>Lens transfers between clinics can also be recorded here.</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              onClick={() => {
                if (isFlippedInvoiceList) {
                  setIsFlippedInvoiceList(false);
                } else {
                  navigate("/invoices");
                }
              }}
              className="bg-transparent rounded-3xl text-left cursor-pointer"
              style={{ perspective: "1000px", minHeight: "320px" }}
            >
              <div
                className="relative w-full h-full transition-transform duration-700"
                style={{
                  transformStyle: "preserve-3d",
                  transform: isFlippedInvoiceList ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                <div
                  className="absolute inset-0 bg-white hover:bg-gray-50 rounded-3xl p-12 shadow-lg hover:shadow-2xl transition-all flex flex-col"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 shrink-0 rounded-full bg-black flex items-center justify-center">
                      <List className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900" style={{ fontFamily: "Jost, sans-serif" }}>
                      Invoice List
                    </h2>
                  </div>
                  <p className="text-gray-600 text-lg mb-6">
                    Browse and search all uploaded invoices
                  </p>
                  <div className="mt-auto">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsFlippedInvoiceList(true);
                      }}
                      className="text-gray-600 hover:text-gray-900 text-sm underline transition-colors"
                    >
                      Learn more
                    </button>
                  </div>
                </div>
                <div
                  className="absolute inset-0 bg-white rounded-3xl p-10 shadow-2xl flex flex-col"
                  style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
                >
                  <div className="text-gray-600 text-base space-y-3 leading-relaxed">
                    <p>View all uploaded invoices in one place.</p>
                    <p>Filter invoices by date range or supplier, and search by invoice number or lens serial number.</p>
                    <p>If a lens listed on an invoice has not been used, its serial number will be highlighted in red in the list.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
