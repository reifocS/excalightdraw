export type Point2D = [number, number];

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

const HANDLE_DIRECTIONS: Record<ResizeHandle, Point2D> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
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

function rotateVector(vector: Point2D, angleDegrees: number): Point2D {
  if (angleDegrees === 0) return vector;

  const angle = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    vector[0] * cos - vector[1] * sin,
    vector[0] * sin + vector[1] * cos,
  ];
}

function add(left: Point2D, right: Point2D): Point2D {
  return [left[0] + right[0], left[1] + right[1]];
}

function subtract(left: Point2D, right: Point2D): Point2D {
  return [left[0] - right[0], left[1] - right[1]];
}

function getSign(value: number) {
  return value < 0 ? -1 : 1;
}

function clampScaleMagnitude(scale: number, minimumMagnitude: number) {
  return getSign(scale) * Math.max(Math.abs(scale), minimumMagnitude);
}

export function getPointerAngleFromCenter(
  center: Point2D,
  point: Point2D
) {
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}

export function normalizeAngleDelta(delta: number) {
  let normalized = ((delta + 180) % 360 + 360) % 360 - 180;

  if (normalized === -180 && delta > 0) {
    normalized = 180;
  }

  return normalized;
}

export function getDraggedRotation(
  initialRotation: number,
  startPointerAngle: number,
  currentPointerAngle: number
) {
  return initialRotation + normalizeAngleDelta(currentPointerAngle - startPointerAngle);
}

export function getResizeCursor(handle: ResizeHandle, rotation: number) {
  const rotationSteps = Math.round(rotation / 45);
  const index = ((HANDLE_CURSOR_INDEX[handle] + rotationSteps) % 4 + 4) % 4;
  return RESIZE_CURSORS[index];
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
  const handlePoint = add(originalCenter, rotateVector(handleFromCenter, rotation));
  const scaleOrigin = add(originalCenter, rotateVector(originFromCenter, rotation));

  // Preserve where inside the handle the pointer was pressed, so an off-center
  // grab does not make the selection jump on its first move.
  const cursorHandleOffset = subtract(startPointer, handlePoint);
  const effectivePointer = subtract(currentPointer, cursorHandleOffset);
  const localDistance = rotateVector(subtract(effectivePointer, scaleOrigin), -rotation);
  const initialLocalDistance: Point2D = [
    direction[0] * originalWidth,
    direction[1] * originalHeight,
  ];

  let scaleX = direction[0] === 0 ? 1 : localDistance[0] / initialLocalDistance[0];
  let scaleY = direction[1] === 0 ? 1 : localDistance[1] / initialLocalDistance[1];
  if (!Number.isFinite(scaleX)) scaleX = 1;
  if (!Number.isFinite(scaleY)) scaleY = 1;

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
  const nextCenter = add(scaleOrigin, centerFromOrigin);

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
