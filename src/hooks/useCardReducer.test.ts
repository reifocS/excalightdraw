import { describe, expect, it } from "vitest";
import { CardState, cardReducer } from "./useCardReducer";
import type { Datum } from "./useCards";
import { Card } from "../types/canvas";

function card(id: string, src = `${id}.png`): Card {
  return { id, src: [src] };
}

function state(partial: Partial<CardState> = {}): CardState {
  return { cards: [], deck: [], ...partial };
}

const datum = {
  image_uris: { normal: "front.png" },
} as unknown as Datum;

describe("cardReducer bookkeeping", () => {
  it("records the action type and increments actionId", () => {
    const next = cardReducer(state({ deck: [card("a")] }), { type: "DRAW_CARD" });
    expect(next.lastAction).toBe("DRAW_CARD");
    expect(next.actionId).toBe(1);
    expect(cardReducer(next, { type: "SHUFFLE_DECK" }).actionId).toBe(2);
  });

  it("returns the untouched base state for unknown actions", () => {
    const initial = state({ cards: [card("a")], deck: [card("b")] });
    const next = cardReducer(initial, { type: "NOPE" } as never);
    expect(next.cards).toEqual(initial.cards);
    expect(next.deck).toEqual(initial.deck);
    expect(next.actionId).toBe(1);
  });
});

describe("SET_STATE", () => {
  it("clones the incoming cards and preserves the action metadata", () => {
    const incoming = state({
      cards: [card("a")],
      deck: [card("b")],
      lastAction: "DRAW_CARD",
      actionId: 7,
    });
    const next = cardReducer(state(), { type: "SET_STATE", payload: incoming });
    expect(next).toEqual({
      cards: [card("a")],
      deck: [card("b")],
      lastAction: "DRAW_CARD",
      actionId: 7,
    });
    expect(next.cards[0]).not.toBe(incoming.cards[0]);
  });
});

describe("INITIALIZE_DECK", () => {
  it("replaces the deck and empties the hand", () => {
    const next = cardReducer(state({ cards: [card("a")] }), {
      type: "INITIALIZE_DECK",
      payload: [card("b")],
    });
    expect(next.deck).toEqual([card("b")]);
    expect(next.cards).toEqual([]);
  });
});

describe("DRAW_CARD", () => {
  it("moves the top card into the hand with a fresh id", () => {
    const next = cardReducer(state({ deck: [card("a"), card("b")] }), {
      type: "DRAW_CARD",
    });
    expect(next.deck).toEqual([card("b")]);
    expect(next.cards).toHaveLength(1);
    expect(next.cards[0].src).toEqual(["a.png"]);
    expect(next.cards[0].id).not.toBe("a");
  });

  it("is a no-op when the deck is empty", () => {
    const next = cardReducer(state({ cards: [card("a")] }), { type: "DRAW_CARD" });
    expect(next.deck).toEqual([]);
    expect(next.cards).toEqual([card("a")]);
  });
});

describe("MULLIGAN", () => {
  it("returns the hand to the bottom of the deck", () => {
    const next = cardReducer(state({ cards: [card("a")], deck: [card("b")] }), {
      type: "MULLIGAN",
    });
    expect(next.deck).toEqual([card("b"), card("a")]);
    expect(next.cards).toEqual([]);
  });
});

describe("SEND_TO_HAND", () => {
  it("appends cards to the hand", () => {
    const next = cardReducer(state({ cards: [card("a")] }), {
      type: "SEND_TO_HAND",
      payload: [card("b")],
    });
    expect(next.cards).toEqual([card("a"), card("b")]);
  });
});

describe("SEND_TO_DECK", () => {
  it("puts cards on top or at the bottom of the deck", () => {
    const initial = state({ deck: [card("a")] });
    expect(
      cardReducer(initial, {
        type: "SEND_TO_DECK",
        payload: { cards: [card("b")], position: "top" },
      }).deck
    ).toEqual([card("b"), card("a")]);
    expect(
      cardReducer(initial, {
        type: "SEND_TO_DECK",
        payload: { cards: [card("b")], position: "bottom" },
      }).deck
    ).toEqual([card("a"), card("b")]);
  });
});

describe("MOVE_HAND_TO_DECK", () => {
  it("moves a card from the hand to the requested deck position", () => {
    const initial = state({ cards: [card("a"), card("b")], deck: [card("c")] });
    const top = cardReducer(initial, {
      type: "MOVE_HAND_TO_DECK",
      payload: { cardId: "a", position: "top" },
    });
    expect(top.cards).toEqual([card("b")]);
    expect(top.deck).toEqual([card("a"), card("c")]);

    const bottom = cardReducer(initial, {
      type: "MOVE_HAND_TO_DECK",
      payload: { cardId: "a", position: "bottom" },
    });
    expect(bottom.deck).toEqual([card("c"), card("a")]);
  });

  it("is a no-op when the card is not in hand", () => {
    const initial = state({ cards: [card("a")], deck: [card("c")] });
    const next = cardReducer(initial, {
      type: "MOVE_HAND_TO_DECK",
      payload: { cardId: "missing", position: "top" },
    });
    expect(next.cards).toEqual([card("a")]);
    expect(next.deck).toEqual([card("c")]);
  });
});

describe("PLAY_CARD", () => {
  it("removes the played cards and records their images", () => {
    const next = cardReducer(state({ cards: [card("a"), card("b")] }), {
      type: "PLAY_CARD",
      payload: ["a"],
    });
    expect(next.cards).toEqual([card("b")]);
    expect(next.lastPlayedSrcs).toEqual([["a.png"]]);
  });
});

describe("SHUFFLE_DECK", () => {
  it("keeps the same cards in the deck", () => {
    const deck = [card("a"), card("b"), card("c")];
    const next = cardReducer(state({ deck }), { type: "SHUFFLE_DECK" });
    expect([...next.deck].map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("ADD_TO_HAND", () => {
  it("adds the card to the hand and removes one matching copy from the deck", () => {
    const next = cardReducer(
      state({ deck: [card("d1", "front.png"), card("d2", "front.png")] }),
      { type: "ADD_TO_HAND", payload: datum }
    );
    expect(next.cards).toHaveLength(1);
    expect(next.cards[0].src).toEqual(["front.png"]);
    expect(next.deck).toEqual([card("d2", "front.png")]);
  });

  it("leaves the deck untouched when no copy matches", () => {
    const deck = [card("d1", "other.png")];
    const next = cardReducer(state({ deck }), {
      type: "ADD_TO_HAND",
      payload: datum,
    });
    expect(next.deck).toEqual(deck);
  });
});
