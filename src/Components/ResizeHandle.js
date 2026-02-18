import React from "react";

/**
 * Draggable resize handle. Calls onResize(delta, { deltaX, deltaY }) during drag.
 * Supports both mouse and touch.
 * @param {string} orientation - "horizontal" (resizes height) or "vertical" (resizes width)
 */
export default function ResizeHandle({ orientation, onResize, className = "" }) {
  const getCoords = (e) => {
    if (e.touches) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const startDrag = (e) => {
    e.preventDefault();
    let prev = getCoords(e);
    const isTouch = e.type === "touchstart";

    const handleMove = (moveE) => {
      if (isTouch) moveE.preventDefault();
      const curr = getCoords(moveE);
      const deltaX = curr.x - prev.x;
      const deltaY = curr.y - prev.y;
      const delta = orientation === "horizontal" ? deltaY : deltaX;
      onResize(delta, { deltaX, deltaY });
      prev = curr;
    };

    const handleEnd = () => {
      if (isTouch) {
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleEnd);
      } else {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    if (isTouch) {
      document.addEventListener("touchmove", handleMove, { passive: false });
      document.addEventListener("touchend", handleEnd);
    } else {
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleEnd);
    }
    document.body.style.cursor = orientation === "horizontal" ? "ns-resize" : "ew-resize";
    document.body.style.userSelect = "none";
  };

  const isHorizontal = orientation === "horizontal";
  return (
    <div
      className={`resize-handle resize-handle-${orientation} ${className}`}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
      role="separator"
      aria-orientation={isHorizontal ? "horizontal" : "vertical"}
      title={isHorizontal ? "Drag to resize editor heights" : "Drag to resize editor and preview"}
    />
  );
}
