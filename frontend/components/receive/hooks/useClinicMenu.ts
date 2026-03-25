import { useEffect, useRef, useState, useCallback } from "react";

export const useClinicMenu = () => {
  const [clinicMenuOpen, setClinicMenuOpen] = useState(false);
  const [clinicMenuRect, setClinicMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const clinicButtonRef = useRef<HTMLButtonElement | null>(null);

  const calculateRect = useCallback((el: HTMLButtonElement | null) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { top: rect.bottom, left: rect.left, width: rect.width };
  }, []);

  useEffect(() => {
    const closeMenus = () => {
      setClinicMenuOpen(false);
    };

    const updatePositions = () => {
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
  }, [calculateRect, clinicMenuOpen]);

  return {
    clinicMenuOpen,
    setClinicMenuOpen,
    clinicMenuRect,
    setClinicMenuRect,
    clinicButtonRef,
    calculateRect,
  };
};
