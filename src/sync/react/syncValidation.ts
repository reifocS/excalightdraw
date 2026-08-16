import type { ActionLogEntry } from "../../board/ActionLog";
import type { Counter, RandomEventType, Shape, ShapeType } from "../../types/canvas";

const SHAPE_TYPES = new Set<ShapeType>([
  "rectangle",
  "circle",
  "arrow",
  "text",
  "image",
  "token",
]);
const RANDOM_EVENT_TYPES = new Set<RandomEventType>([
  "coin",
  "d6",
  "d20",
  "starter",
]);

export const MAX_CONNECTED_PEERS = 8;
export const MAX_SHAPES_PER_PEER = 2_000;
export const MAX_ACTION_LOG_SNAPSHOT_ENTRIES = 20;

const MAX_ID_LENGTH = 256;
const MAX_NAME_LENGTH = 80;
const MAX_ACTION_LENGTH = 500;
const MAX_TEXT_LENGTH = 20_000;
const MAX_URL_LENGTH = 16_384;
const MAX_COUNTERS = 64;
const MAX_COORDINATE = 10_000_000;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_EVENT_FUTURE_MS = 5 * 60 * 1_000;

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

export const isSafeImageSource = (value: unknown): value is string =>
  isBoundedString(value, MAX_URL_LENGTH) &&
  /^(https?:\/\/|data:image\/(?:gif|jpe?g|png|webp);base64,)/i.test(value);

const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const isSafeObjectKey = (value: string) => !UNSAFE_OBJECT_KEYS.has(value);

export const isValidPeerId = (value: unknown): value is string =>
  isBoundedString(value, MAX_ID_LENGTH) &&
  value.trim() === value &&
  isSafeObjectKey(value);

export const isValidShapeId = (value: unknown): value is string =>
  isBoundedString(value, MAX_ID_LENGTH) && isSafeObjectKey(value);

const normalizeTuple = (value: unknown): [number, number] | null => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  if (!isFiniteNumber(value[0]) || !isFiniteNumber(value[1])) return null;
  if (
    Math.abs(value[0]) > MAX_COORDINATE ||
    Math.abs(value[1]) > MAX_COORDINATE
  ) {
    return null;
  }
  return [value[0], value[1]];
};

