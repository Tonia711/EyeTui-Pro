import { useCallback, useEffect, useState } from "react";
import { type CompanyRow, type LensData, type SiteRow } from "../types";

interface UseInventoryDataParams {
  apiBaseUrl: string;
  referenceDataEvent: string;
  isActive?: boolean;
  refreshKey?: number;
}

export const useInventoryData = ({
  apiBaseUrl,
  referenceDataEvent,
  isActive,
  refreshKey,
}: UseInventoryDataParams) => {
  const [lensData, setLensData] = useState<LensData[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLensData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/lens`);
      if (!response.ok) {
        throw new Error("Failed to fetch lens data");
      }
      const data: LensData[] = await response.json();
      setLensData(data);
    } catch (error) {
      console.error("Error fetching lens data:", error);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const fetchCompanyData = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/company`);
      if (!response.ok) {
        throw new Error("Failed to fetch company data");
      }
      const data: CompanyRow[] = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error("Error fetching company data:", error);
    }
  }, [apiBaseUrl]);

  const fetchSiteData = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/site`);
      if (!response.ok) {
        throw new Error("Failed to fetch site data");
      }
      const data: SiteRow[] = await response.json();
      setSites(data);
    } catch (error) {
      console.error("Error fetching site data:", error);
    }
  }, [apiBaseUrl]);

  const moveLensToClinic = useCallback(
    async (lensId: number, newClinic: string) => {
      const cleaned = newClinic.trim();
      if (!cleaned) return;

      try {
        const res = await fetch(
          `${apiBaseUrl}/lens/${lensId}/move-to-clinic`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ new_clinic: cleaned }),
          },
        );
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const updated: LensData = await res.json();
        setLensData((prev) =>
          prev.map((row) => (row.id === lensId ? updated : row)),
        );
      } catch (error) {
        console.error("Error moving lens to clinic:", error);
      }
    },
    [apiBaseUrl],
  );

  const deleteLens = useCallback(
    async (lensId: number) => {
      try {
        const response = await fetch(`${apiBaseUrl}/lens/${lensId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Failed to delete lens");
        }
        fetchLensData();
      } catch (error) {
        console.error("Error deleting lens:", error);
      }
    },
    [apiBaseUrl, fetchLensData],
  );

  useEffect(() => {
    fetchLensData();
    fetchCompanyData();
    fetchSiteData();
  }, [fetchCompanyData, fetchLensData, fetchSiteData]);

  // Keep reference data (companies / clinics) in sync with Settings changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onReferenceDataChanged = () => {
      fetchSiteData();
      // Clinic names are part of the lens payload (site/move_from_clinic), so refresh lenses too.
      fetchLensData();
    };
    window.addEventListener(referenceDataEvent, onReferenceDataChanged);
    return () => {
      window.removeEventListener(referenceDataEvent, onReferenceDataChanged);
    };
  }, [fetchLensData, fetchSiteData, referenceDataEvent]);

  // Re-fetch when the Inventory tab becomes active or when a refresh key changes
  useEffect(() => {
    if (isActive) {
      fetchLensData();
    }
  }, [fetchLensData, isActive, refreshKey]);

  return {
    lensData,
    companies,
    sites,
    loading,
    fetchLensData,
    moveLensToClinic,
    deleteLens,
  };
};
