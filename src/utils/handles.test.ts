import { describe, expect, it } from "vitest";
import { getEdgesOfRectange, getHandlesOfArrow } from "./handles";
import { Shape } from "../types/canvas";

function makeShape(point: number[], size: number[]): Shape {
  return { id: "s", point, size, type: "rectangle", srcIndex: 0 };
}

describe("getEdgesOfRectange", () => {
  it("returns corners clockwise starting from the top-left", () => {
    expect(getEdgesOfRectange(makeShape([10, 20], [30, 40]))).toEqual([
      [10, 20],
      [40, 20],
      [40, 60],
      [10, 60],
    ]);
  });

  it("supports negative sizes", () => {
    expect(getEdgesOfRectange(makeShape([0, 0], [-10, -5]))).toEqual([
      [0, 0],
      [-10, 0],
      [-10, -5],
      [0, -5],
    ]);
  });
});

describe("getHandlesOfArrow", () => {
  it("returns the start and end points of the arrow", () => {
    expect(getHandlesOfArrow(makeShape([5, 5], [15, 25]))).toEqual([
      [5, 5],
      [20, 30],
    ]);
  });
});