const normalizeCounter = (value: unknown): Counter | null => {
  if (!isRecord(value) || !isBoundedString(value.label, MAX_NAME_LENGTH)) {
    return null;
  }

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

export const normalizeRemoteShape = (value: unknown): Shape | null => {
  if (!isRecord(value)) return null;
  if (!isValidShapeId(value.id)) return null;
  if (!SHAPE_TYPES.has(value.type as ShapeType)) return null;

  const point = normalizeTuple(value.point);
  const size = normalizeTuple(value.size);
  if (!point || !size) return null;
  if (!Number.isInteger(value.srcIndex) || (value.srcIndex as number) < 0) {
    return null;
  }

  const shape: Shape = {
    id: value.id,
    point,
    size,
    type: value.type as ShapeType,
    srcIndex: value.srcIndex as number,
  };

  if (value.text !== undefined) {
    if (!isBoundedString(value.text, MAX_TEXT_LENGTH, true)) return null;
    shape.text = value.text;
  }

  if (value.src !== undefined) {
    if (!Array.isArray(value.src) || value.src.length > 4) return null;
    if (!value.src.every(isSafeImageSource)) {
      return null;
    }
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
    if (
      !isFiniteNumber(value.fontSize) ||
      value.fontSize <= 0 ||
      value.fontSize > 4_096
    ) {
      return null;
    }
    shape.fontSize = value.fontSize;
  }
  if (value.values !== undefined) {
    const values = normalizeTuple(value.values);
    if (!values) return null;
    shape.values = values;
  }
  if (value.counters !== undefined) {
    if (!Array.isArray(value.counters) || value.counters.length > MAX_COUNTERS) {
      return null;
    }
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

export const normalizeRemoteShapeList = (value: unknown): Shape[] | null => {
  if (!Array.isArray(value) || value.length > MAX_SHAPES_PER_PEER) return null;
  const shapes = value.map(normalizeRemoteShape);
  if (shapes.some((shape) => shape === null)) return null;

  const ids = new Set<string>();
  for (const shape of shapes as Shape[]) {
    if (ids.has(shape.id)) return null;
    ids.add(shape.id);
  }

  return shapes as Shape[];
};

const normalizeOptionalName = (value: unknown) => {
  if (value === undefined) return undefined;
  return isBoundedString(value, MAX_NAME_LENGTH) ? value : null;
};

export const normalizeConnectedPayload = (
  value: unknown,
  fromPeerId: string
): { peerId: string; name?: string } | null => {
  if (!isRecord(value) || !isValidPeerId(fromPeerId)) return null;
  const name = normalizeOptionalName(value.name);
  if (name === null) return null;
  return { peerId: fromPeerId, name };
};

export const normalizeHeartbeatPayload = (
  value: unknown,
  fromPeerId: string,
  receivedAt = Date.now()
): { peerId: string; timestamp: number; name?: string } | null => {
  if (!isRecord(value) || !isValidPeerId(fromPeerId)) return null;
  const name = normalizeOptionalName(value.name);
  if (name === null) return null;
  return { peerId: fromPeerId, timestamp: receivedAt, name };
};

const normalizeTimestamp = (value: unknown, now: number) => {
  if (!isFiniteNumber(value)) return null;
  if (value < now - MAX_EVENT_AGE_MS || value > now + MAX_EVENT_FUTURE_MS) {
    return null;
  }
  return value;
};

const normalizeStringArray = (
  value: unknown,
  maximumEntries: number,
  maximumLength: number
): string[] | null => {
  if (!Array.isArray(value) || value.length > maximumEntries) return null;
  if (!value.every((entry) => isBoundedString(entry, maximumLength))) return null;
  return [...value];
};

const normalizeCardSources = (value: unknown): string[][] | null => {
  if (!Array.isArray(value) || value.length > 20) return null;
  const sources = value.map((entry) =>
    Array.isArray(entry) && entry.length <= 4 && entry.every(isSafeImageSource)
      ? [...entry]
      : null
  );
  if (sources.some((entry) => entry === null)) return null;
  return sources as string[][];
};

const hashActionIdentity = (identity: string) => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= BigInt(identity.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
};

export type SyncedActionLogEntry = ActionLogEntry & {
  eventId: string;
  timestamp: number;
  cardNames?: string[];
};

export const normalizeActionLogEntry = (
  value: unknown,
  options: { fromPeerId?: string; now?: number } = {}
): SyncedActionLogEntry | null => {
  if (!isRecord(value)) return null;
  const now = options.now ?? Date.now();
  const playerId = options.fromPeerId ?? value.playerId;
  if (!isValidPeerId(playerId)) return null;
  if (!isBoundedString(value.action, MAX_ACTION_LENGTH)) return null;
  if (
    !Number.isInteger(value.cardsInHand) ||
    (value.cardsInHand as number) < 0 ||
    (value.cardsInHand as number) > 1_000
  ) {
    return null;
  }

  const playerName = normalizeOptionalName(value.playerName);
  if (playerName === null) return null;
  const timestamp = normalizeTimestamp(value.timestamp ?? now, now);
  if (timestamp === null) return null;

  const cardSrcs =
    value.cardSrcs === undefined ? undefined : normalizeCardSources(value.cardSrcs);
  if (cardSrcs === null) return null;
  const cardNames =
    value.cardNames === undefined
      ? undefined
      : normalizeStringArray(value.cardNames, 20, MAX_NAME_LENGTH);
  if (cardNames === null) return null;

  const identity = JSON.stringify([
    playerId,
    timestamp,
    value.action,
    value.cardsInHand,
    playerName,
    cardSrcs,
    cardNames,
  ]);

  return {
    playerId,
    playerName,
    action: value.action,
    cardsInHand: value.cardsInHand as number,
    timestamp,
    cardSrcs,
    cardNames,
    eventId: `action:${hashActionIdentity(identity)}`,
  };
};

export const normalizeActionLogSnapshot = (
  value: unknown,
  fromPeerId: string,
  now = Date.now()
): SyncedActionLogEntry[] | null => {
  if (!isRecord(value) || !Array.isArray(value.entries)) return null;
  if (value.entries.length > MAX_ACTION_LOG_SNAPSHOT_ENTRIES) return null;
  const entries = value.entries.map((entry) =>
    normalizeActionLogEntry(entry, { fromPeerId, now })
  );
  if (entries.some((entry) => entry === null)) return null;
  return entries as SyncedActionLogEntry[];
};

export const normalizeRandomEventPayload = (
  value: unknown,
  fromPeerId: string,
  now = Date.now()
): {
  type: RandomEventType;
  result: string;
  playerName?: string;
  peerId: string;
  timestamp: number;
  cardsInHand: number;
} | null => {
  if (!isRecord(value) || !isValidPeerId(fromPeerId)) return null;
  if (!RANDOM_EVENT_TYPES.has(value.type as RandomEventType)) return null;
  if (!isBoundedString(value.result, MAX_ACTION_LENGTH)) return null;
  const playerName = normalizeOptionalName(value.playerName);
  if (playerName === null) return null;
  const timestamp = normalizeTimestamp(value.timestamp ?? now, now);
  if (timestamp === null) return null;
  if (
    !Number.isInteger(value.cardsInHand) ||
    (value.cardsInHand as number) < 0 ||
    (value.cardsInHand as number) > 1_000
  ) {
    return null;
  }
  return {
    type: value.type as RandomEventType,
    result: value.result,
    playerName,
    peerId: fromPeerId,
    timestamp,
    cardsInHand: value.cardsInHand as number,
  };
};

export const normalizeDiscoveredPeerIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > MAX_CONNECTED_PEERS) return null;
  if (!value.every(isValidPeerId)) return null;
  return Array.from(new Set(value));
};
