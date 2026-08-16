import React from "react";
import { Camera, Shape as ShapeType } from "../../types/canvas";
import { screenToCanvas } from "../../utils/vec";
import { getBounds } from "../../utils/canvas_utils";
import { Point2D } from "../../utils/geometry";
import {
  getDraggedRotation,
  getPointerAngleFromCenter,
  getResizedShape,
  snapRotation,
  ShapeDimensions,
} from "./selectionBoxMath";
import { getShapeLocalBounds } from "./shapeTransforms";
import { SelectionHandles, SelectionHandleType } from "./SelectionHandles";
import { useSelectionHandleDrag } from "./useSelectionHandleDrag";

interface SelectionBoxProps {
  shape: ShapeType;
  zoom: number;
  cameraRef: React.RefObject<Camera>;
  onResize: (
    newSize: [number, number],
    newPoint: [number, number],
    newFontSize?: number
  ) => void;
  onRotate: (newRotation: number) => void;
}

type DragSession = {
  handle: SelectionHandleType;
  startPoint: Point2D;
  originalShape: ShapeType;
  originalBounds: ShapeDimensions & { x: number; y: number };
  originalCenter: Point2D;
  startPointerAngle: number | null;
};

export function SelectionBox({
  shape,
  zoom,
  cameraRef,
  onResize,
  onRotate,
}: SelectionBoxProps) {
  const { sessionRef, startDrag, finishDrag, handlePointerUp } =
    useSelectionHandleDrag<DragSession>();

  const { rotation = 0 } = shape;
  const { x, y, width, height } = getShapeLocalBounds(shape);
  const center: Point2D = [x + width / 2, y + height / 2];

  const handlePointerDown = (
    event: React.PointerEvent<SVGCircleElement>,
    handle: SelectionHandleType
  ) => {
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
      originalShape: {
        ...shape,
        point: [...shape.point],
        size: [...shape.size],
      },
      originalBounds: { x, y, width, height },
      originalCenter: center,
      startPointerAngle:
        handle === "rotate"
          ? getPointerAngleFromCenter(center, startPoint)
          : null,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const dragSession = sessionRef.current;
    if (!dragSession) return;

    const camera = cameraRef.current;
    if (!camera) return;
    const pointer = screenToCanvas(
      { x: event.clientX, y: event.clientY },
      camera
    );
    const currentPoint: Point2D = [pointer.x, pointer.y];

    if (dragSession.handle === "rotate") {
      if (dragSession.startPointerAngle === null) return;

      const currentPointerAngle = getPointerAngleFromCenter(
        dragSession.originalCenter,
        currentPoint
      );
      const nextRotation = getDraggedRotation(
        dragSession.originalShape.rotation || 0,
        dragSession.startPointerAngle,
        currentPointerAngle
      );

      onRotate(snapRotation(nextRotation, event.shiftKey));
      return;
    }

    const originalFontSize = dragSession.originalShape.fontSize ?? 16;
    const isText = dragSession.originalShape.type === "text";
    const resized = getResizedShape({
      handle: dragSession.handle,
      startPointer: dragSession.startPoint,
      currentPointer: currentPoint,
      originalPoint: [dragSession.originalBounds.x, dragSession.originalBounds.y],
      originalDimensions: dragSession.originalBounds,
      rotation: dragSession.originalShape.rotation || 0,
      lockAspectRatio: event.shiftKey,
      minUniformScale: isText ? 1 / originalFontSize : 0.01,
      getUniformDimensions: isText
        ? (scale) => {
          const bounds = getBounds(
            dragSession.originalShape.text ?? "",
            0,
            0,
            originalFontSize * scale
          );
          return { width: bounds.width, height: bounds.height };
        }
        : undefined,
    });

    onResize(
      resized.size,
      resized.point,
      isText && resized.scale !== null
        ? originalFontSize * resized.scale
        : undefined
    );
  };

  return (
    <g data-selection-box-shape-id={shape.id} onPointerMove={handlePointerMove}>
      <SelectionHandles
        bounds={{ x, y, width, height, rotation, center }}
        zoom={zoom}
        onHandlePointerDown={handlePointerDown}
        onHandlePointerUp={handlePointerUp}
        onHandleDragCancel={finishDrag}
      />
    </g>
  );
}
