import { describe, expect, it } from "vitest";
import Vec, { DOMVector, screenToCanvas } from "./vec";

describe("screenToCanvas", () => {
  it("converts a screen point into canvas space", () => {
    expect(screenToCanvas({ x: 100, y: 50 }, { x: 10, y: 5, z: 2 })).toEqual({
      x: 40,
      y: 20,
    });
  });
});

describe("Vec arithmetic", () => {
  it("negates, adds and subtracts", () => {
    expect(Vec.neg([1, -2])).toEqual([-1, 2]);
    expect(Vec.add([1, 2], [3, 4])).toEqual([4, 6]);
    expect(Vec.sub([1, 2], [3, 4])).toEqual([-2, -2]);
    expect(Vec.addScalar([1, 2], 3)).toEqual([4, 5]);
    expect(Vec.subScalar([1, 2], 3)).toEqual([-2, -1]);
  });

  it("multiplies and divides by scalars and vectors", () => {
    expect(Vec.mul([1, 2], 3)).toEqual([3, 6]);
    expect(Vec.mulV([1, 2], [3, 4])).toEqual([3, 8]);
    expect(Vec.div([6, 8], 2)).toEqual([3, 4]);
    expect(Vec.divV([6, 8], [3, 4])).toEqual([2, 2]);
  });

  it("returns the vector from A to B", () => {
    expect(Vec.vec([1, 1], [4, 5])).toEqual([3, 4]);
  });

  it("takes the absolute value componentwise", () => {
    expect(Vec.abs([-3, 4])).toEqual([3, 4]);
  });
});

describe("Vec.clamp", () => {
  it("clamps to a minimum only", () => {
    expect(Vec.clamp(-5, 0)).toBe(0);
    expect(Vec.clamp(5, 0)).toBe(5);
  });

  it("clamps to a range", () => {
    expect(Vec.clamp(15, 0, 10)).toBe(10);
    expect(Vec.clamp(-1, 0, 10)).toBe(0);
    expect(Vec.clamp(5, 0, 10)).toBe(5);
  });
});

describe("Vec products and lengths", () => {
  it("computes dot and cross products", () => {
    expect(Vec.dpr([1, 2], [3, 4])).toBe(11);
    expect(Vec.cpr([1, 0], [0, 1])).toBe(1);
    expect(Vec.cpr([0, 1], [1, 0])).toBe(-1);
  });

  it("computes lengths and distances", () => {
    expect(Vec.len([3, 4])).toBe(5);
    expect(Vec.len2([3, 4])).toBe(25);
    expect(Vec.dist([0, 0], [3, 4])).toBe(5);
    expect(Vec.dist2([0, 0], [3, 4])).toBe(25);
  });

  it("projects A over B", () => {
    expect(Vec.pry([3, 4], [1, 0])).toBe(3);
  });

  it("rotates a vector perpendicularly", () => {
    expect(Vec.per([1, 2])).toEqual([2, -1]);
  });

  it("normalizes vectors", () => {
    expect(Vec.uni([0, 5])).toEqual([0, 1]);
    expect(Vec.normalize([3, 4])).toEqual([0.6, 0.8]);
    expect(Vec.tangent([3, 4], [0, 0])).toEqual([0.6, 0.8]);
  });

  it("rescales a vector to a given length", () => {
    expect(Vec.rescale([3, 4], 10)).toEqual([6, 8]);
  });

  it("approximates distance direction with fastDist", () => {
    const [x, y] = Vec.fastDist([0, 0], [3, 0]);
    expect(x).toBeCloseTo(1, 1);
    expect(y).toBe(0);
  });
});

describe("Vec angles", () => {
  it("computes the angle between two vectors", () => {
    expect(Vec.ang([1, 0], [0, 1])).toBeCloseTo(Math.PI / 2);
  });

  it("computes the angle from A to B", () => {
    expect(Vec.angle([0, 0], [0, 1])).toBeCloseTo(Math.PI / 2);
  });

  it("computes the angle between three points", () => {
    expect(Vec.ang3([1, 0], [0, 0], [0, 1])).toBeCloseTo(Math.PI / 2);
  });
});

