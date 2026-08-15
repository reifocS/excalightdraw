import React, { useRef } from "react";
import { useShapeStore } from "../../hooks/useShapeStore";
import { Camera, Shape as ShapeType } from "../../types/canvas";
import { screenToCanvas } from "../../utils/vec";
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
  getResizeCursor,
  getRotationHandleOffset,
  ResizeHandle,
} from "./selectionBoxMath";

type HandleType = ResizeHandle | "rotate";

type MultiSelectionBoxProps = {
  shapes: ShapeType[];
  zoom: number;
  cameraRef: React.RefObject<Camera>;
};

type DragSession = {
  handle: HandleType;
  startPoint: [number, number];
  originalShapes: ShapeType[];
  originalBounds: SelectionBounds;
  startPointerAngle: number | null;
};

const HANDLE_SIZE = 8;

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
  const dragSessionRef = useRef<DragSession | null>(null);
  const bounds = getMultiSelectionBounds(shapes);

  if (!bounds) return null;

  const { x, y, width, height, rotation, center } = bounds;
  const [centerX, centerY] = center;
  const rotationHandleOffset = getRotationHandleOffset(width, height, zoom);
  const handles: Record<HandleType, [number, number]> = {
    nw: [x, y],
    n: [x + width / 2, y],
    ne: [x + width, y],
    e: [x + width, y + height / 2],
    se: [x + width, y + height],
    s: [x + width / 2, y + height],
    sw: [x, y + height],
    w: [x, y + height / 2],
    rotate: [x + width / 2, y - rotationHandleOffset],
  };

  const rotatePoint = (point: [number, number]): [number, number] => {
    if (rotation === 0) return point;
    const angle = (rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point[0] - centerX;
    const dy = point[1] - centerY;
    return [
      centerX + dx * cos - dy * sin,
      centerY + dx * sin + dy * cos,
    ];
  };

  const commitShapes = (nextShapes: ShapeType[]) => {
    const nextShapesById = new Map(nextShapes.map((shape) => [shape.id, shape]));
    useShapeStore.getState().setShapes((currentShapes) =>
      currentShapes.map((shape) => nextShapesById.get(shape.id) ?? shape)
    );
  };

  const finishDrag = () => {
    if (!dragSessionRef.current) return;
    dragSessionRef.current = null;
    useShapeStore.setState({
      isResizingShape: false,
      isRotatingShape: false,
    });
  };

  const handlePointerDown = (
    event: React.PointerEvent<SVGCircleElement>,
    handle: HandleType
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const camera = cameraRef.current;
    if (!camera) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const pointer = screenToCanvas(
      { x: event.clientX, y: event.clientY },
      camera
    );
    const startPoint: [number, number] = [pointer.x, pointer.y];
    dragSessionRef.current = {
      handle,
      startPoint,
      originalShapes: shapes.map(cloneShape),
      originalBounds: bounds,
      startPointerAngle:
        handle === "rotate"
          ? getPointerAngleFromCenter(center, startPoint)
          : null,
    };

    useShapeStore.getState().pushHistory();
    useShapeStore.setState(
      handle === "rotate"
        ? { isRotatingShape: true }
        : { isResizingShape: true }
    );
  };

  const handlePointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const dragSession = dragSessionRef.current;
    const camera = cameraRef.current;
    if (!dragSession || !camera) return;

    const pointer = screenToCanvas(
      { x: event.clientX, y: event.clientY },
      camera
    );
    const currentPoint: [number, number] = [pointer.x, pointer.y];

    if (dragSession.handle === "rotate") {
      if (dragSession.startPointerAngle === null) return;
      const currentPointerAngle = getPointerAngleFromCenter(
        dragSession.originalBounds.center,
        currentPoint
      );
      let nextRotation = getDraggedRotation(
        dragSession.originalBounds.rotation,
        dragSession.startPointerAngle,
        currentPointerAngle
      );
      if (event.shiftKey) {
        nextRotation = Math.round(nextRotation / 15) * 15;
      }

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

  const handlePointerUp = (
    event: React.PointerEvent<SVGCircleElement>
  ) => {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag();
  };

  return (
    <g
      data-selection-box-kind="multi"
      data-selection-shape-count={shapes.length}
      onPointerMove={handlePointerMove}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="#4A90E2"
        strokeWidth={2 / zoom}
        strokeDasharray={`${5 / zoom},${5 / zoom}`}
        pointerEvents="none"
        transform={`rotate(${rotation} ${centerX} ${centerY})`}
      />

      {(Object.entries(handles) as [HandleType, [number, number]][])
        .filter((entry): entry is [ResizeHandle, [number, number]] =>
          entry[0] !== "rotate"
        )
        .map(([type, point]) => {
          const [handleX, handleY] = rotatePoint(point);
          return (
            <circle
              key={type}
              data-selection-handle={type}
              cx={handleX}
              cy={handleY}
              r={HANDLE_SIZE / zoom}
              fill="white"
              stroke="#4A90E2"
              strokeWidth={2 / zoom}
              style={{ cursor: getResizeCursor(type, rotation) }}
              onPointerDown={(event) => handlePointerDown(event, type)}
              onPointerUp={handlePointerUp}
              onPointerCancel={finishDrag}
              onLostPointerCapture={finishDrag}
            />
          );
        })}

      <line
        x1={centerX}
        y1={y}
        x2={handles.rotate[0]}
        y2={handles.rotate[1]}
        stroke="#4A90E2"
        strokeWidth={2 / zoom}
        strokeDasharray={`${3 / zoom},${3 / zoom}`}
        pointerEvents="none"
        transform={`rotate(${rotation} ${centerX} ${centerY})`}
      />
      {(() => {
        const [handleX, handleY] = rotatePoint(handles.rotate);
        return (
          <circle
            data-selection-handle="rotate"
            cx={handleX}
            cy={handleY}
            r={HANDLE_SIZE / zoom}
            fill="#4A90E2"
            stroke="white"
            strokeWidth={2 / zoom}
            style={{ cursor: "grab" }}
            onPointerDown={(event) => handlePointerDown(event, "rotate")}
            onPointerUp={handlePointerUp}
            onPointerCancel={finishDrag}
            onLostPointerCapture={finishDrag}
          />
        );
      })()}
    </g>
  );
}
