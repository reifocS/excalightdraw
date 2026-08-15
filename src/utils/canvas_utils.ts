import { Camera } from "../types/canvas";
import vec from "./vec";

export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return {
    x: camera.x - dx / camera.z,
    y: camera.y - dy / camera.z,
    z: camera.z,
  };
}

export function getCameraZoom(zoom: number): number {
  return vec.clamp(zoom, 0.5, 10);
}

export function zoomCamera(
  camera: Camera,
  point: number[],
  dz: number
): Camera {
  const next = getCameraZoom(camera.z - (dz / 50) * camera.z);
  const p0 = screenToWorld(point, camera);
  const zoomed = { ...camera, z: next };
  const p1 = screenToWorld(point, zoomed);
  const [x, y] = vec.add([camera.x, camera.y], vec.sub(p1, p0));

  return { ...zoomed, x, y };
}
export function screenToWorld(point: number[], camera: Camera): [number, number] {
  const [x, y] = vec.sub(vec.div(point, camera.z), [camera.x, camera.y]);
  return [x, y];
}
let canvas: HTMLCanvasElement | null = null;
/**
 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
 *
 * @param {String} text The text to be rendered.
 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
 *
 * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
export function getTextWidth(text: string, font: string) {
  if (typeof document === "undefined") return 0;
  // re-use canvas object for better performance
  canvas = canvas || document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return 0;
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

let measureTextarea: HTMLTextAreaElement | null = null;
const textMeasurementCache = new Map<string, { width: number; height: number }>();
const TEXT_MEASUREMENT_CACHE_LIMIT = 500;

function ensureMeasureTextarea(): HTMLTextAreaElement | null {
  if (typeof document === "undefined") return null;

  if (measureTextarea && measureTextarea.isConnected) return measureTextarea;

  const existing = document.getElementById("__textMeasureTextarea");
  if (existing && existing instanceof HTMLTextAreaElement) {
    measureTextarea = existing;
    return measureTextarea;
  }

  const textarea = document.createElement("textarea");
  textarea.id = "__textMeasureTextarea";
  textarea.wrap = "off";
  textarea.rows = 1;
  textarea.cols = 1;
  textarea.tabIndex = -1;
  textarea.setAttribute("aria-hidden", "true");

  Object.assign(textarea.style, {
    boxSizing: "border-box",
    whiteSpace: "pre",
    width: "0",
    height: "0",
    border: "0",
    padding: "4px",
    margin: "0px",
    visibility: "hidden",
    pointerEvents: "none",
    position: "absolute",
    top: "-500px",
    left: "0px",
    lineHeight: "normal",
    fontFamily: "Arial",
    fontStyle: "normal",
    fontWeight: "400",
    letterSpacing: "normal",
    textAlign: "start",
    textIndent: "0",
    textTransform: "none",
    overflow: "hidden",
    resize: "none",
  });

  document.body.appendChild(textarea);
  measureTextarea = textarea;
  return measureTextarea;
}

export const getBounds = (
  text: string,
  x: number,
  y: number,
  fontSize?: number
) => {
  const resolvedFontSize = fontSize ?? 16;
  const cacheKey = `${resolvedFontSize}\u0000${text}`;
  const cachedMeasurement = textMeasurementCache.get(cacheKey);
  if (cachedMeasurement) {
    return {
      minX: x,
      maxX: x + cachedMeasurement.width,
      minY: y,
      maxY: y + cachedMeasurement.height,
      ...cachedMeasurement,
    };
  }

  const textarea = ensureMeasureTextarea();
  if (!textarea) {
    return {
      minX: x,
      maxX: x,
      minY: y,
      maxY: y,
      width: 0,
      height: 0,
    };
  }

  textarea.style.fontSize = `${resolvedFontSize}px`;
  textarea.value = `${text || " "}\u200d`;

  const [minX, minY] = [x, y];
  const [width, height] = [textarea.scrollWidth, textarea.scrollHeight];
  if (textMeasurementCache.size >= TEXT_MEASUREMENT_CACHE_LIMIT) {
    const oldestKey = textMeasurementCache.keys().next().value;
    if (oldestKey !== undefined) textMeasurementCache.delete(oldestKey);
  }
  textMeasurementCache.set(cacheKey, { width, height });
  return {
    minX,
    maxX: minX + width,
    minY,
    maxY: minY + height,
    width,
    height,
  };
};
