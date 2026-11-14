import { describe, expect, it } from "vitest";
import { allResources } from "../../src/core/assets";

describe("allResources", () => {
  it("collects resources", () => {
    expect(allResources().length).toBeGreaterThan(0);
  });
});
