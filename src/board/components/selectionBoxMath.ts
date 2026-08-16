import {
  addPoints,
  clampScaleMagnitude,
  getSign,
  normalizeAngleDelta,
  Point2D,
  rotateVector,
  subtractPoints,
} from "../../utils/geometry";

export type { Point2D };
export { getPointerAngleFromCenter, normalizeAngleDelta } from "../../utils/geometry";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type ShapeDimensions = {
  width: number;
  height: number;
};

type ResizeShapeOptions = {
  handle: ResizeHandle;
  startPointer: Point2D;
  currentPointer: Point2D;
  originalPoint: Point2D;
  originalDimensions: ShapeDimensions;
  rotation: number;
  lockAspectRatio?: boolean;
  minWidth?: number;
  minHeight?: number;
  minUniformScale?: number;
  getUniformDimensions?: (scale: number) => ShapeDimensions;
};

export type ResizeShapeResult = {
  point: Point2D;
  size: Point2D;
  scale: number | null;
};

export const ROTATION_HANDLE_OFFSET = 30;
export const ROTATION_HANDLE_MIN_SCREEN_DISTANCE = 40;
export const ROTATION_HANDLE_MAX_SCREEN_DISTANCE = 72;
const ROTATION_HANDLE_SCREEN_SCALE = 0.6;

/** Unit offsets from the selection center toward each resize handle. */
export const HANDLE_DIRECTIONS: Record<ResizeHandle, Point2D> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};

export const OPPOSITE_HANDLES: Record<ResizeHandle, ResizeHandle> = {
  nw: "se",
  n: "s",
  ne: "sw",
  e: "w",
  se: "nw",
  s: "n",
  sw: "ne",
  w: "e",
};

const HANDLE_CURSOR_INDEX: Record<ResizeHandle, number> = {
  n: 0,
  s: 0,
  ne: 1,
  sw: 1,
  e: 2,
  w: 2,
  nw: 3,
  se: 3,
};

const RESIZE_CURSORS = [
  "ns-resize",
  "nesw-resize",
  "ew-resize",
  "nwse-resize",
] as const;

export function getDraggedRotation(
  initialRotation: number,
  startPointerAngle: number,
  currentPointerAngle: number
) {
  return initialRotation + normalizeAngleDelta(currentPointerAngle - startPointerAngle);
}

export const ROTATION_SNAP_DEGREES = 15;

