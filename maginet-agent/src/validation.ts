import type { Counter, Shape } from "./state.js";

export const MAX_SHAPES_PER_PEER = 2_000;
export const MAX_CONNECTED_PEERS = 8;
export const MAX_ACTION_LOG_SNAPSHOT_ENTRIES = 20;
export const MAX_HAND_CARDS = 1_000;

const MAX_ID_LENGTH = 256;
const MAX_NAME_LENGTH = 80;
const MAX_ACTION_LENGTH = 500;
const MAX_TEXT_LENGTH = 20_000;
const MAX_URL_LENGTH = 16_384;
const MAX_COUNTERS = 64;
const MAX_COORDINATE = 10_000_000;
const MAX_CARD_FACES = 4;
const MAX_CARD_SOURCE_GROUPS = 20;

const SHAPE_TYPES = new Set<Shape["type"]>([
  "rectangle",
  "circle",
  "arrow",
  "text",
  "image",
  "token",
]);

const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoundedString = (
  value: unknown,
  maximumLength: number,
  allowEmpty = false
): value is string =>
  typeof value === "string" &&
  value.length <= maximumLength &&
  (allowEmpty || value.length > 0);

export const isSafeObjectKey = (value: unknown): value is string =>
  typeof value === "string" && !UNSAFE_OBJECT_KEYS.has(value);

export const isValidPeerId = (value: unknown): value is string =>
  isBoundedString(value, MAX_ID_LENGTH) &&
  value.trim() === value &&
  isSafeObjectKey(value);

const isSafeImageSource = (value: unknown): value is string =>
  isBoundedString(value, MAX_URL_LENGTH) &&
  /^(https?:\/\/|data:image\/(?:gif|jpe?g|png|webp);base64,)/i.test(value);

const normalizeTuple = (value: unknown): [number, number] | null => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  if (!isFiniteNumber(value[0]) || !isFiniteNumber(value[1])) return null;
  if (Math.abs(value[0]) > MAX_COORDINATE || Math.abs(value[1]) > MAX_COORDINATE) {
    return null;
  }
  return [value[0], value[1]];
};

const normalizeCounter = (value: unknown): Counter | null => {
  if (!isRecord(value) || !isBoundedString(value.label, MAX_NAME_LENGTH)) return null;

  const counter: Counter = { label: value.label };
  for (const key of ["power", "toughness", "value"] as const) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    if (!isFiniteNumber(candidate)) return null;
    counter[key] = candidate;
  }
  if (value.color !== undefined) {
    if (!isBoundedString(value.color, 128, true)) return null;
    counter.color = value.color;
  }
  return counter;
};

/** Validates a shape received from a remote peer. Returns null when untrusted. */
export const normalizeRemoteShape = (value: unknown): Shape | null => {
  if (!isRecord(value)) return null;
  if (!isBoundedString(value.id, MAX_ID_LENGTH) || !isSafeObjectKey(value.id)) {
    return null;
  }
  if (!SHAPE_TYPES.has(value.type as Shape["type"])) return null;

  const point = normalizeTuple(value.point);
  const size = normalizeTuple(value.size);
  if (!point || !size) return null;
  if (!Number.isInteger(value.srcIndex) || (value.srcIndex as number) < 0) return null;

  const shape: Shape = {
    id: value.id,
    point,
    size,
    type: value.type as Shape["type"],
    srcIndex: value.srcIndex as number,
  };

  if (value.text !== undefined) {
    if (!isBoundedString(value.text, MAX_TEXT_LENGTH, true)) return null;
    shape.text = value.text;
  }
  if (value.src !== undefined) {
    if (!Array.isArray(value.src) || value.src.length > MAX_CARD_FACES) return null;
    if (!value.src.every(isSafeImageSource)) return null;
    if (value.src.length > 0 && shape.srcIndex >= value.src.length) return null;
    shape.src = [...value.src];
  }
  if (value.rotation !== undefined) {
    if (!isFiniteNumber(value.rotation)) return null;
    shape.rotation = value.rotation;
  }
  if (value.isFlipped !== undefined) {
    if (typeof value.isFlipped !== "boolean") return null;
    shape.isFlipped = value.isFlipped;
  }
  if (value.fontSize !== undefined) {
    if (!isFiniteNumber(value.fontSize) || value.fontSize <= 0 || value.fontSize > 4_096) {
      return null;
    }
    shape.fontSize = value.fontSize;
  }
  if (value.counters !== undefined) {
    if (!Array.isArray(value.counters) || value.counters.length > MAX_COUNTERS) return null;
    const counters = value.counters.map(normalizeCounter);
    if (counters.some((counter) => counter === null)) return null;
    shape.counters = counters as Counter[];
  }
  if (value.color !== undefined) {
    if (!isBoundedString(value.color, 128, true)) return null;
    shape.color = value.color;
  }

  return shape;
};

