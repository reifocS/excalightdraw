import { describe, expect, it, vi } from "vitest";
import {
  CardCollection,
  Datum,
  collectNotFoundNames,
  mapDataToCard,
  mapDataToCards,
} from "./useCards";

const createDatum = (overrides: Partial<Datum>): Datum =>
  ({ name: "Card", ...overrides }) as Datum;

describe("mapDataToCard", () => {
  it("uses the single-faced image when present", () => {
    const card = mapDataToCard(
      createDatum({ image_uris: { normal: "https://img/front.png" } as Datum["image_uris"] })
    );
    expect(card?.src).toEqual(["https://img/front.png"]);
  });

  it("keeps only the faces that actually have an image", () => {
    const card = mapDataToCard(
      createDatum({
        card_faces: [
          createDatum({ image_uris: { normal: "https://img/front.png" } as Datum["image_uris"] }),
          createDatum({}),
        ],
      })
    );
    expect(card?.src).toEqual(["https://img/front.png"]);
  });

  it("returns null instead of throwing when no image is available", () => {
    expect(mapDataToCard(createDatum({}))).toBeNull();
  });
});

describe("mapDataToCards", () => {
  it("skips cards without images and warns about them", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cards = mapDataToCards([
      createDatum({
        name: "Playable",
        image_uris: { normal: "https://img/front.png" } as Datum["image_uris"],
      }),
      createDatum({ name: "Imageless" }),
    ]);

    expect(cards).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith('Skipping "Imageless": no card image');
    warn.mockRestore();
  });
});

describe("collectNotFoundNames", () => {
  it("collects unique names reported by Scryfall", () => {
    const collections = [
      { not_found: [{ name: "Fake Card" }, { name: "Fake Card" }], data: [] },
      { not_found: [{ name: "Other Card" }, {}], data: [] },
    ] as unknown as CardCollection[];

    expect(collectNotFoundNames(collections)).toEqual(["Fake Card", "Other Card"]);
    expect(collectNotFoundNames()).toEqual([]);
  });
});
