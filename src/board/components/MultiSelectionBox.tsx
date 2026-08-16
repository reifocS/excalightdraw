import React from "react";
import { useShapeStore } from "../../hooks/useShapeStore";
import { Camera, Shape as ShapeType } from "../../types/canvas";
import { screenToCanvas } from "../../utils/vec";
import { Point2D } from "../../utils/geometry";
import {
  canDeformMultiSelection,
  getMultiSelectionBounds,
  resizeMultiSelection,
  rotateMultiSelection,
  SelectionBounds,
} from "./multiSelectionMath";
import {
  getDraggedRotation,
  getPointerAngleFromCenter,
  snapRotation,
} from "./selectionBoxMath";
import { SelectionHandles, SelectionHandleType } from "./SelectionHandles";
import { useSelectionHandleDrag } from "./useSelectionHandleDrag";

type MultiSelectionBoxProps = {
  shapes: ShapeType[];
  zoom: number;
  cameraRef: React.RefObject<Camera>;
};

type DragSession = {
  handle: SelectionHandleType;
  startPoint: Point2D;
  originalShapes: ShapeType[];
  originalBounds: SelectionBounds;
  startPointerAngle: number | null;
};

function cloneShape(shape: ShapeType): ShapeType {
  return {
    ...shape,
    point: [...shape.point],
    size: [...shape.size],
  };
}

export function MultiSelectionBox({
  shapes,
  zoom,
  cameraRef,
}: MultiSelectionBoxProps) {
  const { sessionRef, startDrag, finishDrag, handlePointerUp } =
    useSelectionHandleDrag<DragSession>();
  const bounds = getMultiSelectionBounds(shapes);

  if (!bounds) return null;

  const { center } = bounds;

  const commitShapes = (nextShapes: ShapeType[]) => {
    const nextShapesById = new Map(nextShapes.map((shape) => [shape.id, shape]));
    useShapeStore.getState().setShapes((currentShapes) =>
      currentShapes.map((shape) => nextShapesById.get(shape.id) ?? shape)
    );
  };

  const handlePointerDown = (
    event: React.PointerEvent<SVGCircleElement>,
    handle: SelectionHandleType
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const camera = cameraRef.current;
    if (!camera) return;

    const pointer = screenToCanvas(
      { x: event.clientX, y: event.clientY },
      camera
    );
    const startPoint: Point2D = [pointer.x, pointer.y];

    startDrag(event, handle, {
      handle,
      startPoint,
      originalShapes: shapes.map(cloneShape),
      originalBounds: bounds,
      startPointerAngle:
        handle === "rotate"
          ? getPointerAngleFromCenter(center, startPoint)
          : null,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const dragSession = sessionRef.current;
    const camera = cameraRef.current;
    if (!dragSession || !camera) return;

    const pointer = screenToCanvas(
      { x: event.clientX, y: event.clientY },
      camera
    );
    const currentPoint: Point2D = [pointer.x, pointer.y];

    if (dragSession.handle === "rotate") {
      if (dragSession.startPointerAngle === null) return;
      const currentPointerAngle = getPointerAngleFromCenter(
        dragSession.originalBounds.center,
        currentPoint
      );
      const nextRotation = snapRotation(
        getDraggedRotation(
          dragSession.originalBounds.rotation,
          dragSession.startPointerAngle,
          currentPointerAngle
        ),
        event.shiftKey
      );

      commitShapes(
        rotateMultiSelection(
          dragSession.originalShapes,
          dragSession.originalBounds.center,
          nextRotation - dragSession.originalBounds.rotation
        )
      );
      return;
    }

    const lockAspectRatio =
      event.shiftKey ||
      !canDeformMultiSelection(
        dragSession.originalShapes,
        dragSession.originalBounds.rotation
      );
    const resized = resizeMultiSelection({
      shapes: dragSession.originalShapes,
      bounds: dragSession.originalBounds,
      handle: dragSession.handle,
      startPointer: dragSession.startPoint,
      currentPointer: currentPoint,
      lockAspectRatio,
    });
    commitShapes(resized.shapes);
  };

  return (
    <g
      data-selection-box-kind="multi"
      data-selection-shape-count={shapes.length}
      onPointerMove={handlePointerMove}
    >
      <SelectionHandles
        bounds={bounds}
        zoom={zoom}
        onHandlePointerDown={handlePointerDown}
        onHandlePointerUp={handlePointerUp}
        onHandleDragCancel={finishDrag}
      />
    </g>
  );
}
