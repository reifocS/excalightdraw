import React from "react";
import { Point2D, rotatePoint } from "../../utils/geometry";
import {
  getResizeCursor,
  getRotationHandleOffset,
  ResizeHandle,
} from "./selectionBoxMath";

export type SelectionHandleType = ResizeHandle | "rotate";

export type SelectionHandleBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  center: Point2D;
};

type SelectionHandlesProps = {
  bounds: SelectionHandleBounds;
  zoom: number;
  onHandlePointerDown: (
    event: React.PointerEvent<SVGCircleElement>,
    handle: SelectionHandleType
  ) => void;
  onHandlePointerUp: (event: React.PointerEvent<SVGCircleElement>) => void;
  onHandleDragCancel: () => void;
};

const HANDLE_SIZE = 8;
const SELECTION_COLOR = "#4A90E2";

/**
 * Handle positions in unrotated space; they are rotated for display so the
 * dragging math can stay axis-aligned.
 */
function getHandlePositions(
  bounds: SelectionHandleBounds,
  zoom: number
): Record<SelectionHandleType, Point2D> {
  const { x, y, width, height } = bounds;

  return {
    nw: [x, y],
    n: [x + width / 2, y],
    ne: [x + width, y],
    e: [x + width, y + height / 2],
    se: [x + width, y + height],
    s: [x + width / 2, y + height],
    sw: [x, y + height],
    w: [x, y + height / 2],
    // Thin shapes are overly sensitive when the rotation handle sits too close
    // to the center.
    rotate: [x + width / 2, y - getRotationHandleOffset(width, height, zoom)],
  };
}

/** Selection outline with resize handles and a rotation handle. */
export function SelectionHandles({
  bounds,
  zoom,
  onHandlePointerDown,
  onHandlePointerUp,
  onHandleDragCancel,
}: SelectionHandlesProps) {
  const { x, y, width, height, rotation, center } = bounds;
  const [centerX, centerY] = center;
  const handles = getHandlePositions(bounds, zoom);
  const rotateHandlePosition = rotatePoint(handles.rotate, center, rotation);

  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={SELECTION_COLOR}
        strokeWidth={2 / zoom}
        strokeDasharray={`${5 / zoom},${5 / zoom}`}
        pointerEvents="none"
        transform={`rotate(${rotation} ${centerX} ${centerY})`}
      />

      {(Object.entries(handles) as [SelectionHandleType, Point2D][])
        .filter((entry): entry is [ResizeHandle, Point2D] => entry[0] !== "rotate")
        .map(([type, position]) => {
          const [handleX, handleY] = rotatePoint(position, center, rotation);
          return (
            <circle
              key={type}
              data-selection-handle={type}
              cx={handleX}
              cy={handleY}
              r={HANDLE_SIZE / zoom}
              fill="white"
              stroke={SELECTION_COLOR}
              strokeWidth={2 / zoom}
              style={{ cursor: getResizeCursor(type, rotation) }}
              onPointerDown={(event) => onHandlePointerDown(event, type)}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandleDragCancel}
              onLostPointerCapture={onHandleDragCancel}
            />
          );
        })}

      <line
        x1={centerX}
        y1={y}
        x2={handles.rotate[0]}
        y2={handles.rotate[1]}
        stroke={SELECTION_COLOR}
        strokeWidth={2 / zoom}
        strokeDasharray={`${3 / zoom},${3 / zoom}`}
        pointerEvents="none"
        transform={`rotate(${rotation} ${centerX} ${centerY})`}
      />
      <circle
        data-selection-handle="rotate"
        cx={rotateHandlePosition[0]}
        cy={rotateHandlePosition[1]}
        r={HANDLE_SIZE / zoom}
        fill={SELECTION_COLOR}
        stroke="white"
        strokeWidth={2 / zoom}
        style={{ cursor: "grab" }}
        onPointerDown={(event) => onHandlePointerDown(event, "rotate")}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandleDragCancel}
        onLostPointerCapture={onHandleDragCancel}
      />
    </>
  );
}
