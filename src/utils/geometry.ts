export type Point2D = [number, number];

export function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

export function addPoints(left: Point2D, right: Point2D): Point2D {
  return [left[0] + right[0], left[1] + right[1]];
}

export function subtractPoints(left: Point2D, right: Point2D): Point2D {
  return [left[0] - right[0], left[1] - right[1]];
}

export function rotateVector(vector: Point2D, angleDegrees: number): Point2D {
  if (angleDegrees === 0) return vector;

  const angle = degreesToRadians(angleDegrees);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    vector[0] * cos - vector[1] * sin,
    vector[0] * sin + vector[1] * cos,
  ];
}

export function rotatePoint(
  point: Point2D,
  center: Point2D,
  angleDegrees: number
): Point2D {
  const offset = rotateVector(subtractPoints(point, center), angleDegrees);
  return addPoints(center, offset);
}

/** Wrap an angle into [0, 360). */
export function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

/** Wrap an angle delta into (-180, 180], keeping the drag direction. */
export function normalizeAngleDelta(delta: number) {
  let normalized = ((delta + 180) % 360 + 360) % 360 - 180;

  if (normalized === -180 && delta > 0) {
    normalized = 180;
  }

  return normalized;
}

export function getAngleDistance(left: number, right: number) {
  const delta = Math.abs(normalizeAngle(left) - normalizeAngle(right));
  return Math.min(delta, 360 - delta);
}

export function getPointerAngleFromCenter(center: Point2D, point: Point2D) {
  const [dx, dy] = subtractPoints(point, center);
  return radiansToDegrees(Math.atan2(dy, dx)) + 90;
}

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Corners of an axis-aligned box, clockwise from the top-left. */
export function getBoxCorners({ x, y, width, height }: Box): Point2D[] {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

export type Extent = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Axis-aligned extent of a point cloud. */
export function getPointsExtent(points: Point2D[]): Extent {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);

  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

export function getSign(value: number) {
  return value < 0 ? -1 : 1;
}

/** Keep a signed scale factor from shrinking below a magnitude. */
export function clampScaleMagnitude(scale: number, minimumMagnitude: number) {
  return getSign(scale) * Math.max(Math.abs(scale), minimumMagnitude);
}
