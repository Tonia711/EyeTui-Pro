import { describe, expect, it } from "vitest";
import { cn } from "@/components/ui/utils";

describe("ui/utils", () => {
  it("cn merges classnames", () => {
    expect(cn("a", false && "b", "c")).toContain("a");
    expect(cn("a", false && "b", "c")).toContain("c");
  });
});


