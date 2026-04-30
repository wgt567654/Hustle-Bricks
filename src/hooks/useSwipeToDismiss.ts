import { useEffect, useRef } from "react";
import type React from "react";

const DISMISS_THRESHOLD = 120;

export function useSwipeToDismiss(onDismiss: () => void, isOpen: boolean) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragYRef = useRef(0);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Prime GPU layer and reset DOM state each time the modal opens
  useEffect(() => {
    const el = sheetRef.current;
    if (!isOpen || !el) return;
    el.style.willChange = "transform";
    el.style.backfaceVisibility = "hidden";
    el.style.transform = "";
    el.style.transition = "";
    draggingRef.current = false;
    dragYRef.current = 0;
    startYRef.current = null;
  }, [isOpen]);

  // Lock body scroll + block Safari pull-to-refresh while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

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
    if (!draggingRef.current || startYRef.current === null || !sheetRef.current) return;
    const delta = e.clientY - startYRef.current;
    if (delta > 0) {
      dragYRef.current = delta;
      sheetRef.current.style.transition = "none";
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }

  function onPointerUp() {
    if (!draggingRef.current || !sheetRef.current) return;
    draggingRef.current = false;
    const currentDragY = dragYRef.current;
    dragYRef.current = 0;
    startYRef.current = null;

    if (currentDragY > DISMISS_THRESHOLD) {
      sheetRef.current.style.transition = "transform 0.28s cubic-bezier(0.4,0,1,1)";
      sheetRef.current.style.transform = "translateY(100%)";
      setTimeout(() => onDismissRef.current(), 280);
    } else {
      sheetRef.current.style.transition = "transform 0.3s cubic-bezier(0.25,1,0.5,1)";
      sheetRef.current.style.transform = "translateY(0)";
      const el = sheetRef.current;
      setTimeout(() => {
        el.style.transition = "";
        el.style.transform = "";
      }, 300);
    }
  }

  const dragHandleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    style: { touchAction: "none", userSelect: "none" } as React.CSSProperties,
  };

  return { sheetRef, dragHandleProps };
}
