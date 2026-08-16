import { describe, expect, it } from "vitest";
import { getTextLayoutStyle } from "./textLayout";

describe("getTextLayoutStyle", () => {
  it("applies the given font size, color and background", () => {
    const style = getTextLayoutStyle({
      fontSize: 24,
      color: "#ff0000",
      backgroundColor: "#00ff00",
    });
    expect(style.fontSize).toBe("24px");
    expect(style.color).toBe("#ff0000");
    expect(style.backgroundColor).toBe("#00ff00");
  });

  it("defaults to a 16px font and a transparent background", () => {
    const style = getTextLayoutStyle({});
    expect(style.fontSize).toBe("16px");
    expect(style.backgroundColor).toBe("transparent");
    expect(style.color).toBeUndefined();
  });

  it("keeps the measurement-critical layout properties stable", () => {
    expect(getTextLayoutStyle({})).toMatchObject({
      boxSizing: "border-box",
      whiteSpace: "pre",
      lineHeight: "normal",
      padding: "4px",
      margin: 0,
      fontFamily: "Arial",
      fontWeight: 400,
      letterSpacing: "normal",
      textAlign: "start",
      overflow: "hidden",
      resize: "none",
    });
  });
});
