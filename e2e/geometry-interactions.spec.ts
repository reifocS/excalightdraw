import { expect, type Locator, type Page, test } from "@playwright/test";

type Point = { x: number; y: number };

const getCenter = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

async function getCenterOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Could not resolve element bounds");
  return getCenter(box);
}

async function dragFromTo(page: Page, start: Point, end: Point) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

async function openGeometryFixture(page: Page, shape: Record<string, unknown>) {
  await page.route("https://api.scryfall.com/cards/collection", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        object: "list",
        not_found: [],
        data: [
          {
            object: "card",
            id: "island",
            name: "Island",
            image_uris: { normal: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" },
          },
        ],
      }),
    });
  });

  await page.goto("/?deck=1%20Island", { waitUntil: "domcontentloaded" });
  const enterTableButton = page.getByRole("button", { name: "Enter table" });
  await expect(enterTableButton).toBeEnabled();
  await enterTableButton.click();
  await expect(page.locator("svg.canvas-surface")).toBeVisible();

  const result = await page.evaluate((fixtureShape) => {
    return window.__MAGINET_DEBUG__?.importSnapshot({
      kind: "maginet/debug-snapshot",
      version: 1,
      capturedAt: Date.now(),
      deckParam: "1 Island",
      cardState: {
        cards: [],
        deck: [],
        lastAction: "INITIALIZE_DECK",
        actionId: 1,
      },
      shapes: [fixtureShape],
      selectedShapeIds: [fixtureShape.id],
      editingText: null,
      camera: { x: 0, y: 0, z: 1 },
      mode: "select",
      shapeType: "rectangle",
      isSnapEnabled: false,
      showCounterControls: false,
      selectedHandCardId: null,
      connectedPeerIds: [],
      meta: {},
    });
  }, shape);

  if (!result?.ok) throw new Error(result?.error ?? "Could not load fixture");
}

test.describe("Geometry interactions", () => {
  test("rotated resize keeps the opposite corner fixed", async ({ page }) => {
    await openGeometryFixture(page, {
      id: "rotated-rectangle",
      point: [500, 280],
      size: [120, 60],
      type: "rectangle",
      srcIndex: 0,
      rotation: 45,
    });

    const northWest = page.locator('[data-selection-handle="nw"]');
    const southEast = page.locator('[data-selection-handle="se"]');
    const fixedCornerBefore = await getCenterOf(northWest);
    const dragStart = await getCenterOf(southEast);
    const angle = Math.PI / 4;
    const dragDelta = {
      x: 60 * Math.cos(angle) - 30 * Math.sin(angle),
      y: 60 * Math.sin(angle) + 30 * Math.cos(angle),
    };

    await dragFromTo(page, dragStart, {
      x: dragStart.x + dragDelta.x,
      y: dragStart.y + dragDelta.y,
    });

    const fixedCornerAfter = await getCenterOf(northWest);
    expect(Math.abs(fixedCornerAfter.x - fixedCornerBefore.x)).toBeLessThan(1);
    expect(Math.abs(fixedCornerAfter.y - fixedCornerBefore.y)).toBeLessThan(1);

    const snapshot = await page.evaluate(() =>
      window.__MAGINET_DEBUG__?.exportSnapshot()
    );
    expect(snapshot?.shapes[0].size[0]).toBeCloseTo(180, 0);
    expect(snapshot?.shapes[0].size[1]).toBeCloseTo(90, 0);
  });

  test("text resize scales from a stable rotated anchor", async ({ page }) => {
    await openGeometryFixture(page, {
      id: "rotated-text",
      point: [500, 280],
      size: [80, 26],
      type: "text",
      text: "Scale <me>",
      srcIndex: 0,
      fontSize: 16,
      rotation: 35,
    });

    const northWest = page.locator('[data-selection-handle="nw"]');
    const southEast = page.locator('[data-selection-handle="se"]');
    const textShape = page.locator('[data-shape-id="rotated-text"]');
    const selectionOutline = page
      .locator('[data-selection-box-shape-id="rotated-text"] > rect')
      .first();
    const textBounds = await textShape.boundingBox();
    const selectionBounds = await selectionOutline.boundingBox();
    if (!textBounds || !selectionBounds) {
      throw new Error("Could not resolve text geometry");
    }
    // SVG stroke/filter bounds can add a few screen pixels; larger differences
    // mean measurement interpreted the literal text as markup.
    expect(Math.abs(textBounds.width - selectionBounds.width)).toBeLessThan(4);
    expect(Math.abs(textBounds.height - selectionBounds.height)).toBeLessThan(4);

    const fixedCornerBefore = await getCenterOf(northWest);
    const dragStart = await getCenterOf(southEast);

    await dragFromTo(page, dragStart, {
      x: fixedCornerBefore.x + (dragStart.x - fixedCornerBefore.x) * 1.5,
      y: fixedCornerBefore.y + (dragStart.y - fixedCornerBefore.y) * 1.5,
    });

    const fixedCornerAfter = await getCenterOf(northWest);
    expect(Math.abs(fixedCornerAfter.x - fixedCornerBefore.x)).toBeLessThan(1);
    expect(Math.abs(fixedCornerAfter.y - fixedCornerBefore.y)).toBeLessThan(1);

    const snapshot = await page.evaluate(() =>
      window.__MAGINET_DEBUG__?.exportSnapshot()
    );
    expect(snapshot?.shapes[0].fontSize).toBeCloseTo(24, 0);
    expect(snapshot?.shapes[0].size[0]).toBeGreaterThan(80);
    expect(snapshot?.shapes[0].size[1]).toBeGreaterThan(26);
  });
});
