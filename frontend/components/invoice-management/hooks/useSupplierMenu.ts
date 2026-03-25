import { useEffect, useRef, useState } from "react";

interface MenuRect {
  top: number;
  left: number;
  width: number;
}

export const useSupplierMenu = () => {
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false);
  const supplierButtonRef = useRef<HTMLButtonElement | null>(null);
  const [supplierMenuRect, setSupplierMenuRect] = useState<MenuRect | null>(null);

  const calculateRect = (el: HTMLButtonElement | null) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { top: rect.bottom, left: rect.left, width: rect.width };
  };

  useEffect(() => {
    const closeMenus = () => {
      setSupplierMenuOpen(false);
    };

    const updatePosition = () => {
      if (supplierMenuOpen) {
        setSupplierMenuRect(calculateRect(supplierButtonRef.current));
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenus();
      }
    };

    document.addEventListener("click", closeMenus);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("click", closeMenus);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [supplierMenuOpen]);

  return {
    supplierMenuOpen,
    setSupplierMenuOpen,
    supplierButtonRef,
    supplierMenuRect,
    setSupplierMenuRect,
    calculateRect,
  };
};