describe("Vec rotation and interpolation", () => {
  it("rotates around the origin", () => {
    const [x, y] = Vec.rot([1, 0], Math.PI / 2);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });

  it("rotates around a center point", () => {
    const [x, y] = Vec.rotWith([2, 1], [1, 1], Math.PI / 2);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(2);
  });

  it("returns the same vector when the rotation is zero", () => {
    const point = [2, 3];
    expect(Vec.rotWith(point, [1, 1], 0)).toBe(point);
  });

  it("finds the midpoint and interpolates", () => {
    expect(Vec.med([0, 0], [4, 6])).toEqual([2, 3]);
    expect(Vec.lrp([0, 0], [10, 20], 0.5)).toEqual([5, 10]);
  });

  it("interpolates between A and B over a value range", () => {
    expect(Vec.int([0, 0], [10, 10], 0, 10)).toEqual([10, 10]);
  });

  it("nudges a point towards another by a distance", () => {
    expect(Vec.nudge([0, 0], [10, 0], 3)).toEqual([3, 0]);
  });
});

describe("Vec comparisons and rounding", () => {
  it("compares vectors", () => {
    expect(Vec.isEqual([1, 2], [1, 2])).toBe(true);
    expect(Vec.isEqual([1, 2], [1, 3])).toBe(false);
  });

  it("detects orientation", () => {
    expect(Vec.isLeft([0, 0], [1, 1], [2, 0])).toBeLessThan(0);
    expect(Vec.clockwise([0, 0], [1, -1], [2, 0])).toBe(true);
    expect(Vec.clockwise([0, 0], [1, 1], [2, 0])).toBe(false);
  });

  it("rounds to a precision", () => {
    expect(Vec.round([1.234567, 2.345678], 3)).toEqual([1.23, 2.35]);
    expect(Vec.toPrecision([1.23456, 2.34567], 3)).toEqual([1.23, 2.35]);
  });
});

describe("Vec line helpers", () => {
  it("finds the nearest point on an infinite line", () => {
    expect(Vec.nearestPointOnLineThroughPoint([0, 0], [1, 0], [5, 5])).toEqual([
      5, 0,
    ]);
    expect(Vec.distanceToLineThroughPoint([0, 0], [1, 0], [5, 5])).toBe(5);
  });

  it("clamps to the segment ends when the point projects outside", () => {
    expect(Vec.nearestPointOnLineSegment([0, 0], [10, 0], [20, 0])).toEqual([
      10, 0,
    ]);
    expect(Vec.nearestPointOnLineSegment([0, 0], [10, 0], [-20, 0])).toEqual([
      0, 0,
    ]);
  });

  it("keeps the projected point when unclamped", () => {
    expect(
      Vec.nearestPointOnLineSegment([0, 0], [10, 0], [20, 0], false)
    ).toEqual([20, 0]);
  });

  it("measures the distance to a segment", () => {
    expect(Vec.distanceToLineSegment([0, 0], [10, 0], [5, 4])).toBe(4);
  });
});

describe("DOMVector", () => {
  it("computes the diagonal length", () => {
    expect(new DOMVector(0, 0, 3, 4).getDiagonalLength()).toBe(5);
  });

  it("adds vectors componentwise", () => {
    const sum = new DOMVector(1, 2, 3, 4).add(new DOMVector(10, 20, 30, 40));
    expect([sum.x, sum.y, sum.magnitudeX, sum.magnitudeY]).toEqual([
      11, 22, 33, 44,
    ]);
  });

  it("clamps magnitudes to the given bounds", () => {
    const clamped = new DOMVector(10, 10, 500, 500).clamp({
      width: 100,
      height: 60,
    } as DOMRect);
    expect([clamped.magnitudeX, clamped.magnitudeY]).toEqual([90, 50]);
  });
});
