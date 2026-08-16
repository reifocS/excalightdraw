import { Shape as ShapeType } from "../../types/canvas";
import {
  getRotatedShapeCorners,
  getShapeLocalBounds,
  getShapeRenderDimensions,
} from "./shapeTransforms";
import {
  getHandleDragScale,
  HANDLE_DIRECTIONS,
  OPPOSITE_HANDLES,
  ResizeHandle,
} from "./selectionBoxMath";
import {
  clampScaleMagnitude,
  degreesToRadians,
  getAngleDistance,
  getPointsExtent,
  normalizeAngle,
  Point2D,
  radiansToDegrees,
  rotatePoint,
  rotateVector,
} from "../../utils/geometry";

export type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  center: [number, number];
};

export type MultiSelectionResizeResult = {
  shapes: ShapeType[];
  scale: [number, number];
};

type ResizeMultiSelectionOptions = {
  shapes: ShapeType[];
  bounds: SelectionBounds;
  handle: ResizeHandle;
  startPointer: [number, number];
  currentPointer: [number, number];
  lockAspectRatio?: boolean;
  minScale?: number;
};

const ANGLE_EPSILON = 0.001;

function areAnglesCompatible(left: number, right: number) {
  const delta = normalizeAngle(left - right) % 90;
  return delta < ANGLE_EPSILON || 90 - delta < ANGLE_EPSILON;
}

