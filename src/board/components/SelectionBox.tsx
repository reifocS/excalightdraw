import React, { useRef } from "react";
import { Camera, Shape as ShapeType } from "../../types/canvas";
import { screenToCanvas } from "../../utils/vec";
import { getBounds } from "../../utils/canvas_utils";
import { useShapeStore } from "../../hooks/useShapeStore";
import {
  getDraggedRotation,
  getPointerAngleFromCenter,
  getResizeCursor,
  getResizedShape,
  getRotationHandleOffset,
  ResizeHandle,
  ShapeDimensions,
} from "./selectionBoxMath";
import { getShapeLocalBounds } from "./shapeTransforms";

type HandleType = ResizeHandle | "rotate";

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
  handle: HandleType;
  startPoint: [number, number];
  originalShape: ShapeType;
  originalBounds: ShapeDimensions & { x: number; y: number };
  originalCenter: [number, number];
  startPointerAngle: number | null;
};

const HANDLE_SIZE = 8;

export function SelectionBox({
  shape,
  zoom,
  cameraRef,
  onResize,
  onRotate,
}: SelectionBoxProps) {
  const dragSessionRef = useRef<DragSession | null>(null);

  const { rotation = 0 } = shape;
  const { x, y, width, height } = getShapeLocalBounds(shape);
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Thin shapes are overly sensitive when the rotation handle sits too close to center.
  const rotationHandleOffset = getRotationHandleOffset(width, height, zoom);

  // Handle positions in unrotated space (we rotate them for display).
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

  const finishDrag = () => {
    if (!dragSessionRef.current) return;
    dragSessionRef.current = null;
    useShapeStore.setState({
      isResizingShape: false,
      isRotatingShape: false,
    });
  };

  const handlePointerDown = (
    e: React.PointerEvent<SVGCircleElement>,
    handle: HandleType
  ) => {
    e.stopPropagation();

    const camera = cameraRef.current;
    if (!camera) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const pointer = screenToCanvas({ x: e.clientX, y: e.clientY }, camera);
    const originalCenter: [number, number] = [centerX, centerY];
    dragSessionRef.current = {
      handle,
      startPoint: [pointer.x, pointer.y],
      originalShape: {
        ...shape,
        point: [...shape.point],
        size: [...shape.size],
      },
      originalBounds: { x, y, width, height },
      originalCenter,
      startPointerAngle:
        handle === "rotate"
          ? getPointerAngleFromCenter(originalCenter, [pointer.x, pointer.y])
          : null,
    };

    useShapeStore.getState().pushHistory();
    useShapeStore.setState(
      handle === "rotate"
        ? { isRotatingShape: true }
        : { isResizingShape: true }
    );
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const dragSession = dragSessionRef.current;
    if (!dragSession) return;

    const camera = cameraRef.current;
    if (!camera) return;
    const pointer = screenToCanvas({ x: e.clientX, y: e.clientY }, camera);
    const currentPoint: [number, number] = [pointer.x, pointer.y];

    if (dragSession.handle === "rotate") {
      if (dragSession.startPointerAngle === null) return;

      const currentPointerAngle = getPointerAngleFromCenter(
        dragSession.originalCenter,
        currentPoint
      );
      let nextRotation = getDraggedRotation(
        dragSession.originalShape.rotation || 0,
        dragSession.startPointerAngle,
        currentPointerAngle
      );

      if (e.shiftKey) {
        nextRotation = Math.round(nextRotation / 15) * 15;
      }

      onRotate(nextRotation);
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
      lockAspectRatio: e.shiftKey,
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

  const handlePointerUp = (e: React.PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    finishDrag();
  };

  const rotatePoint = (px: number, py: number): [number, number] => {
    if (rotation === 0) return [px, py];
    const angle = (rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = px - centerX;
    const dy = py - centerY;
    return [
      centerX + dx * cos - dy * sin,
      centerY + dx * sin + dy * cos,
    ];
  };

  return (
    <g data-selection-box-shape-id={shape.id} onPointerMove={handlePointerMove}>
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
        .map(([type, [handleX, handleY]]) => {
          const [rotatedX, rotatedY] = rotatePoint(handleX, handleY);
          return (
            <circle
              key={type}
              data-selection-handle={type}
              cx={rotatedX}
              cy={rotatedY}
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

      <g>
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
          const [rotatedX, rotatedY] = rotatePoint(
            handles.rotate[0],
            handles.rotate[1]
          );
          return (
            <circle
              data-selection-handle="rotate"
              cx={rotatedX}
              cy={rotatedY}
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
    </g>
  );
}
