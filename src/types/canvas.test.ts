import { describe, expect, it } from "vitest";
import { Shape, flipShape, intersect, rotateShape } from "./canvas";

const shape: Shape = {
  id: "s1",
  point: [0, 0],
  size: [10, 10],
  type: "image",
  srcIndex: 0,
};

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
  } as DOMRect;
}

describe("rotateShape", () => {
  it("accumulates rotation without mutating the shape", () => {
    const rotated = rotateShape(shape, 90);
    expect(rotated.rotation).toBe(90);
    expect(rotateShape(rotated, -90).rotation).toBe(0);
    expect(shape.rotation).toBeUndefined();
  });
});

describe("flipShape", () => {
  it("toggles the flipped flag", () => {
    const flipped = flipShape(shape);
    expect(flipped.isFlipped).toBe(true);
    expect(flipShape(flipped).isFlipped).toBe(false);
  });
});

describe("intersect", () => {
  it("detects overlapping rectangles", () => {
    expect(intersect(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true);
  });

  it("treats touching edges as intersecting", () => {
    expect(intersect(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(true);
  });

  it("rejects rectangles separated horizontally or vertically", () => {
    expect(intersect(rect(0, 0, 10, 10), rect(20, 0, 10, 10))).toBe(false);
    expect(intersect(rect(20, 0, 10, 10), rect(0, 0, 10, 10))).toBe(false);
    expect(intersect(rect(0, 0, 10, 10), rect(0, 20, 10, 10))).toBe(false);
    expect(intersect(rect(0, 20, 10, 10), rect(0, 0, 10, 10))).toBe(false);
  });
});