function getShapeCenter(shape: ShapeType): Point2D {
  const bounds = getShapeLocalBounds(shape);
  return [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
}

function getHandlePoint(
  bounds: SelectionBounds,
  handle: ResizeHandle
): Point2D {
  const [directionX, directionY] = HANDLE_DIRECTIONS[handle];
  const localPoint: Point2D = [
    bounds.center[0] + (directionX * bounds.width) / 2,
    bounds.center[1] + (directionY * bounds.height) / 2,
  ];
  return rotatePoint(localPoint, bounds.center, bounds.rotation);
}

function scalePoint(
  point: [number, number],
  origin: [number, number],
  scale: [number, number],
  axisRotation: number
): [number, number] {
  const local = rotateVector(
    [point[0] - origin[0], point[1] - origin[1]],
    -axisRotation
  );
  const scaled = rotateVector(
    [local[0] * scale[0], local[1] * scale[1]],
    axisRotation
  );
  return [origin[0] + scaled[0], origin[1] + scaled[1]];
}

function getScaledRotation(
  shapeRotation: number,
  selectionRotation: number,
  scale: [number, number]
) {
  const relativeRotation = degreesToRadians(shapeRotation - selectionRotation);
  const transformedX = Math.cos(relativeRotation) * scale[0];
  const transformedY = Math.sin(relativeRotation) * scale[1];
  return (
    selectionRotation + radiansToDegrees(Math.atan2(transformedY, transformedX))
  );
}

export function getSharedShapeRotation(shapes: ShapeType[]) {
  if (shapes.length === 0) return 0;
  const rotation = shapes[0].rotation || 0;
  return shapes.every(
    (shape) => getAngleDistance(shape.rotation || 0, rotation) < ANGLE_EPSILON
  )
    ? rotation
    : 0;
}

export function getMultiSelectionBounds(
  shapes: ShapeType[]
): SelectionBounds | null {
  if (shapes.length === 0) return null;

  const rotation = getSharedShapeRotation(shapes);
  const unrotatedCorners = shapes
    .flatMap((shape) => getRotatedShapeCorners(shape))
    .map((point) => rotateVector(point, -rotation));
  const { left, right, top, bottom } = getPointsExtent(unrotatedCorners);
  const center = rotateVector(
    [(left + right) / 2, (top + bottom) / 2],
    rotation
  );

  return {
    x: center[0] - (right - left) / 2,
    y: center[1] - (bottom - top) / 2,
    width: right - left,
    height: bottom - top,
    rotation,
    center,
  };
}

export function canDeformMultiSelection(
  shapes: ShapeType[],
  selectionRotation: number
) {
  return shapes.every(
    (shape) =>
      shape.type !== "text" &&
      areAnglesCompatible(shape.rotation || 0, selectionRotation)
  );
}

export function resizeMultiSelection({
  shapes,
  bounds,
  handle,
  startPointer,
  currentPointer,
  lockAspectRatio = false,
  minScale = 0.01,
}: ResizeMultiSelectionOptions): MultiSelectionResizeResult {
  const direction = HANDLE_DIRECTIONS[handle];
  const handlePoint = getHandlePoint(bounds, handle);
  const scaleOrigin = getHandlePoint(bounds, OPPOSITE_HANDLES[handle]);
  let [scaleX, scaleY] = getHandleDragScale({
    direction,
    dimensions: bounds,
    rotation: bounds.rotation,
    handlePoint,
    scaleOrigin,
    startPointer,
    currentPointer,
  });

  if (lockAspectRatio) {
    if (direction[1] === 0) {
      scaleY = Math.abs(scaleX);
    } else if (direction[0] === 0) {
      scaleX = Math.abs(scaleY);
    } else if (Math.abs(scaleX) > Math.abs(scaleY)) {
      scaleY = Math.abs(scaleX) * (scaleY < 0 ? -1 : 1);
    } else {
      scaleX = Math.abs(scaleY) * (scaleX < 0 ? -1 : 1);
    }
  } else {
    if (direction[0] === 0) scaleX = 1;
    if (direction[1] === 0) scaleY = 1;
  }

  scaleX = clampScaleMagnitude(scaleX, minScale);
  scaleY = clampScaleMagnitude(scaleY, minScale);
  const selectionScale: [number, number] = [scaleX, scaleY];

  const nextShapes = shapes.map((shape) => {
    const originalCenter = getShapeCenter(shape);
    const nextCenter = scalePoint(
      originalCenter,
      scaleOrigin,
      selectionScale,
      bounds.rotation
    );
    const originalDimensions = getShapeRenderDimensions(shape);
    const shapeRotation = shape.rotation || 0;
    const compatible = areAnglesCompatible(shapeRotation, bounds.rotation);

    let widthScale: number;
    let heightScale: number;
    let nextRotation = shapeRotation;

    if (!compatible) {
      const uniformScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));
      widthScale = uniformScale;
      heightScale = uniformScale;
      if (Math.sign(scaleX) * Math.sign(scaleY) < 0) {
        nextRotation = 2 * bounds.rotation - shapeRotation;
      } else if (scaleX < 0 && scaleY < 0) {
        nextRotation = shapeRotation + 180;
      }
    } else {
      const relativeRotation = normalizeAngle(shapeRotation - bounds.rotation);
      const axesAreSwapped =
        Math.abs(relativeRotation - 90) < ANGLE_EPSILON ||
        Math.abs(relativeRotation - 270) < ANGLE_EPSILON;
      widthScale = Math.abs(axesAreSwapped ? scaleY : scaleX);
      heightScale = Math.abs(axesAreSwapped ? scaleX : scaleY);
      nextRotation = getScaledRotation(
        shapeRotation,
        bounds.rotation,
        selectionScale
      );
    }

    if (shape.type === "text") {
      const fontScale = Math.min(widthScale, heightScale);
      const nextShape: ShapeType = {
        ...shape,
        fontSize: (shape.fontSize ?? 16) * fontScale,
        rotation: nextRotation,
      };
      const nextDimensions = getShapeRenderDimensions(nextShape);
      return {
        ...nextShape,
        point: [
          nextCenter[0] - nextDimensions.width / 2,
          nextCenter[1] - nextDimensions.height / 2,
        ],
        size: [nextDimensions.width, nextDimensions.height],
      };
    }

    const nextDimensions = {
      width: originalDimensions.width * widthScale,
      height: originalDimensions.height * heightScale,
    };
    return {
      ...shape,
      point: [
        nextCenter[0] - nextDimensions.width / 2,
        nextCenter[1] - nextDimensions.height / 2,
      ],
      size: [nextDimensions.width, nextDimensions.height],
      rotation: nextRotation,
    };
  });

  return { shapes: nextShapes, scale: selectionScale };
}

export function rotateMultiSelection(
  shapes: ShapeType[],
  center: [number, number],
  rotationDelta: number
) {
  return shapes.map((shape) => {
    const nextCenter = rotatePoint(getShapeCenter(shape), center, rotationDelta);
    const dimensions = getShapeRenderDimensions(shape);
    return {
      ...shape,
      point: [
        nextCenter[0] - dimensions.width / 2,
        nextCenter[1] - dimensions.height / 2,
      ],
      rotation: (shape.rotation || 0) + rotationDelta,
    };
  });
}
