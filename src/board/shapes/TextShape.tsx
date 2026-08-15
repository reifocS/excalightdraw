import React from "react";
import { Shape as ShapeType } from "../../types/canvas";
import { getBounds } from "../../utils/canvas_utils";
import { Textarea } from "../../components/ui/Input";
import { getTextLayoutStyle } from "./textLayout";

// TODO Refactor use foreignObject to render text to keep return to lines
const TextShape = ({
  shape,
  commonProps,
  transform,
  selected,
}: {
  shape: ShapeType;
  commonProps: React.SVGProps<SVGTextElement>;
  transform: string;
  selected: boolean;
}) => {
  const { point, text, color, fontSize } = shape;
  const bounds = getBounds(text ?? "", point[0], point[1], fontSize);
  const htmlProps = commonProps as unknown as React.HTMLProps<HTMLTextAreaElement>;
  return (
    <foreignObject
      data-shape-id={shape.id}
      data-shape-type="text"
      x={point[0]}
      y={point[1]}
      width={bounds.width}
      height={bounds.height}
      transform={transform}
    >
      <Textarea
        {...htmlProps}
        variant="unstyled"
        data-text-renderer="true"
        readOnly
        tabIndex={-1}
        value={text ?? ""}
        style={{
          ...getTextLayoutStyle({
            fontSize,
            color,
            backgroundColor: selected
              ? "rgba(0, 0, 0, 0.1)"
              : "transparent",
          }),
          ...htmlProps.style,
          userSelect: "none",
        }}
      />
    </foreignObject>
  );
};

export default TextShape;
