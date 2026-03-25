import { describe, expect, it } from "vitest";
import { extractApiErrorMessage } from "@/components/settings/utils";

describe("settings/utils", () => {
  it("extractApiErrorMessage returns empty string for blank input", () => {
    expect(extractApiErrorMessage("")).toBe("");
    expect(extractApiErrorMessage("   ")).toBe("");
  });

  it('extractApiErrorMessage extracts {"detail": "..."} when present', () => {
    expect(extractApiErrorMessage('{"detail":"Oops"}')).toBe("Oops");
    expect(extractApiErrorMessage('  {"detail":"Bad Request"}  ')).toBe(
      "Bad Request",
    );
  });

  it("extractApiErrorMessage falls back to trimmed raw string", () => {
    expect(extractApiErrorMessage(" plain error ")).toBe("plain error");
    expect(extractApiErrorMessage('{"detail":123}')).toBe('{"detail":123}');
    expect(extractApiErrorMessage("{not json")).toBe("{not json");
  });
});


