import { describe, expect, it } from "vitest";
import {
  doesShapeIntersectBounds,
  getAdjustedPointForFixedRotatedTopLeft,
  getShapePageBounds,
  getShapeRotationTransform,
} from "./shapeTransforms";
import { Shape } from "../../types/canvas";

describe("shapeTransforms", () => {
  it("keeps the point unchanged when rotation is zero", () => {
    expect(
      getAdjustedPointForFixedRotatedTopLeft(
        [100, 50],
        { width: 40, height: 20 },
        { width: 90, height: 20 },
        0
      )
    ).toEqual([100, 50]);
  });

  it("adjusts point to keep the rotated top-left stable as text width changes", () => {
    expect(
      getAdjustedPointForFixedRotatedTopLeft(
        [100, 50],
        { width: 10, height: 10 },
        { width: 20, height: 10 },
        90
      )
    ).toEqual([95, 55]);
  });

  it("builds a text rotation transform from measured text bounds", () => {
    const shape: Shape = {
      id: "text-1",
      type: "text",
      point: [10, 20],
      size: [0, 0],
      srcIndex: 0,
      text: "AB",
      fontSize: 16,
      rotation: 45,
    };

    const transform = getShapeRotationTransform(shape);
    expect(transform).toMatch(/^rotate\(45 /);
  });

  it("computes the visual page bounds of a rotated shape", () => {
    const shape: Shape = {
      id: "rectangle-1",
      type: "rectangle",
      point: [100, 50],
      size: [80, 20],
      srcIndex: 0,
      rotation: 90,
    };

    expect(getShapePageBounds(shape)).toEqual({
      left: 130,
      right: 150,
      top: 20,
      bottom: 100,
      centerX: 140,
      centerY: 60,
      width: 20,
      height: 80,
    });
  });

  it("uses the rotated outline rather than its loose bounding box for selection", () => {
    const shape: Shape = {
      id: "rectangle-1",
      type: "rectangle",
      point: [0, 0],
      size: [100, 10],
      srcIndex: 0,
      rotation: 45,
    };

    expect(
      doesShapeIntersectBounds(shape, { x: 80, y: -34, width: 5, height: 5 })
    ).toBe(false);
    expect(
      doesShapeIntersectBounds(shape, { x: 45, y: 0, width: 10, height: 10 })
    ).toBe(true);
  });
});
