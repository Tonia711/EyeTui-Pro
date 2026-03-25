import { useEffect, useState } from "react";
import { extractApiErrorMessage } from "../utils";
import type { CompanyRow, SupplierRow, SiteRow, LensTypeRow } from "../types";

interface UseSettingsDataParams {
  apiBaseUrl: string;
  referenceDataEvent: string;
}

export const useSettingsData = ({
  apiBaseUrl,
  referenceDataEvent,
}: UseSettingsDataParams) => {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [types, setTypes] = useState<LensTypeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notifyReferenceDataChanged = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(referenceDataEvent));
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const [companiesRes, suppliersRes, sitesRes, typesRes] = await Promise.all([
        fetch(`${apiBaseUrl}/company`),
        fetch(`${apiBaseUrl}/supplier`),
        fetch(`${apiBaseUrl}/site`),
        fetch(`${apiBaseUrl}/lens-type`),
      ]);
      if (
        !companiesRes.ok ||
        !suppliersRes.ok ||
        !sitesRes.ok ||
        !typesRes.ok
      ) {
        throw new Error("Failed to load settings data");
      }
      setCompanies((await companiesRes.json()) as CompanyRow[]);
      setSuppliers((await suppliersRes.json()) as SupplierRow[]);
      setSites((await sitesRes.json()) as SiteRow[]);
      setTypes((await typesRes.json()) as LensTypeRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleCreateCompany = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/company`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create company");
      }
      setMessage("Company created.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    }
  };

  const handleCreateSupplier = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create supplier");
      }
      setMessage("Supplier created.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create supplier");
    }
  };

  const handleCreateSite = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/site`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create site");
      }
      setMessage("Site created.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create site");
    }
  };

  const handleCreateType = async (name: string, companyId: string) => {
    const trimmed = name.trim();
    if (!trimmed || !companyId) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/lens-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, company_id: Number(companyId) }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create type");
      }
      setMessage("Type created.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create type");
    }
  };

  const handleUpdateCompany = async (companyId: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/company/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update company");
      }
      setMessage("Company updated.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update company");
    }
  };

  const handleUpdateSupplier = async (supplierId: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/supplier/${supplierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update supplier");
      }
      setMessage("Supplier updated.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update supplier");
    }
  };

  const handleUpdateSite = async (siteId: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/site/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update site");
      }
      setMessage("Site updated.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update site");
    }
  };

  const handleUpdateType = async (
    typeId: number,
    name: string,
    companyId: string,
  ) => {
    const trimmed = name.trim();
    if (!trimmed || !companyId) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/lens-type/${typeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          company_id: Number(companyId),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update type");
      }
      setMessage("Type updated.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update type");
    }
  };

  const handleDeleteCompany = async (companyId: number) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/company/${companyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        const apiMessage = extractApiErrorMessage(text);
        if (apiMessage === "Company is in use") {
          throw new Error("Company is in use, delete failed.");
        }
        throw new Error(apiMessage || "Failed to delete company");
      }
      setMessage("Company deleted.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete company");
    }
  };

  const handleDeleteSupplier = async (supplierId: number) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/supplier/${supplierId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        const apiMessage = extractApiErrorMessage(text);
        if (apiMessage === "Supplier is in use") {
          throw new Error("Supplier is in use, delete failed.");
        }
        throw new Error(apiMessage || "Failed to delete supplier");
      }
      setMessage("Supplier deleted.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete supplier");
    }
  };

  const handleDeleteSite = async (siteId: number) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/site/${siteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        const apiMessage = extractApiErrorMessage(text);
        if (apiMessage === "Site is in use") {
          throw new Error("Clinic is in use, delete failed.");
        }
        throw new Error(apiMessage || "Failed to delete site");
      }
      setMessage("Site deleted.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete site");
    }
  };

  const handleDeleteType = async (typeId: number) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/lens-type/${typeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        const apiMessage = extractApiErrorMessage(text);
        if (apiMessage === "Type is in use") {
          throw new Error("Type is in use, delete failed.");
        }
        throw new Error(apiMessage || "Failed to delete type");
      }
      const payload = (await res.json()) as { deleted?: boolean };
      if (!payload?.deleted) {
        throw new Error("Failed to delete type");
      }
      setMessage("Type deleted.");
      refreshAll();
      notifyReferenceDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete type");
    }
  };

  return {
    companies,
    suppliers,
    sites,
    types,
    loading,
    message,
    error,
    setMessage,
    setError,
    refreshAll,
    handleCreateCompany,
    handleCreateSupplier,
    handleCreateSite,
    handleCreateType,
    handleUpdateCompany,
    handleUpdateSupplier,
    handleUpdateSite,
    handleUpdateType,
    handleDeleteCompany,
    handleDeleteSupplier,
    handleDeleteSite,
    handleDeleteType,
  };
};
