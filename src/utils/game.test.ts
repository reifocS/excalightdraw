import { afterEach, describe, expect, it, vi } from "vitest";
import { describeRandomEvent, generatePlayerName, logActionToConsole } from "./game";
import type { ActionLogEntry } from "../board/ActionLog";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logActionToConsole", () => {
  const entry: ActionLogEntry = {
    playerId: "peer-1",
    playerName: "Alice",
    action: "DRAW_CARD",
    cardsInHand: 7,
    timestamp: 0,
  };

  it("logs player name, hand size, action and time", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logActionToConsole({ ...entry, timestamp: Date.UTC(2024, 0, 1) });
    expect(info).toHaveBeenCalledTimes(1);
    const message = info.mock.calls[0][0] as string;
    expect(message).toContain("[Action Log] Alice (7 in hand): DRAW_CARD @ ");
  });

  it("uses the given origin and omits the time when there is no timestamp", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logActionToConsole({ ...entry, timestamp: 0 }, "Sync");
    expect(info).toHaveBeenCalledWith("[Sync] Alice (7 in hand): DRAW_CARD");
  });

  it("falls back to the player id and then to a generic label", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logActionToConsole({ ...entry, playerName: undefined });
    logActionToConsole({ ...entry, playerName: undefined, playerId: "" });
    expect(info.mock.calls[0][0]).toContain("peer-1");
    expect(info.mock.calls[1][0]).toContain("Player");
  });
});

describe("generatePlayerName", () => {
  it("builds an adjective/noun/number name", () => {
    expect(generatePlayerName()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ #\d{3}$/);
  });

  it("uses the first adjective and noun when random returns 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(generatePlayerName()).toBe("Swift Falcon #100");
  });
});

describe("describeRandomEvent", () => {
  it("describes each supported event type", () => {
    expect(describeRandomEvent({ type: "coin", result: "heads" })).toBe(
      "flipped a coin: heads"
    );
    expect(describeRandomEvent({ type: "d6", result: "4" })).toBe("rolled a d6: 4");
    expect(describeRandomEvent({ type: "d20", result: "18" })).toBe(
      "rolled a d20: 18"
    );
    expect(describeRandomEvent({ type: "starter", result: "Alice" })).toBe(
      "starting player: Alice"
    );
  });

  it("falls back to a generic description for unknown types", () => {
    expect(
      describeRandomEvent({
        type: "unknown" as never,
        result: "42",
      })
    ).toBe("random: 42");
  });
});