export function snapRotation(rotation: number, shouldSnap: boolean) {
  return shouldSnap
    ? Math.round(rotation / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES
    : rotation;
}

export function getResizeCursor(handle: ResizeHandle, rotation: number) {
  const rotationSteps = Math.round(rotation / 45);
  const index = ((HANDLE_CURSOR_INDEX[handle] + rotationSteps) % 4 + 4) % 4;
  return RESIZE_CURSORS[index];
}

type HandleDragScaleOptions = {
  direction: Point2D;
  dimensions: ShapeDimensions;
  rotation: number;
  handlePoint: Point2D;
  scaleOrigin: Point2D;
  startPointer: Point2D;
  currentPointer: Point2D;
};

/**
 * Signed scale factors along the selection's local axes for a handle drag.
 * The offset between the pointer press and the handle is preserved so an
 * off-center grab does not make the selection jump on its first move.
 */
export function getHandleDragScale({
  direction,
  dimensions,
  rotation,
  handlePoint,
  scaleOrigin,
  startPointer,
  currentPointer,
}: HandleDragScaleOptions): Point2D {
  const cursorHandleOffset = subtractPoints(startPointer, handlePoint);
  const effectivePointer = subtractPoints(currentPointer, cursorHandleOffset);
  const localDistance = rotateVector(
    subtractPoints(effectivePointer, scaleOrigin),
    -rotation
  );
  const initialLocalDistance: Point2D = [
    direction[0] * dimensions.width,
    direction[1] * dimensions.height,
  ];

  const scaleX =
    direction[0] === 0 ? 1 : localDistance[0] / initialLocalDistance[0];
  const scaleY =
    direction[1] === 0 ? 1 : localDistance[1] / initialLocalDistance[1];

  return [
    Number.isFinite(scaleX) ? scaleX : 1,
    Number.isFinite(scaleY) ? scaleY : 1,
  ];
}

/**
 * Resize around the handle opposite the dragged handle. Pointer movement is
 * projected into the shape's local axes, matching the scale-origin approach
 * used by mature canvas editors. Keeping the scale signed lets a drag cross
 * the opposite edge and continue expanding without storing negative sizes.
 */
export function getResizedShape({
  handle,
  startPointer,
  currentPointer,
  originalPoint,
  originalDimensions,
  rotation,
  lockAspectRatio = false,
  minWidth = 10,
  minHeight = 10,
  minUniformScale = 0.01,
  getUniformDimensions,
}: ResizeShapeOptions): ResizeShapeResult {
  const { width: originalWidth, height: originalHeight } = originalDimensions;
  const direction = HANDLE_DIRECTIONS[handle];
  const originalCenter: Point2D = [
    originalPoint[0] + originalWidth / 2,
    originalPoint[1] + originalHeight / 2,
  ];

  const handleFromCenter: Point2D = [
    (direction[0] * originalWidth) / 2,
    (direction[1] * originalHeight) / 2,
  ];
  const originFromCenter: Point2D = [-handleFromCenter[0], -handleFromCenter[1]];
  const handlePoint = addPoints(originalCenter, rotateVector(handleFromCenter, rotation));
  const scaleOrigin = addPoints(originalCenter, rotateVector(originFromCenter, rotation));

  let [scaleX, scaleY] = getHandleDragScale({
    direction,
    dimensions: originalDimensions,
    rotation,
    handlePoint,
    scaleOrigin,
    startPointer,
    currentPointer,
  });

  const shouldResizeUniformly = lockAspectRatio || getUniformDimensions !== undefined;
  let uniformScale: number | null = null;
  let nextDimensions: ShapeDimensions;

  if (shouldResizeUniformly) {
    if (direction[0] === 0) {
      uniformScale = Math.abs(scaleY);
    } else if (direction[1] === 0) {
      uniformScale = Math.abs(scaleX);
    } else {
      uniformScale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
    }

    const dimensionMinimumScale = Math.max(
      originalWidth > 0 ? minWidth / originalWidth : 0,
      originalHeight > 0 ? minHeight / originalHeight : 0
    );
    uniformScale = Math.max(
      uniformScale,
      getUniformDimensions ? minUniformScale : dimensionMinimumScale,
      minUniformScale
    );
    nextDimensions = getUniformDimensions
      ? getUniformDimensions(uniformScale)
      : {
        width: originalWidth * uniformScale,
        height: originalHeight * uniformScale,
      };
  } else {
    if (direction[0] !== 0 && originalWidth > 0) {
      scaleX = clampScaleMagnitude(scaleX, minWidth / originalWidth);
    }
    if (direction[1] !== 0 && originalHeight > 0) {
      scaleY = clampScaleMagnitude(scaleY, minHeight / originalHeight);
    }

    nextDimensions = {
      width: direction[0] === 0 ? originalWidth : originalWidth * Math.abs(scaleX),
      height: direction[1] === 0 ? originalHeight : originalHeight * Math.abs(scaleY),
    };
  }

  const extentFromOrigin: Point2D = [
    direction[0] === 0
      ? 0
      : direction[0] * getSign(scaleX) * nextDimensions.width,
    direction[1] === 0
      ? 0
      : direction[1] * getSign(scaleY) * nextDimensions.height,
  ];
  const centerFromOrigin = rotateVector(
    [extentFromOrigin[0] / 2, extentFromOrigin[1] / 2],
    rotation
  );
  const nextCenter = addPoints(scaleOrigin, centerFromOrigin);

  return {
    point: [
      nextCenter[0] - nextDimensions.width / 2,
      nextCenter[1] - nextDimensions.height / 2,
    ],
    size: [nextDimensions.width, nextDimensions.height],
    scale: uniformScale,
  };
}

export function getRotationHandleOffset(
  width: number,
  height: number,
  zoom: number
) {
  const safeZoom = Math.max(zoom, 0.0001);
  const screenMaxDimension = Math.max(width, height) * safeZoom;
  const desiredScreenRadius = Math.max(
    ROTATION_HANDLE_MIN_SCREEN_DISTANCE,
    Math.min(
      ROTATION_HANDLE_MAX_SCREEN_DISTANCE,
      screenMaxDimension * ROTATION_HANDLE_SCREEN_SCALE
    )
  );

  return Math.max(
    ROTATION_HANDLE_OFFSET / safeZoom,
    desiredScreenRadius / safeZoom - height / 2
  );
}
