import { describe, expect, it } from "vitest";
import { cardReducer, CardState } from "./useCardReducer";
import type { Datum } from "./useCards";

const emptyState: CardState = { cards: [], deck: [] };

describe("cardReducer ADD_TO_HAND", () => {
  it("adds the card when it has an image", () => {
    const next = cardReducer(emptyState, {
      type: "ADD_TO_HAND",
      payload: {
        name: "Token",
        image_uris: { normal: "https://img/front.png" },
      } as Datum,
    });

    expect(next.cards).toHaveLength(1);
  });

  it("leaves the state untouched when the card has no image", () => {
    const next = cardReducer(emptyState, {
      type: "ADD_TO_HAND",
      payload: { name: "Imageless" } as Datum,
    });

    expect(next).toBe(emptyState);
  });
});
