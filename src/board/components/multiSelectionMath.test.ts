import { describe, expect, it } from "vitest";
import { Shape } from "../../types/canvas";
import {
  canDeformMultiSelection,
  getMultiSelectionBounds,
  resizeMultiSelection,
  rotateMultiSelection,
} from "./multiSelectionMath";

const rectangle = (
  id: string,
  point: [number, number],
  size: [number, number],
  rotation = 0
): Shape => ({
  id,
  point,
  size,
  rotation,
  type: "rectangle",
  srcIndex: 0,
});

describe("multiSelectionMath", () => {
  it("uses page bounds when the selected shapes have different rotations", () => {
    const bounds = getMultiSelectionBounds([
      rectangle("vertical", [0, 0], [100, 20], 90),
      rectangle("square", [100, 0], [20, 20]),
    ]);

    expect(bounds).toEqual({
      x: 40,
      y: -40,
      width: 80,
      height: 100,
      rotation: 0,
      center: [80, 10],
    });
  });

  it("keeps a shared shape rotation on the aggregate frame", () => {
    const bounds = getMultiSelectionBounds([
      rectangle("a", [100, 100], [80, 40], 30),
      rectangle("b", [240, 180], [80, 40], 30),
    ]);

    expect(bounds?.rotation).toBe(30);
    expect(bounds?.width).toBeGreaterThan(190);
    expect(bounds?.height).toBeGreaterThan(40);
  });

  it("resizes all shapes relative to the opposite selection edge", () => {
    const shapes = [
      rectangle("left", [0, 0], [100, 50]),
      rectangle("right", [200, 0], [100, 50]),
    ];
    const bounds = getMultiSelectionBounds(shapes)!;
    const result = resizeMultiSelection({
      shapes,
      bounds,
      handle: "e",
      startPointer: [300, 25],
      currentPointer: [600, 25],
    });

    expect(result.scale).toEqual([2, 1]);
    expect(result.shapes[0].point).toEqual([0, 0]);
    expect(result.shapes[0].size).toEqual([200, 50]);
    expect(result.shapes[1].point).toEqual([400, 0]);
    expect(result.shapes[1].size).toEqual([200, 50]);
  });

  it("resizes a shared rotated frame in its own axes", () => {
    const shapes = [
      rectangle("top", [0, 0], [100, 50], 90),
      rectangle("bottom", [0, 200], [100, 50], 90),
    ];
    const bounds = getMultiSelectionBounds(shapes)!;
    const result = resizeMultiSelection({
      shapes,
      bounds,
      handle: "se",
      startPointer: [25, 275],
      currentPointer: [-25, 575],
    });
    const resizedBounds = getMultiSelectionBounds(result.shapes)!;

    expect(result.scale[0]).toBeCloseTo(2);
    expect(result.scale[1]).toBeCloseTo(2);
    expect(result.shapes[0].size[0]).toBeCloseTo(200);
    expect(result.shapes[0].size[1]).toBeCloseTo(100);
    expect(result.shapes[1].size[0]).toBeCloseTo(200);
    expect(result.shapes[1].size[1]).toBeCloseTo(100);
    expect(resizedBounds.rotation).toBe(90);
    expect(resizedBounds.center[0]).toBeCloseTo(25);
    expect(resizedBounds.center[1]).toBeCloseTo(275);
    expect(resizedBounds.width).toBeCloseTo(600);
    expect(resizedBounds.height).toBeCloseTo(100);
  });

  it("locks aggregate resizing when text cannot be deformed", () => {
    const shapes: Shape[] = [
      rectangle("box", [0, 0], [100, 50]),
      {
        id: "label",
        point: [200, 0],
        size: [80, 20],
        type: "text",
        text: "Label",
        fontSize: 16,
        srcIndex: 0,
      },
    ];
    const bounds = getMultiSelectionBounds(shapes)!;

    expect(canDeformMultiSelection(shapes, bounds.rotation)).toBe(false);

    const result = resizeMultiSelection({
      shapes,
      bounds,
      handle: "e",
      startPointer: [bounds.x + bounds.width, bounds.center[1]],
      currentPointer: [bounds.x + bounds.width * 2, bounds.center[1]],
      lockAspectRatio: true,
    });
    const label = result.shapes.find((shape) => shape.id === "label");

    expect(result.scale[0]).toBeCloseTo(2);
    expect(result.scale[1]).toBeCloseTo(2);
    expect(label?.fontSize).toBeCloseTo(32);
  });

  it("rotates child centers around the selection center", () => {
    const shapes = [
      rectangle("left", [0, 0], [100, 50]),
      rectangle("right", [200, 0], [100, 50]),
    ];
    const rotated = rotateMultiSelection(shapes, [150, 25], 90);

    expect(rotated[0].point[0]).toBeCloseTo(100);
    expect(rotated[0].point[1]).toBeCloseTo(-100);
    expect(rotated[0].rotation).toBe(90);
    expect(rotated[1].point[0]).toBeCloseTo(100);
    expect(rotated[1].point[1]).toBeCloseTo(100);
    expect(rotated[1].rotation).toBe(90);
  });
});
