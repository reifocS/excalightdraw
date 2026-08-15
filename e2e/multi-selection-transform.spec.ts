import { expect, type Locator, type Page, test } from "@playwright/test";
import type { Shape } from "../src/types/canvas";

type Point = { x: number; y: number };

const getCenter = (box: {
  x: number;
  y: number;
  width: number;
  height: number;
}) => ({
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

const DEFAULT_SHAPES: Shape[] = [
  {
    id: "left-rectangle",
    point: [400, 250],
    size: [100, 50],
    type: "rectangle",
    srcIndex: 0,
    rotation: 0,
  },
  {
    id: "right-rectangle",
    point: [600, 250],
    size: [100, 50],
    type: "rectangle",
    srcIndex: 0,
    rotation: 0,
  },
];

async function openMultiSelectionFixture(
  page: Page,
  shapes: Shape[] = DEFAULT_SHAPES
) {
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
            image_uris: {
              normal: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
            },
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

  const result = await page.evaluate((fixtureShapes) => {
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
      shapes: fixtureShapes,
      selectedShapeIds: fixtureShapes.map((shape) => shape.id),
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
  }, shapes);

  if (!result?.ok) throw new Error(result?.error ?? "Could not load fixture");
}

test.describe("Multi-selection transform frame", () => {
  test("renders one frame and resizes every selected shape", async ({ page }) => {
    await openMultiSelectionFixture(page);

    const frame = page.locator('[data-selection-box-kind="multi"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute("data-selection-shape-count", "2");
    await expect(page.locator("[data-selection-box-shape-id]")).toHaveCount(0);
    await expect(page.locator('[data-selection-handle="rotate"]')).toHaveCount(1);

    const northWest = page.locator('[data-selection-handle="nw"]');
    const southEast = page.locator('[data-selection-handle="se"]');
    const fixedCornerBefore = await getCenterOf(northWest);
    const dragStart = await getCenterOf(southEast);

    await dragFromTo(page, dragStart, {
      x: fixedCornerBefore.x + (dragStart.x - fixedCornerBefore.x) * 1.5,
      y: fixedCornerBefore.y + (dragStart.y - fixedCornerBefore.y) * 1.5,
    });

    const fixedCornerAfter = await getCenterOf(northWest);
    expect(fixedCornerAfter.x).toBeCloseTo(fixedCornerBefore.x, 0);
    expect(fixedCornerAfter.y).toBeCloseTo(fixedCornerBefore.y, 0);

    const snapshot = await page.evaluate(() =>
      window.__MAGINET_DEBUG__?.exportSnapshot()
    );
    const left = snapshot?.shapes.find(
      (shape) => shape.id === "left-rectangle"
    );
    const right = snapshot?.shapes.find(
      (shape) => shape.id === "right-rectangle"
    );
    expect(left?.point[0]).toBeCloseTo(400, 0);
    expect(left?.point[1]).toBeCloseTo(250, 0);
    expect(left?.size[0]).toBeCloseTo(150, 0);
    expect(left?.size[1]).toBeCloseTo(75, 0);
    expect(right?.point[0]).toBeCloseTo(700, 0);
    expect(right?.point[1]).toBeCloseTo(250, 0);
    expect(right?.size[0]).toBeCloseTo(150, 0);
    expect(right?.size[1]).toBeCloseTo(75, 0);

    await page.keyboard.press("Meta+z");
    const restored = await page.evaluate(() =>
      window.__MAGINET_DEBUG__?.exportSnapshot()
    );
    expect(restored?.shapes.find((shape) => shape.id === "left-rectangle")?.size)
      .toEqual([100, 50]);
    expect(restored?.shapes.find((shape) => shape.id === "right-rectangle")?.point)
      .toEqual([600, 250]);
  });

  test("rotates every shape around the aggregate center", async ({ page }) => {
    await openMultiSelectionFixture(page);

    const frame = page.locator('[data-selection-box-kind="multi"]');
    const frameBox = await frame.locator("rect").boundingBox();
    if (!frameBox) throw new Error("Could not resolve multi-selection frame");
    const center = getCenter(frameBox);
    const rotateHandle = page.locator('[data-selection-handle="rotate"]');
    const dragStart = await getCenterOf(rotateHandle);
    const radius = Math.hypot(dragStart.x - center.x, dragStart.y - center.y);

    await dragFromTo(page, dragStart, {
      x: center.x + radius,
      y: center.y,
    });

    const snapshot = await page.evaluate(() =>
      window.__MAGINET_DEBUG__?.exportSnapshot()
    );
    const left = snapshot?.shapes.find(
      (shape) => shape.id === "left-rectangle"
    );
    const right = snapshot?.shapes.find(
      (shape) => shape.id === "right-rectangle"
    );
    expect(left?.point[0]).toBeCloseTo(500, 0);
    expect(left?.point[1]).toBeCloseTo(150, 0);
    expect(left?.rotation).toBeCloseTo(90, 0);
    expect(right?.point[0]).toBeCloseTo(500, 0);
    expect(right?.point[1]).toBeCloseTo(350, 0);
    expect(right?.rotation).toBeCloseTo(90, 0);
  });

  test("resizes a shared rotated selection in its local axes", async ({ page }) => {
    await openMultiSelectionFixture(page, [
      {
        id: "top-rectangle",
        point: [500, 150],
        size: [100, 50],
        type: "rectangle",
        srcIndex: 0,
        rotation: 90,
      },
      {
        id: "bottom-rectangle",
        point: [500, 350],
        size: [100, 50],
        type: "rectangle",
        srcIndex: 0,
        rotation: 90,
      },
    ]);

    const northWest = page.locator('[data-selection-handle="nw"]');
    const southEast = page.locator('[data-selection-handle="se"]');
    const fixedCornerBefore = await getCenterOf(northWest);
    const dragStart = await getCenterOf(southEast);

    await dragFromTo(page, dragStart, {
      x: fixedCornerBefore.x + (dragStart.x - fixedCornerBefore.x) * 1.5,
      y: fixedCornerBefore.y + (dragStart.y - fixedCornerBefore.y) * 1.5,
    });

    const fixedCornerAfter = await getCenterOf(northWest);
    expect(fixedCornerAfter.x).toBeCloseTo(fixedCornerBefore.x, 0);
    expect(fixedCornerAfter.y).toBeCloseTo(fixedCornerBefore.y, 0);

    const snapshot = await page.evaluate(() =>
      window.__MAGINET_DEBUG__?.exportSnapshot()
    );
    for (const shape of snapshot?.shapes ?? []) {
      expect(shape.size[0]).toBeCloseTo(150, 0);
      expect(shape.size[1]).toBeCloseTo(75, 0);
      expect(shape.rotation).toBeCloseTo(90, 0);
    }
  });
});
