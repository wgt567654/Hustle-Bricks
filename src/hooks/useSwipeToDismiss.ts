import { useEffect, useRef, useState } from "react";
import type React from "react";

const DISMISS_THRESHOLD = 120;

export function useSwipeToDismiss(onDismiss: () => void, isOpen: boolean) {
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Reset gesture state each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setDismissing(false);
      setDragY(0);
      dragYRef.current = 0;
      draggingRef.current = false;
      startYRef.current = null;
    }
  }, [isOpen]);

  // Lock body scroll + block Safari pull-to-refresh while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    // Non-passive touchmove blocks Safari's pull-to-refresh gesture.
    // Allow touches that land on an overflow-scroll/auto ancestor (modal content scroll).
    function blockPullToRefresh(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      let el = e.target as Element | null;
      while (el && el !== document.body) {
        const oy = window.getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll") return;
        el = el.parentElement;
      }
      e.preventDefault();
    }
    document.addEventListener("touchmove", blockPullToRefresh, { passive: false });

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
      document.removeEventListener("touchmove", blockPullToRefresh);
    };
  }, [isOpen]);

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
