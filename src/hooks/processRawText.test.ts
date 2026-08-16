import { describe, expect, it } from "vitest";
import { MAX_DECK_CARDS, processRawText } from "./useCards";

describe("processRawText", () => {
  it("expands arena-style deck lines", () => {
    expect(processRawText("2 Island\n1 Llanowar Elves // note")).toEqual([
      "Island",
      "Island",
      "Llanowar Elves",
    ]);
    expect(processRawText("   ")).toEqual([]);
    expect(processRawText("not a deck line")).toEqual([]);
  });

  it("caps hostile deck payloads instead of allocating unbounded arrays", () => {
    expect(processRawText("999999999 Island")).toHaveLength(0);
    expect(processRawText("9999 Island")).toHaveLength(MAX_DECK_CARDS);
    expect(
      processRawText(Array.from({ length: 5_000 }, () => "1 Island").join("\n"))
    ).toHaveLength(MAX_DECK_CARDS);
    expect(processRawText(`1 ${"x".repeat(5_000)}`)[0].length).toBe(200);
  });
});
