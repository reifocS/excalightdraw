import type React from "react";

type TextLayoutStyleOptions = {
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
};

export function getTextLayoutStyle({
  fontSize,
  color,
  backgroundColor = "transparent",
}: TextLayoutStyleOptions): React.CSSProperties {
  return {
    boxSizing: "border-box",
    width: "100%",
    height: "100%",
    border: "none",
    margin: 0,
    padding: "4px",
    whiteSpace: "pre",
    lineHeight: "normal",
    minHeight: 1,
    minWidth: 1,
    outline: 0,
    overflow: "hidden",
    resize: "none",
    display: "block",
    color,
    fontSize: `${fontSize ?? 16}px`,
    fontFamily: "Arial",
    fontStyle: "normal",
    fontWeight: 400,
    letterSpacing: "normal",
    textAlign: "start",
    textIndent: 0,
    textTransform: "none",
    backgroundColor,
  };
}
