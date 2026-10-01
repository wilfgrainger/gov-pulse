import { describe, expect, it } from "vitest";
import { describeChange, describePercentageChange } from "@/app/lib/changeLanguage";

describe("describeChange", () => {
  it("distinguishes rises, falls, no change and unavailable values", () => {
    expect(describeChange(2.5)).toBe("rose");
    expect(describeChange(-2.5)).toBe("fell");
    expect(describeChange(0)).toBe("was unchanged");
    expect(describeChange(null)).toBe("unavailable");
  });

  it("uses absolute magnitudes and does not turn zero or missing values into falls", () => {
    expect(describePercentageChange(-0.6)).toBe("fell by 0.6%");
    expect(describePercentageChange(0)).toBe("was unchanged (0.0% growth)");
    expect(describePercentageChange(null)).toBe("change was unavailable");
  });
});
