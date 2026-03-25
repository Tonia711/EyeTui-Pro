import { describe, expect, it } from "vitest";
import { buildTypeMappings } from "@/components/receive/utils/mappings";

describe("receive/utils/mappings", () => {
  it("buildTypeMappings sorts options and creates type variants mapping", () => {
    const companies = [
      { id: 2, name: "B Company" },
      { id: 1, name: "A Company" },
    ];
    const types = [
      { id: 10, name: "DEN00V", company_id: 1, company_name: null },
      { id: 11, name: "Other", company_id: 2, company_name: "B Company" },
    ];

    const result = buildTypeMappings(companies, types);

    expect(result.companyOptions.map((o) => o.value)).toEqual([
      "A Company",
      "B Company",
    ]);
    expect(result.typeOptions.map((o) => o.value)).toEqual(["DEN00V", "Other"]);

    // "Other" should not create variants
    expect(result.typeToCompanyMap["Other"]).toBeUndefined();

    // Variants for DEN00V should exist
    expect(result.typeToCompanyMap["DEN00V"]).toBe("A Company");
    expect(result.typeToCompanyMap["den00v"]).toBe("A Company");
  });
});


