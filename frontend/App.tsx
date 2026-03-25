import React, { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { UsageAndInvoicePanel } from "./components/UsageAndInvoicePanel";
import { LensInventoryPanel } from "./components/LensInventoryPanel";
import { InvoiceManagementPanel } from "./components/InvoiceManagementPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { AppLayout } from "./layouts/AppLayout";
import { LandingPage } from "./pages/LandingPage";
import { ReceivingPage } from "./pages/ReceivingPage";

export default function App() {
  const [selectedClinic, setSelectedClinic] = useState("All Clinics");
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppLayout />}>
        <Route
          path="receiving"
          element={
            <ReceivingPage
              onUploadSuccess={() => setInventoryRefreshKey((key) => key + 1)}
            />
          }
        />
        <Route path="reconciliation" element={<UsageAndInvoicePanel />} />
        <Route
          path="inventory"
          element={
            <LensInventoryPanel
              selectedClinic={selectedClinic}
              onClinicChange={setSelectedClinic}
              refreshKey={inventoryRefreshKey}
              isActive
            />
          }
        />
        <Route
          path="invoices"
          element={<InvoiceManagementPanel isActive />}
        />
        <Route path="settings" element={<SettingsPanel />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
