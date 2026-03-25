import { describe, expect, it, vi } from "vitest";
import { isValidDate, parseDateValue } from "@/components/receive/utils/date";

describe("receive/utils/date", () => {
  describe("parseDateValue", () => {
    it("returns undefined for empty values", () => {
      expect(parseDateValue(undefined)).toBeUndefined();
      expect(parseDateValue(null)).toBeUndefined();
      expect(parseDateValue("")).toBeUndefined();
    });

    it("parses Excel numeric dates", () => {
      // Excel epoch in code is 1899-12-30; day 1 => 1899-12-31
      expect(parseDateValue(1)).toBe("1899-12-31");
      expect(parseDateValue(2)).toBe("1900-01-01");
    });

    it("parses common dd/mm/yyyy formats into ISO yyyy-mm-dd", () => {
      expect(parseDateValue("15/12/2025")).toBe("2025-12-15");
      expect(parseDateValue("15-12-25")).toBe("2025-12-15");
      expect(parseDateValue("15.12.2025")).toBe("2025-12-15");
    });

    it("falls back to Date parsing when needed", () => {
      expect(parseDateValue("2025-01-02")).toBe("2025-01-02");
    });

    it("returns undefined for unparseable strings", () => {
      expect(parseDateValue("not a date")).toBeUndefined();
    });
  });

  describe("isValidDate", () => {
    it("returns true for today and past dates; false for future dates", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 11, 15, 12, 0, 0)); // local time

      expect(isValidDate("2025-12-15")).toBe(true);
      expect(isValidDate("2025-12-14")).toBe(true);
      expect(isValidDate("2025-12-16")).toBe(false);
      expect(isValidDate("")).toBe(false);

      vi.useRealTimers();
    });
  });
});


