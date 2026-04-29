import { useRef, useState } from "react";
import type React from "react";

const DISMISS_THRESHOLD = 120;

export function useSwipeToDismiss(onDismiss: () => void) {
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as Element).closest("button, input, select, textarea, a, [role=button]")) return;
    startYRef.current = e.clientY;
    draggingRef.current = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current || startYRef.current === null) return;
    const delta = e.clientY - startYRef.current;
    if (delta > 0) {
      dragYRef.current = delta;
      setDragY(delta);
    }
  }

  function onPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const currentDragY = dragYRef.current;
    dragYRef.current = 0;
    startYRef.current = null;
    if (currentDragY > DISMISS_THRESHOLD) {
      setDismissing(true);
      setTimeout(() => onDismissRef.current(), 280);
    } else {
      setDragY(0);
    }
  }

  const sheetStyle: React.CSSProperties = dismissing
    ? { transform: "translateY(100%)", transition: "transform 0.28s cubic-bezier(0.4,0,1,1)" }
    : draggingRef.current
    ? { transform: `translateY(${dragY}px)` }
    : dragY > 0
    ? { transform: `translateY(${dragY}px)`, transition: "transform 0.3s cubic-bezier(0.25,1,0.5,1)" }
    : {};

  const dragHandleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    style: { touchAction: "none", userSelect: "none" } as React.CSSProperties,
  };

  return { sheetStyle, dragHandleProps };
}
