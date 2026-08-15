import { Shape as ShapeType } from "../../types/canvas";
import { getBounds } from "../../utils/canvas_utils";

type ShapeDimensions = {
  width: number;
  height: number;
};

export type ShapeBounds = ShapeDimensions & {
  x: number;
  y: number;
};

export type ShapePageBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

type BoundsLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function rotateVector(
  vector: [number, number],
  angleDegrees: number
): [number, number] {
  if (angleDegrees === 0) {
    return vector;
  }

  const angle = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    vector[0] * cos - vector[1] * sin,
    vector[0] * sin + vector[1] * cos,
  ];
}

function rotatePoint(
  point: [number, number],
  center: [number, number],
  rotation: number
): [number, number] {
  const offset = rotateVector(
    [point[0] - center[0], point[1] - center[1]],
    rotation
  );
  return [center[0] + offset[0], center[1] + offset[1]];
}

function getRotatedTopLeftOffset(
  dimensions: ShapeDimensions,
  rotation: number
): [number, number] {
  const halfWidth = dimensions.width / 2;
  const halfHeight = dimensions.height / 2;
  const rotatedHalf = rotateVector([-halfWidth, -halfHeight], rotation);

  return [halfWidth + rotatedHalf[0], halfHeight + rotatedHalf[1]];
}

export function getShapeRenderDimensions(shape: ShapeType): ShapeDimensions {
  if (shape.type === "text") {
    const bounds = getBounds(shape.text ?? "", 0, 0, shape.fontSize);
    return {
      width: bounds.width,
      height: bounds.height,
    };
  }

  return {
    width: Math.abs(shape.size[0]),
    height: Math.abs(shape.size[1]),
  };
}

export function getShapeLocalBounds(
  shape: ShapeType,
  pointOverride?: [number, number]
): ShapeBounds {
  const [pointX, pointY] = pointOverride ?? (shape.point as [number, number]);
  const { width, height } = getShapeRenderDimensions(shape);

  if (shape.type === "text") {
    return { x: pointX, y: pointY, width, height };
  }

  return {
    x: shape.size[0] < 0 ? pointX - width : pointX,
    y: shape.size[1] < 0 ? pointY - height : pointY,
    width,
    height,
  };
}

export function getRotatedShapeCorners(
  shape: ShapeType,
  pointOverride?: [number, number]
) {
  const bounds = getShapeLocalBounds(shape, pointOverride);
  const center: [number, number] = [
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  ];

  return [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x, bounds.y + bounds.height],
  ].map((point) =>
    rotatePoint(point as [number, number], center, shape.rotation || 0)
  );
}

export function getShapePageBounds(
  shape: ShapeType,
  pointOverride?: [number, number]
): ShapePageBounds {
  const corners = getRotatedShapeCorners(shape, pointOverride);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
  };
}

function projectPoints(points: [number, number][], axis: [number, number]) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    const projection = point[0] * axis[0] + point[1] * axis[1];
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }

  return { min, max };
}

export function doesShapeIntersectBounds(shape: ShapeType, bounds: BoundsLike) {
  const shapeCorners = getRotatedShapeCorners(shape);
  const boundsCorners: [number, number][] = [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x, bounds.y + bounds.height],
  ];
  const rotation = ((shape.rotation || 0) * Math.PI) / 180;
  const axes: [number, number][] = [
    [1, 0],
    [0, 1],
    [Math.cos(rotation), Math.sin(rotation)],
    [-Math.sin(rotation), Math.cos(rotation)],
  ];

  return axes.every((axis) => {
    const shapeProjection = projectPoints(shapeCorners, axis);
    const boundsProjection = projectPoints(boundsCorners, axis);
    return (
      shapeProjection.max >= boundsProjection.min &&
      boundsProjection.max >= shapeProjection.min
    );
  });
}

export function getShapeRotationTransform(shape: ShapeType) {
  const { x, y, width, height } = getShapeLocalBounds(shape);

  return `rotate(${shape.rotation || 0} ${x + width / 2} ${y + height / 2})`;
}

export function getAdjustedPointForFixedRotatedTopLeft(
  point: [number, number],
  previousDimensions: ShapeDimensions,
  nextDimensions: ShapeDimensions,
  rotation: number
): [number, number] {
  if (rotation === 0) {
    return point;
  }

  const previousOffset = getRotatedTopLeftOffset(previousDimensions, rotation);
  const nextOffset = getRotatedTopLeftOffset(nextDimensions, rotation);

  return [
    point[0] + previousOffset[0] - nextOffset[0],
    point[1] + previousOffset[1] - nextOffset[1],
  ];
}
