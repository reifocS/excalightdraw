import { describe, expect, it } from "vitest";
import type { Shape } from "../state.js";
import {
  MAX_SHAPES_PER_PEER,
  normalizeRemoteActionLogEntry,
  normalizeRemoteActionLogSnapshot,
  normalizeRemoteCardState,
  normalizeRemoteShape,
  normalizeRemoteShapeList,
  normalizeRemoteShapesByPeer,
} from "../validation.js";

const validShape: Shape = {
  id: "shape-a",
  point: [10, 20],
  size: [80, 120],
  type: "image",
  src: ["https://cards.example/card.png"],
  srcIndex: 0,
};

describe("agent remote payload validation", () => {
  it("accepts a safe shape as cloned data", () => {
    const normalized = normalizeRemoteShape(validShape);
    expect(normalized).toEqual(validShape);
    expect(normalized).not.toBe(validShape);
    expect(normalized?.src).not.toBe(validShape.src);
  });

  it("rejects malformed shapes and unsafe image sources", () => {
    expect(normalizeRemoteShape({ id: "shape-a" })).toBeNull();
    expect(normalizeRemoteShape({ ...validShape, type: "script" })).toBeNull();
    expect(normalizeRemoteShape({ ...validShape, point: [Number.NaN, 0] })).toBeNull();
    expect(normalizeRemoteShape({ ...validShape, point: [1e12, 0] })).toBeNull();
    expect(
      normalizeRemoteShape({ ...validShape, src: ["javascript:alert(1)"] })
    ).toBeNull();
    expect(normalizeRemoteShape({ ...validShape, id: "__proto__" })).toBeNull();
  });

  it("drops invalid entries and caps oversized shape lists", () => {
    expect(normalizeRemoteShapeList([validShape, { id: "x" }, validShape])).toEqual([
      validShape,
    ]);
    const flood = Array.from({ length: MAX_SHAPES_PER_PEER + 50 }, (_, i) => ({
      ...validShape,
      id: `shape-${i}`,
    }));
    expect(normalizeRemoteShapeList(flood)).toHaveLength(MAX_SHAPES_PER_PEER);
  });

  it("rejects prototype-polluting peer keys", () => {
    const byPeer = normalizeRemoteShapesByPeer({
      __proto__: [validShape],
      constructor: [validShape],
      "peer-1": [validShape],
    });
    expect(Object.keys(byPeer)).toEqual(["peer-1"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("binds action-log identity to the transport peer and bounds fields", () => {
    const entry = normalizeRemoteActionLogEntry(
      {
        action: "x".repeat(5_000),
        playerId: "spoofed-peer",
        playerName: "y".repeat(500),
        cardsInHand: -5,
        timestamp: "nope",
        cardSrcs: [["javascript:alert(1)"], ["https://cards.example/a.png"]],
      },
      "transport-peer",
      1234
    );
    expect(entry).toEqual({
      timestamp: 1234,
      action: "unknown",
      playerId: "transport-peer",
      playerName: undefined,
      cardsInHand: undefined,
      cardSrcs: [["https://cards.example/a.png"]],
    });
  });

  it("caps action-log snapshots", () => {
    const entries = Array.from({ length: 200 }, () => ({ action: "DRAW_CARD" }));
    expect(
      normalizeRemoteActionLogSnapshot({ entries }, "peer-1", 1).length
    ).toBeLessThanOrEqual(20);
    expect(normalizeRemoteActionLogSnapshot({ entries: "nope" })).toEqual([]);
  });

  it("validates card-state payloads", () => {
    expect(normalizeRemoteCardState({ cards: 1.5, deck: 2 })).toBeNull();
    expect(normalizeRemoteCardState({ cards: -1, deck: 2 })).toBeNull();
    expect(
      normalizeRemoteCardState({
        cards: 2,
        deck: 3,
        hand: [
          { id: "ok", src: ["https://cards.example/a.png"] },
          { id: "__proto__", src: ["https://cards.example/b.png"] },
          { id: "bad-url", src: ["javascript:alert(1)"] },
        ],
      })
    ).toEqual({
      cards: 2,
      deck: 3,
      hand: [{ id: "ok", src: ["https://cards.example/a.png"] }],
    });
  });
});
