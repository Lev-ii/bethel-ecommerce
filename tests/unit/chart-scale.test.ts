import { describe, expect, it } from "vitest";
import { compactAmount, delta, niceTicks } from "@/lib/admin/chart-scale";

describe("niceTicks", () => {
  it.each([
    [42000, [0, 20000, 40000, 60000]],
    [100, [0, 25, 50, 75, 100]],
    [7, [0, 2, 4, 6, 8]],
    [1_830_000, [0, 500000, 1000000, 1500000, 2000000]],
  ])("couvre %i avec des graduations rondes", (max, expected) => {
    expect(niceTicks(max)).toEqual(expected);
  });

  it("donne toujours un axe, meme sans donnee", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(Number.NaN)).toEqual([0, 1]);
  });

  it("atteint ou depasse toujours la valeur maximale", () => {
    for (const max of [1, 9, 11, 99, 101, 12345, 987654]) {
      expect(niceTicks(max).at(-1)!).toBeGreaterThanOrEqual(max);
    }
  });
});

describe("compactAmount", () => {
  it.each([
    [950, "950"],
    [12000, "12 k"],
    [12500, "12,5 k"],
    [1_500_000, "1,5 M"],
    [2_000_000, "2 M"],
  ])("abrege %i en %s", (value, expected) => {
    expect(compactAmount(value)).toBe(expected);
  });
});

describe("delta", () => {
  it("calcule une hausse et une baisse", () => {
    expect(delta(150, 100)).toEqual({ percent: 50, direction: "up" });
    expect(delta(75, 100)).toEqual({ percent: -25, direction: "down" });
  });

  it("ne divise jamais par zero", () => {
    expect(delta(500, 0)).toEqual({ percent: null, direction: "up" });
    expect(delta(0, 0)).toEqual({ percent: null, direction: "flat" });
  });

  it("signale une stabilite", () => {
    expect(delta(100, 100)).toEqual({ percent: 0, direction: "flat" });
  });
});
