import { describe, expect, it } from "vitest";
import type { Shape } from "../../types/canvas";
import {
  MAX_ACTION_LOG_SNAPSHOT_ENTRIES,
  normalizeActionLogEntry,
  normalizeActionLogSnapshot,
  normalizeConnectedPayload,
  normalizeHeartbeatPayload,
  normalizeRandomEventPayload,
  normalizeRemoteShape,
  normalizeRemoteShapeList,
} from "./syncValidation";

const validShape: Shape = {
  id: "shape-a",
  point: [120, 180],
  size: [80, 120],
  type: "image",
  src: ["https://example.com/card.png"],
  srcIndex: 0,
};

describe("peer sync validation", () => {
  it("accepts safe shapes as cloned data", () => {
    const normalized = normalizeRemoteShape(validShape);
    expect(normalized).toEqual(validShape);
    expect(normalized).not.toBe(validShape);
    expect(normalized?.point).not.toBe(validShape.point);
    expect(normalized?.src).not.toBe(validShape.src);
  });

  it("rejects malformed or duplicate remote shapes", () => {
    expect(normalizeRemoteShape({ id: "shape-a" })).toBeNull();
    expect(
      normalizeRemoteShape({ ...validShape, type: "script", point: [0, 0] })
    ).toBeNull();
    expect(
      normalizeRemoteShape({ ...validShape, point: [Number.NaN, 0] })
    ).toBeNull();
    expect(
      normalizeRemoteShape({ ...validShape, src: ["javascript:alert(1)"] })
    ).toBeNull();
    expect(normalizeRemoteShapeList([validShape, validShape])).toBeNull();
  });

  it("binds presence identity to the transport peer", () => {
    expect(
      normalizeConnectedPayload(
        { peerId: "spoofed-peer", name: "Alice" },
        "transport-peer"
      )
    ).toEqual({ peerId: "transport-peer", name: "Alice" });

    expect(
      normalizeHeartbeatPayload(
        { peerId: "spoofed-peer", timestamp: Number.MAX_SAFE_INTEGER },
        "transport-peer",
        1234
      )
    ).toEqual({ peerId: "transport-peer", timestamp: 1234 });
  });

  it("creates stable action IDs and rejects invalid log entries", () => {
    const payload = {
      playerId: "spoofed-peer",
      playerName: "Alice",
      action: "played a card",
      cardsInHand: 4,
      timestamp: 10_000,
    };
    const options = { fromPeerId: "transport-peer", now: 10_000 };
    const first = normalizeActionLogEntry(payload, options);
    const second = normalizeActionLogEntry(payload, options);

    expect(first?.playerId).toBe("transport-peer");
    expect(first?.eventId).toBe(second?.eventId);
    expect(
      normalizeActionLogEntry(
        { ...payload, cardsInHand: "many" },
        options
      )
    ).toBeNull();
  });

  it("bounds snapshots and attributes every entry to its sender", () => {
    const entry = {
      playerId: "spoofed-peer",
      action: "rolled a die",
      cardsInHand: 3,
      timestamp: 20_000,
    };
    const normalized = normalizeActionLogSnapshot(
      { entries: [entry] },
      "transport-peer",
      20_000
    );
    expect(normalized?.[0].playerId).toBe("transport-peer");

    expect(
      normalizeActionLogSnapshot(
        {
          entries: Array.from(
            { length: MAX_ACTION_LOG_SNAPSHOT_ENTRIES + 1 },
            () => entry
          ),
        },
        "transport-peer",
        20_000
      )
    ).toBeNull();
  });

  it("validates random events and ignores their claimed identity", () => {
    expect(
      normalizeRandomEventPayload(
        {
          type: "d6",
          result: "4",
          peerId: "spoofed-peer",
          cardsInHand: 5,
          timestamp: 30_000,
        },
        "transport-peer",
        30_000
      )
    ).toMatchObject({
      type: "d6",
      result: "4",
      peerId: "transport-peer",
      cardsInHand: 5,
    });
    expect(
      normalizeRandomEventPayload(
        { type: "d100", result: "4", cardsInHand: 5 },
        "transport-peer",
        30_000
      )
    ).toBeNull();
  });
});
