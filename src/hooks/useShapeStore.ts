import { create } from "zustand";
import { Card, Counter, Shape, rotateShape, flipShape } from "../types/canvas";
import { generateId } from "../utils/math";
import vec from "../utils/vec";

interface HistoryEntry {
  shapes: Shape[];
  selectedShapeIds: string[];
  timestamp: number;
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

interface ShapeStore {
  shapes: Shape[];
  selectedShapeIds: string[];
  shapeInCreation: { shape: Shape; origin: number[] } | null;
  editingText: { id: string; text: string } | null;
  history: HistoryState;
  canUndo: boolean;
  canRedo: boolean;
  isDraggingShape: boolean;
  isResizingShape: boolean;
  isRotatingShape: boolean;
  setShapes: (shapes: Shape[] | ((shapes: Shape[]) => Shape[])) => void;
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  setSelectedShapeIds: (ids: string[]) => void;
  setShapeInCreation: (
    shapeInCreation: { shape: Shape; origin: number[] } | null
  ) => void;
  setEditingText: (editingText: { id: string; text: string } | null) => void;
  createShape: (type: Shape["type"], point: number[]) => void;
  updateShapeInCreation: (point: number[]) => void;
  flipSelectedShapes: () => void;
  rotateSelectedShapes: (angle: number) => void;
  engageSelected: () => void;
  tapShape: (id: string) => void;
  untapAll: () => void;
  copySelected: () => void;
  updateCountersOnSelected: (counters: Counter[]) => void;
  clearCountersOnSelected: () => void;
  changeColorOnSelected: (color: string) => void;
  sendSelectedToBack: () => void;
  sendSelectedToFront: () => void;
  increaseSrcIndexOnSelected: () => void;
  removeSelectedImages: () => Card[];
  getSelectedImages: () => Card[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  shouldSkipHistory: () => boolean;
}

function mapSelectedShapes(
  state: Pick<ShapeStore, "shapes" | "selectedShapeIds">,
  transform: (shape: Shape) => Shape
) {
  const selected = new Set(state.selectedShapeIds);
  return state.shapes.map((shape) =>
    selected.has(shape.id) ? transform(shape) : shape
  );
}

function partitionSelectedShapes(
  state: Pick<ShapeStore, "shapes" | "selectedShapeIds">
) {
  const selected = new Set(state.selectedShapeIds);
  return {
    selected: state.shapes.filter((shape) => selected.has(shape.id)),
    rest: state.shapes.filter((shape) => !selected.has(shape.id)),
  };
}

function getSelectedImageCards(
  state: Pick<ShapeStore, "shapes" | "selectedShapeIds">
): Card[] {
  const selected = new Set(state.selectedShapeIds);
  return state.shapes
    .filter((shape) => selected.has(shape.id) && shape.type === "image")
    .map((shape) => ({
      id: shape.id,
      src: shape.src as string[],
      srcIndex: shape.srcIndex,
    }));
}

function createHistoryEntry(
  state: Pick<ShapeStore, "shapes" | "selectedShapeIds">
): HistoryEntry {
  return {
    shapes: structuredClone(state.shapes),
    selectedShapeIds: [...state.selectedShapeIds],
    timestamp: Date.now(),
  };
}

export const useShapeStore = create<ShapeStore>((set, get) => ({
  shapes: [],
  selectedShapeIds: [],
  shapeInCreation: null,
  editingText: null,
  selectionRect: null,
  history: {
    past: [],
    future: [],
  },
  canUndo: false,
  canRedo: false,
  isDraggingShape: false,
  isResizingShape: false,
  isRotatingShape: false,
  shouldSkipHistory: () => {
    const state = get();
    return (
      state.isDraggingShape ||
      state.isResizingShape ||
      state.isRotatingShape ||
      state.editingText !== null
    );
  },
  setShapes: (shapes) => {
    // Push history before updating shapes (skipped while an operation is in progress)
    get().pushHistory();

    if (typeof shapes === "function") {
      set((state) => ({ shapes: shapes(state.shapes) }));
    } else {
      set({ shapes });
    }
  },
  addShape: (shape) => {
    get().pushHistory();
    set((state) => ({ shapes: [...state.shapes, shape] }));
  },
  updateShape: (id, updates) =>
    set((state) => ({
      shapes: state.shapes.map((shape) =>
        shape.id === id ? { ...shape, ...updates } : shape
      ),
    })),
  deleteShape: (id) => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.filter((shape) => shape.id !== id),
    }));
  },
  setSelectedShapeIds: (ids) => set({ selectedShapeIds: ids }),
  setShapeInCreation: (shapeInCreation) => set({ shapeInCreation }),
  setEditingText: (editingText) => set({ editingText }),
  createShape: (type, point) =>
    set(() => ({
      shapeInCreation: {
        shape: {
          id: generateId(),
          point,
          size: [0, 0],
          type,
          srcIndex: 0,
        },
        origin: point,
      },
    })),
  updateShapeInCreation: (point) =>
    set((state) => {
      if (!state.shapeInCreation) return {};
      const delta = vec.sub(point, state.shapeInCreation.origin);
      return {
        shapeInCreation: {
          ...state.shapeInCreation,
          shape: {
            ...state.shapeInCreation.shape,
            size: delta,
          },
        },
      };
    }),
  flipSelectedShapes: () => {
    get().pushHistory();
    set((state) => ({
      shapes: mapSelectedShapes(state, flipShape),
    }));
  },
  rotateSelectedShapes: (angle) => {
    get().pushHistory();
    set((state) => ({
      shapes: mapSelectedShapes(state, (shape) => ({
        ...shape,
        rotation: (shape.rotation || 0) + angle,
      })),
    }));
  },
  engageSelected: () => {
    const { selectedShapeIds } = get();
    if (selectedShapeIds.length === 0) return;
    get().pushHistory();
    set((state) => ({
      shapes: mapSelectedShapes(state, (shape) =>
        shape.type === "image" || shape.type === "rectangle"
          ? rotateShape(shape, shape.rotation !== 0 ? -90 : 90)
          : shape
      ),
    }));
  },
  tapShape: (id) => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((shape) => {
        if (shape.id === id && shape.type === "image") {
          const currentRotation = shape.rotation || 0;
          return { ...shape, rotation: currentRotation === 90 ? 0 : 90 };
        }
        return shape;
      }),
    }));
  },
  untapAll: () => {
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map((shape) =>
        (shape.type === "image" || shape.type === "rectangle") && shape.rotation
          ? { ...shape, rotation: 0 }
          : shape
      ),
    }));
  },
  copySelected: () => {
    const { shapes, selectedShapeIds } = get();
    if (selectedShapeIds.length === 0) return;
    get().pushHistory();
    const copies = shapes
      .filter((shape) => selectedShapeIds.includes(shape.id))
      .map((shape) => ({
        ...shape,
        id: generateId(),
        point: [shape.point[0] + 100, shape.point[1] + 100],
      }));
    set((state) => ({ shapes: [...state.shapes, ...copies] }));
  },
  updateCountersOnSelected: (counters) => {
    get().pushHistory();
    set((state) => ({
      shapes: mapSelectedShapes(state, (shape) =>
        shape.type === "image" ? { ...shape, counters } : shape
      ),
    }));
  },
  clearCountersOnSelected: () => {
    get().pushHistory();
    set((state) => ({
      shapes: mapSelectedShapes(state, (shape) =>
        shape.type === "image" ? { ...shape, counters: [] } : shape
      ),
    }));
  },
  changeColorOnSelected: (color) => {
    const { selectedShapeIds } = get();
    if (selectedShapeIds.length !== 1) return;
    get().pushHistory();
    set((state) => ({
      shapes: mapSelectedShapes(state, (shape) => ({ ...shape, color })),
    }));
  },
  sendSelectedToBack: () => {
    const state = get();
    if (state.selectedShapeIds.length === 0) return;
    state.pushHistory();
    const { selected, rest } = partitionSelectedShapes(state);
    set({ shapes: [...selected, ...rest], selectedShapeIds: [] });
  },
  sendSelectedToFront: () => {
    const state = get();
    if (state.selectedShapeIds.length === 0) return;
    state.pushHistory();
    const { selected, rest } = partitionSelectedShapes(state);
    set({ shapes: [...rest, ...selected], selectedShapeIds: [] });
  },
  increaseSrcIndexOnSelected: () => {
    get().pushHistory();
    set((state) => ({
      shapes: mapSelectedShapes(state, (shape) =>
        shape.type === "image"
          ? {
            ...shape,
            srcIndex: (shape.srcIndex + 1) % (shape.src?.length ?? 1),
          }
          : shape
      ),
    }));
  },
  removeSelectedImages: () => {
    const { selectedShapeIds } = get();
    const removed = getSelectedImageCards(get());
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.filter(
        (s) => !(s.type === "image" && selectedShapeIds.includes(s.id))
      ),
      selectedShapeIds: [],
    }));
    return removed;
  },
  getSelectedImages: () => getSelectedImageCards(get()),
  pushHistory: () => {
    // Skip if in the middle of an operation
    if (get().shouldSkipHistory()) {
      return;
    }

    const entry = createHistoryEntry(get());

    set((state) => ({
      history: {
        past: [...state.history.past, entry].slice(-50), // Keep last 50
        future: [], // Clear redo stack on new action
      },
      canUndo: true,
      canRedo: false,
    }));
  },
  undo: () => {
    const state = get();
    if (state.history.past.length === 0) return;

    // Save current state to future
    const current = createHistoryEntry(state);

    // Pop from past
    const previous = state.history.past[state.history.past.length - 1];
    const newPast = state.history.past.slice(0, -1);

    // Update state
    set({
      shapes: previous.shapes,
      selectedShapeIds: previous.selectedShapeIds,
      history: {
        past: newPast,
        future: [current, ...state.history.future],
      },
      canUndo: newPast.length > 0,
      canRedo: true,
    });
  },
  redo: () => {
    const state = get();
    if (state.history.future.length === 0) return;

    // Save current state to past
    const current = createHistoryEntry(state);

    // Pop from future
    const next = state.history.future[0];
    const newFuture = state.history.future.slice(1);

    // Update state
    set({
      shapes: next.shapes,
      selectedShapeIds: next.selectedShapeIds,
      history: {
        past: [...state.history.past, current],
        future: newFuture,
      },
      canUndo: true,
      canRedo: newFuture.length > 0,
    });
  },
  clearHistory: () => {
    set({
      history: {
        past: [],
        future: [],
      },
      canUndo: false,
      canRedo: false,
    });
  },
}));
