import { describe, expect, it } from "vitest";
import { formatDate } from "@/components/inventory/utils";

describe("inventory/utils", () => {
  it("formatDate returns '-' for empty and dd/mm/yyyy for valid input", () => {
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate(null)).toBe("-");
    expect(formatDate("2025-01-02T00:00:00.000Z")).toBe("02/01/2025");
  });
});


