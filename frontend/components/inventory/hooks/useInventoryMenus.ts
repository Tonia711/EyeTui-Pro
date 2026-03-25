import { useEffect, useRef, useState } from "react";

interface MenuRect {
  top: number;
  left: number;
  width: number;
}

export const useInventoryMenus = () => {
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [clinicMenuOpen, setClinicMenuOpen] = useState(false);

  const companyButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusButtonRef = useRef<HTMLButtonElement | null>(null);
  const clinicButtonRef = useRef<HTMLButtonElement | null>(null);

  const [companyMenuRect, setCompanyMenuRect] = useState<MenuRect | null>(null);
  const [statusMenuRect, setStatusMenuRect] = useState<MenuRect | null>(null);
  const [clinicMenuRect, setClinicMenuRect] = useState<MenuRect | null>(null);

  const calculateRect = (el: HTMLButtonElement | null) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { top: rect.bottom, left: rect.left, width: rect.width };
  };

  useEffect(() => {
    const closeMenus = () => {
      setCompanyMenuOpen(false);
      setStatusMenuOpen(false);
      setClinicMenuOpen(false);
    };

    const updatePositions = () => {
      if (companyMenuOpen) {
        setCompanyMenuRect(calculateRect(companyButtonRef.current));
      }
      if (statusMenuOpen) {
        setStatusMenuRect(calculateRect(statusButtonRef.current));
      }
      if (clinicMenuOpen) {
        setClinicMenuRect(calculateRect(clinicButtonRef.current));
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenus();
      }
    };

    document.addEventListener("click", closeMenus);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", updatePositions, true);
    window.addEventListener("resize", updatePositions);
    return () => {
      document.removeEventListener("click", closeMenus);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", updatePositions, true);
      window.removeEventListener("resize", updatePositions);
    };
  }, [companyMenuOpen, statusMenuOpen, clinicMenuOpen]);

  return {
    companyMenuOpen,
    setCompanyMenuOpen,
    statusMenuOpen,
    setStatusMenuOpen,
    clinicMenuOpen,
    setClinicMenuOpen,
    companyButtonRef,
    statusButtonRef,
    clinicButtonRef,
    companyMenuRect,
    setCompanyMenuRect,
    statusMenuRect,
    setStatusMenuRect,
    clinicMenuRect,
    setClinicMenuRect,
    calculateRect,
  };
};
