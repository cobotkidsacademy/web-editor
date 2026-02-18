import React from "react";

/**
 * Draggable resize handle. Call onResize(delta) during drag.
 * @param {string} orientation - "horizontal" (resizes height) or "vertical" (resizes width)
 */
export default function ResizeHandle({ orientation, onResize, className = "" }) {
  const handleMouseDown = (e) => {
    e.preventDefault();
    let prevX = e.clientX;
    let prevY = e.clientY;

    const handleMouseMove = (moveE) => {
      const deltaX = moveE.clientX - prevX;
      const deltaY = moveE.clientY - prevY;
      prevX = moveE.clientX;
      prevY = moveE.clientY;
      const delta = orientation === "horizontal" ? deltaY : deltaX;
      onResize(delta, { deltaX, deltaY });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = orientation === "horizontal" ? "ns-resize" : "ew-resize";
    document.body.style.userSelect = "none";
  };

  const isHorizontal = orientation === "horizontal";
  return (
    <div
      className={`resize-handle resize-handle-${orientation} ${className}`}
      onMouseDown={handleMouseDown}
      title={isHorizontal ? "Drag to resize editor heights" : "Drag to resize editor and preview"}
    />
  );
}
