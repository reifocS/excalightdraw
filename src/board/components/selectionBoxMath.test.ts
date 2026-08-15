import { describe, expect, it } from "vitest";
import {
  getDraggedRotation,
  getPointerAngleFromCenter,
  getResizeCursor,
  getResizedShape,
  getRotationHandleOffset,
  normalizeAngleDelta,
} from "./selectionBoxMath";

describe("selectionBoxMath", () => {
  it("keeps the initial rotation when the pointer has not moved", () => {
    const center: [number, number] = [100, 100];
    const startPointer: [number, number] = [108, 44];
    const startAngle = getPointerAngleFromCenter(center, startPointer);

    expect(getDraggedRotation(35, startAngle, startAngle)).toBe(35);
  });

  it("normalizes angle deltas across the wrap boundary", () => {
    expect(normalizeAngleDelta(340)).toBe(-20);
    expect(normalizeAngleDelta(-340)).toBe(20);
    expect(normalizeAngleDelta(181)).toBe(-179);
  });

  it("applies rotation deltas relative to the drag start angle", () => {
    expect(getDraggedRotation(10, 170, -170)).toBe(30);
    expect(getDraggedRotation(-20, -175, 175)).toBe(-30);
  });

  it("keeps a larger rotation-handle radius when zoomed out", () => {
    expect(getRotationHandleOffset(240, 20, 1)).toBe(62);
    expect(getRotationHandleOffset(240, 20, 0.5)).toBe(134);
  });

  it("keeps the handle compact for small shapes at normal zoom", () => {
    expect(getRotationHandleOffset(60, 30, 1)).toBe(30);
    expect(getRotationHandleOffset(80, 40, 1)).toBe(30);
  });

  it("still adds extra radius for small shapes when zoomed out", () => {
    expect(getRotationHandleOffset(60, 30, 0.5)).toBe(65);
    expect(getRotationHandleOffset(80, 40, 0.5)).toBe(60);
  });

  it("keeps zoomed-in tiny shapes reachable on screen", () => {
    expect(getRotationHandleOffset(11, 12, 10)).toBe(3);
    expect(getRotationHandleOffset(20, 20, 10)).toBe(3);
  });

  it("keeps the opposite corner fixed while resizing a rotated shape", () => {
    const result = getResizedShape({
      handle: "se",
      startPointer: [161.2132034356, 95.3553390593],
      currentPointer: [196.5685424949, 130.7106781187],
      originalPoint: [100, 50],
      originalDimensions: { width: 80, height: 20 },
      rotation: 45,
    });

    expect(result.size[0]).toBeCloseTo(130);
    expect(result.size[1]).toBeCloseTo(20);
    expect(result.point[0]).toBeCloseTo(92.6776695297);
    expect(result.point[1]).toBeCloseTo(67.6776695297);
  });

  it("continues expanding after a resize handle crosses its opposite edge", () => {
    const result = getResizedShape({
      handle: "e",
      startPointer: [200, 70],
      currentPointer: [40, 70],
      originalPoint: [100, 50],
      originalDimensions: { width: 100, height: 40 },
      rotation: 0,
    });

    expect(result.size[0]).toBeCloseTo(60);
    expect(result.size[1]).toBe(40);
    expect(result.point).toEqual([40, 50]);
  });

  it("keeps a rotated scale origin fixed after crossing it", () => {
    const result = getResizedShape({
      handle: "e",
      startPointer: [185.3553390593, 105.3553390593],
      currentPointer: [72.2182540695, -7.7817459305],
      originalPoint: [100, 50],
      originalDimensions: { width: 100, height: 40 },
      rotation: 45,
    });

    expect(result.size[0]).toBeCloseTo(60);
    expect(result.size[1]).toBe(40);
    expect(result.point[0]).toBeCloseTo(63.4314575051);
    expect(result.point[1]).toBeCloseTo(-6.5685424949);
  });

  it("keeps measured text dimensions anchored during uniform resize", () => {
    const result = getResizedShape({
      handle: "w",
      startPointer: [100, 60],
      currentPointer: [50, 60],
      originalPoint: [100, 50],
      originalDimensions: { width: 100, height: 20 },
      rotation: 0,
      getUniformDimensions: (scale) => ({
        width: 92 * scale + 8,
        height: 16 * scale + 4,
      }),
    });

    expect(result.scale).toBe(1.5);
    expect(result.size).toEqual([146, 28]);
    expect(result.point).toEqual([54, 46]);
  });

  it("rotates resize cursors with the shape", () => {
    expect(getResizeCursor("n", 0)).toBe("ns-resize");
    expect(getResizeCursor("n", 90)).toBe("ew-resize");
    expect(getResizeCursor("nw", 45)).toBe("ns-resize");
    expect(getResizeCursor("e", -45)).toBe("nesw-resize");
  });
});
