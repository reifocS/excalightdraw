import { describe, expect, it } from "vitest";
import {
  addPoints,
  clampScaleMagnitude,
  getAngleDistance,
  getBoxCorners,
  getPointerAngleFromCenter,
  getPointsExtent,
  normalizeAngle,
  normalizeAngleDelta,
  rotatePoint,
  rotateVector,
  subtractPoints,
} from "./geometry";

describe("geometry", () => {
  it("adds and subtracts points", () => {
    expect(addPoints([1, 2], [3, 4])).toEqual([4, 6]);
    expect(subtractPoints([1, 2], [3, 4])).toEqual([-2, -2]);
  });

  it("rotates vectors around the origin", () => {
    expect(rotateVector([1, 0], 0)).toEqual([1, 0]);
    const [x, y] = rotateVector([1, 0], 90);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });

  it("rotates points around a center", () => {
    const [x, y] = rotatePoint([2, 1], [1, 1], 180);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });

  it("normalizes angles and deltas", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngleDelta(270)).toBe(-90);
    expect(normalizeAngleDelta(-270)).toBe(90);
    expect(getAngleDistance(350, 10)).toBe(20);
  });

  it("computes pointer angle relative to a center", () => {
    expect(getPointerAngleFromCenter([0, 0], [0, -1])).toBeCloseTo(0);
    expect(getPointerAngleFromCenter([0, 0], [1, 0])).toBeCloseTo(90);
  });

  it("computes box corners and extents", () => {
    const corners = getBoxCorners({ x: 1, y: 2, width: 3, height: 4 });
    expect(corners).toEqual([
      [1, 2],
      [4, 2],
      [4, 6],
      [1, 6],
    ]);
    expect(getPointsExtent(corners)).toEqual({
      left: 1,
      right: 4,
      top: 2,
      bottom: 6,
    });
  });

  it("clamps scale magnitude while keeping sign", () => {
    expect(clampScaleMagnitude(0.01, 0.1)).toBeCloseTo(0.1);
    expect(clampScaleMagnitude(-0.01, 0.1)).toBeCloseTo(-0.1);
    expect(clampScaleMagnitude(2, 0.1)).toBe(2);
  });
});
