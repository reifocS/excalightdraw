import { describe, expect, it, vi } from "vitest";
import { add, generateId, shuffle, sub } from "./math";

describe("add / sub", () => {
  it("adds and subtracts componentwise", () => {
    expect(add([1, 2], [3, 4])).toEqual([4, 6]);
    expect(sub([1, 2], [3, 4])).toEqual([-2, -2]);
  });

  it("ignores extra components", () => {
    expect(add([1, 2, 99], [3, 4, 99])).toEqual([4, 6]);
  });
});

describe("generateId", () => {
  it("returns a 9 character base36 id", () => {
    const id = generateId();
    expect(id).toHaveLength(9);
    expect(id).toMatch(/^[0-9a-z]{9}$/);
  });

  it("returns distinct ids across calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("shuffle", () => {
  it("keeps every element exactly once", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual(input);
  });

  it("does not mutate the input", () => {
    const input = [1, 2, 3];
    shuffle(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it("reverses the array when sort keys are descending", () => {
    const keys = [0.9, 0.5, 0.1];
    let i = 0;
    vi.spyOn(Math, "random").mockImplementation(() => keys[i++]);
    expect(shuffle(["a", "b", "c"])).toEqual(["c", "b", "a"]);
    vi.restoreAllMocks();
  });

  it("handles empty arrays", () => {
    expect(shuffle([])).toEqual([]);
  });
});
