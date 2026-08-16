import { beforeEach, describe, expect, it } from "vitest";
import { useShapeStore } from "./useShapeStore";
import { Shape } from "../types/canvas";

function shape(id: string, overrides: Partial<Shape> = {}): Shape {
  return {
    id,
    point: [0, 0],
    size: [10, 20],
    type: "image",
    srcIndex: 0,
    src: [`${id}-front.png`],
    ...overrides,
  };
}

function reset(shapes: Shape[] = [], selectedShapeIds: string[] = []) {
  useShapeStore.setState({
    shapes,
    selectedShapeIds,
    shapeInCreation: null,
    editingText: null,
    history: { past: [], future: [] },
    canUndo: false,
    canRedo: false,
    isDraggingShape: false,
    isResizingShape: false,
    isRotatingShape: false,
  });
}

const store = () => useShapeStore.getState();

beforeEach(() => {
  reset();
});

describe("shape mutations", () => {
  it("adds, updates and deletes shapes", () => {
    store().addShape(shape("a"));
    expect(store().shapes).toHaveLength(1);

    store().updateShape("a", { rotation: 90 });
    expect(store().shapes[0].rotation).toBe(90);

    store().updateShape("missing", { rotation: 180 });
    expect(store().shapes[0].rotation).toBe(90);

    store().deleteShape("a");
    expect(store().shapes).toEqual([]);
  });

  it("accepts shapes as a value or an updater function", () => {
    store().setShapes([shape("a")]);
    store().setShapes((shapes) => [...shapes, shape("b")]);
    expect(store().shapes.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("shape creation", () => {
  it("creates a shape at the given origin and resizes it as the pointer moves", () => {
    store().createShape("rectangle", [10, 20]);
    const created = store().shapeInCreation;
    expect(created?.origin).toEqual([10, 20]);
    expect(created?.shape).toMatchObject({
      point: [10, 20],
      size: [0, 0],
      type: "rectangle",
      srcIndex: 0,
    });

    store().updateShapeInCreation([40, 60]);
    expect(store().shapeInCreation?.shape.size).toEqual([30, 40]);
  });

  it("ignores pointer updates when nothing is being created", () => {
    store().updateShapeInCreation([40, 60]);
    expect(store().shapeInCreation).toBeNull();
  });
});

describe("selection operations", () => {
  it("flips and rotates only the selected shapes", () => {
    reset([shape("a"), shape("b")], ["a"]);
    store().flipSelectedShapes();
    store().rotateSelectedShapes(90);
    const [a, b] = store().shapes;
    expect(a).toMatchObject({ isFlipped: true, rotation: 90 });
    expect(b.isFlipped).toBeUndefined();
    expect(b.rotation).toBeUndefined();
  });

  it("engages selected images by toggling between 0 and 90 degrees", () => {
    reset(
      [shape("a", { rotation: 0 }), shape("t", { type: "text", rotation: 0 })],
      ["a", "t"]
    );
    store().engageSelected();
    expect(store().shapes[0].rotation).toBe(90);
    expect(store().shapes[1].rotation).toBe(0);

    store().engageSelected();
    expect(store().shapes[0].rotation).toBe(0);
  });

  it("does nothing on engage when the selection is empty", () => {
    reset([shape("a")], []);
    store().engageSelected();
    expect(store().shapes[0].rotation).toBeUndefined();
    expect(store().history.past).toHaveLength(0);
  });

  it("taps a single image shape and untaps everything", () => {
    reset([shape("a"), shape("r", { type: "rectangle", rotation: 90 })]);
    store().tapShape("a");
    expect(store().shapes[0].rotation).toBe(90);
    store().tapShape("a");
    expect(store().shapes[0].rotation).toBe(0);

    store().tapShape("a");
    store().untapAll();
    expect(store().shapes.map((s) => s.rotation)).toEqual([0, 0]);
  });

  it("copies selected shapes offset by 100px with new ids", () => {
    reset([shape("a")], ["a"]);
    store().copySelected();
    const [, copy] = store().shapes;
    expect(copy.id).not.toBe("a");
    expect(copy.point).toEqual([100, 100]);
  });

  it("does nothing on copy when the selection is empty", () => {
    reset([shape("a")], []);
    store().copySelected();
    expect(store().shapes).toHaveLength(1);
  });

  it("sets and clears counters on selected images", () => {
    reset([shape("a"), shape("t", { type: "text" })], ["a", "t"]);
    store().updateCountersOnSelected([{ label: "P/T", power: 1, toughness: 1 }]);
    expect(store().shapes[0].counters).toEqual([
      { label: "P/T", power: 1, toughness: 1 },
    ]);
    expect(store().shapes[1].counters).toBeUndefined();

    store().clearCountersOnSelected();
    expect(store().shapes[0].counters).toEqual([]);
  });

  it("changes the color only when exactly one shape is selected", () => {
    reset([shape("a"), shape("b")], ["a", "b"]);
    store().changeColorOnSelected("#ff0000");
    expect(store().shapes.every((s) => s.color === undefined)).toBe(true);

    useShapeStore.setState({ selectedShapeIds: ["a"] });
    store().changeColorOnSelected("#ff0000");
    expect(store().shapes[0].color).toBe("#ff0000");
  });

  it("cycles the src index of selected images", () => {
    reset([shape("a", { src: ["one.png", "two.png"] })], ["a"]);
    store().increaseSrcIndexOnSelected();
    expect(store().shapes[0].srcIndex).toBe(1);
    store().increaseSrcIndexOnSelected();
    expect(store().shapes[0].srcIndex).toBe(0);
  });
});

describe("z-ordering", () => {
  it("sends the selection to the back and clears the selection", () => {
    reset([shape("a"), shape("b"), shape("c")], ["c"]);
    store().sendSelectedToBack();
    expect(store().shapes.map((s) => s.id)).toEqual(["c", "a", "b"]);
    expect(store().selectedShapeIds).toEqual([]);
  });

  it("sends the selection to the front and clears the selection", () => {
    reset([shape("a"), shape("b"), shape("c")], ["a"]);
    store().sendSelectedToFront();
    expect(store().shapes.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(store().selectedShapeIds).toEqual([]);
  });

  it("does nothing when the selection is empty", () => {
    reset([shape("a"), shape("b")], []);
    store().sendSelectedToBack();
    store().sendSelectedToFront();
    expect(store().shapes.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("selected images", () => {
  it("reads the selected images without changing state", () => {
    reset([shape("a"), shape("t", { type: "text" })], ["a", "t"]);
    expect(store().getSelectedImages()).toEqual([
      { id: "a", src: ["a-front.png"], srcIndex: 0 },
    ]);
    expect(store().shapes).toHaveLength(2);
  });

  it("removes the selected images and returns them", () => {
    reset([shape("a"), shape("t", { type: "text" })], ["a", "t"]);
    const removed = store().removeSelectedImages();
    expect(removed).toEqual([{ id: "a", src: ["a-front.png"], srcIndex: 0 }]);
    expect(store().shapes.map((s) => s.id)).toEqual(["t"]);
    expect(store().selectedShapeIds).toEqual([]);
  });
});

describe("history", () => {
  it("undoes and redoes shape changes", () => {
    store().setShapes([shape("a")]);
    store().setShapes([shape("a"), shape("b")]);
    expect(store().canUndo).toBe(true);

    store().undo();
    expect(store().shapes.map((s) => s.id)).toEqual(["a"]);
    expect(store().canRedo).toBe(true);

    store().redo();
    expect(store().shapes.map((s) => s.id)).toEqual(["a", "b"]);
    expect(store().canRedo).toBe(false);
  });

  it("ignores undo and redo when the stacks are empty", () => {
    reset([shape("a")]);
    store().undo();
    store().redo();
    expect(store().shapes.map((s) => s.id)).toEqual(["a"]);
  });

  it("clears the redo stack on a new action", () => {
    store().setShapes([shape("a")]);
    store().setShapes([shape("a"), shape("b")]);
    store().undo();
    store().addShape(shape("c"));
    expect(store().history.future).toEqual([]);
    expect(store().canRedo).toBe(false);
  });

  it("keeps at most 50 history entries", () => {
    for (let i = 0; i < 60; i++) {
      store().addShape(shape(`s${i}`));
    }
    expect(store().history.past).toHaveLength(50);
  });

  it("skips history while dragging, resizing, rotating or editing text", () => {
    for (const flag of [
      { isDraggingShape: true },
      { isResizingShape: true },
      { isRotatingShape: true },
      { editingText: { id: "a", text: "hi" } },
    ]) {
      reset([shape("a")]);
      useShapeStore.setState(flag);
      expect(store().shouldSkipHistory()).toBe(true);
      store().setShapes([shape("a"), shape("b")]);
      expect(store().history.past).toEqual([]);
    }
  });

  it("clears the history stacks", () => {
    store().addShape(shape("a"));
    store().undo();
    store().clearHistory();
    expect(store().history).toEqual({ past: [], future: [] });
    expect(store().canUndo).toBe(false);
    expect(store().canRedo).toBe(false);
  });
});
