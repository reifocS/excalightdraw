import { describe, expect, it } from "vitest";
import {
  getBounds,
  getCameraZoom,
  getTextWidth,
  panCamera,
  screenToWorld,
  zoomCamera,
} from "./canvas_utils";
import { Camera } from "../types/canvas";

const camera: Camera = { x: 0, y: 0, z: 1 };

describe("panCamera", () => {
  it("moves the camera opposite to the drag delta, scaled by zoom", () => {
    expect(panCamera(camera, 10, 20)).toEqual({ x: -10, y: -20, z: 1 });
    expect(panCamera({ x: 0, y: 0, z: 2 }, 10, 20)).toEqual({
      x: -5,
      y: -10,
      z: 2,
    });
  });
});

describe("getCameraZoom", () => {
  it("clamps the zoom between 0.5 and 10", () => {
    expect(getCameraZoom(0.1)).toBe(0.5);
    expect(getCameraZoom(50)).toBe(10);
    expect(getCameraZoom(3)).toBe(3);
  });
});

describe("screenToWorld", () => {
  it("converts screen coordinates into world coordinates", () => {
    expect(screenToWorld([100, 50], { x: 10, y: 5, z: 2 })).toEqual([40, 20]);
  });
});

describe("zoomCamera", () => {
  it("keeps the anchor point stationary in world space", () => {
    const point = [200, 100];
    const before = screenToWorld(point, camera);
    const zoomed = zoomCamera(camera, point, -25);
    expect(zoomed.z).toBeGreaterThan(camera.z);
    const after = screenToWorld(point, zoomed);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it("zooms out on a positive delta and respects the zoom limits", () => {
    expect(zoomCamera(camera, [0, 0], 25).z).toBeLessThan(camera.z);
    expect(zoomCamera({ x: 0, y: 0, z: 10 }, [0, 0], -100).z).toBe(10);
    expect(zoomCamera({ x: 0, y: 0, z: 0.5 }, [0, 0], 100).z).toBe(0.5);
  });
});

describe("text measurement without a DOM", () => {
  it("reports zero width when document is unavailable", () => {
    expect(getTextWidth("hello", "16px Arial")).toBe(0);
  });

  it("returns an empty bounding box anchored at the given point", () => {
    expect(getBounds("hello", 5, 7)).toEqual({
      minX: 5,
      maxX: 5,
      minY: 7,
      maxY: 7,
      width: 0,
      height: 0,
    });
  });
});