/** Drops any shape that fails validation and caps the list length. */
export const normalizeRemoteShapeList = (value: unknown): Shape[] => {
  if (!Array.isArray(value)) return [];
  const shapes: Shape[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (shapes.length >= MAX_SHAPES_PER_PEER) break;
    const shape = normalizeRemoteShape(entry);
    if (!shape || ids.has(shape.id)) continue;
    ids.add(shape.id);
    shapes.push(shape);
  }
  return shapes;
};

export const normalizeRemoteShapesByPeer = (
  value: unknown
): Record<string, Shape[]> => {
  if (!isRecord(value)) return {};
  const normalized: Record<string, Shape[]> = Object.create(null);
  const entries = Object.entries(value).slice(0, MAX_CONNECTED_PEERS + 1);
  for (const [peerId, shapes] of entries) {
    if (!isValidPeerId(peerId)) continue;
    normalized[peerId] = normalizeRemoteShapeList(shapes);
  }
  return normalized;
};

export interface RemoteActionLogEntry {
  timestamp: number;
  action: string;
  playerId?: string;
  playerName?: string;
  cardsInHand?: number;
  cardSrcs?: string[][];
}

const normalizeCardSources = (value: unknown): string[][] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const groups: string[][] = [];
  for (const entry of value.slice(0, MAX_CARD_SOURCE_GROUPS)) {
    if (!Array.isArray(entry) || entry.length > MAX_CARD_FACES) continue;
    if (!entry.every(isSafeImageSource)) continue;
    groups.push([...entry]);
  }
  return groups.length > 0 ? groups : undefined;
};

/** Validates an action-log entry received from a remote peer. */
export const normalizeRemoteActionLogEntry = (
  value: unknown,
  fromPeerId?: string,
  now = Date.now()
): RemoteActionLogEntry | null => {
  if (!isRecord(value)) return null;

  const playerId = isValidPeerId(fromPeerId)
    ? fromPeerId
    : isValidPeerId(value.playerId)
      ? value.playerId
      : undefined;

  return {
    timestamp: isFiniteNumber(value.timestamp) ? value.timestamp : now,
    action: isBoundedString(value.action, MAX_ACTION_LENGTH) ? value.action : "unknown",
    playerId,
    playerName: isBoundedString(value.playerName, MAX_NAME_LENGTH)
      ? value.playerName
      : undefined,
    cardsInHand:
      Number.isInteger(value.cardsInHand) &&
      (value.cardsInHand as number) >= 0 &&
      (value.cardsInHand as number) <= 1_000
        ? (value.cardsInHand as number)
        : undefined,
    cardSrcs: normalizeCardSources(value.cardSrcs),
  };
};

export const normalizeRemoteActionLogSnapshot = (
  value: unknown,
  fromPeerId?: string,
  now = Date.now()
): RemoteActionLogEntry[] => {
  if (!isRecord(value) || !Array.isArray(value.entries)) return [];
  return value.entries
    .slice(0, MAX_ACTION_LOG_SNAPSHOT_ENTRIES)
    .map((entry) => normalizeRemoteActionLogEntry(entry, fromPeerId, now))
    .filter((entry): entry is RemoteActionLogEntry => entry !== null);
};

export interface RemoteCardState {
  cards: number;
  deck: number;
  hand: Array<{ id: string; src: string[] }>;
}

/** Validates a card-state payload received from a remote peer. */
export const normalizeRemoteCardState = (value: unknown): RemoteCardState | null => {
  if (!isRecord(value)) return null;
  if (!Number.isInteger(value.cards) || !Number.isInteger(value.deck)) return null;
  if ((value.cards as number) < 0 || (value.deck as number) < 0) return null;

  const hand: RemoteCardState["hand"] = [];
  if (value.hand !== undefined) {
    if (!Array.isArray(value.hand)) return null;
    for (const entry of value.hand.slice(0, MAX_HAND_CARDS)) {
      if (!isRecord(entry)) continue;
      if (!isBoundedString(entry.id, MAX_ID_LENGTH) || !isSafeObjectKey(entry.id)) continue;
      if (!Array.isArray(entry.src) || entry.src.length > MAX_CARD_FACES) continue;
      if (!entry.src.every(isSafeImageSource)) continue;
      hand.push({ id: entry.id, src: [...entry.src] });
    }
  }

  return { cards: value.cards as number, deck: value.deck as number, hand };
};
