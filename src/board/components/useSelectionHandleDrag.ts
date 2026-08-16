import React, { useRef } from "react";
import { useShapeStore } from "../../hooks/useShapeStore";
import { SelectionHandleType } from "./SelectionHandles";

/**
 * Pointer capture, history and store flags shared by the single- and
 * multi-selection boxes. `TSession` holds the caller's drag bookkeeping.
 */
export function useSelectionHandleDrag<TSession>() {
  const sessionRef = useRef<TSession | null>(null);

  const finishDrag = () => {
    if (!sessionRef.current) return;
    sessionRef.current = null;
    useShapeStore.setState({
      isResizingShape: false,
      isRotatingShape: false,
    });
  };

  const startDrag = (
    event: React.PointerEvent<SVGCircleElement>,
    handle: SelectionHandleType,
    session: TSession
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = session;

    useShapeStore.getState().pushHistory();
    useShapeStore.setState(
      handle === "rotate"
        ? { isRotatingShape: true }
        : { isResizingShape: true }
    );
  };

  const handlePointerUp = (event: React.PointerEvent<SVGCircleElement>) => {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag();
  };

  return { sessionRef, startDrag, finishDrag, handlePointerUp };
}
