import { useEffect, useRef } from "react";
import type React from "react";

const DISMISS_THRESHOLD = 120;
const DIRECTION_THRESHOLD = 8; // px before committing to a direction

export function useSwipeToDismiss(onDismiss: () => void, isOpen: boolean) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragYRef = useRef(0);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Prime GPU layer and reset all state on each open
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
    startXRef.current = null;
    pointerIdRef.current = null;
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
      // If a dismiss drag is in progress, block all scroll
      if (draggingRef.current) { e.preventDefault(); return; }
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

  function scrollParent(el: Element | null, boundary: Element | null): Element | null {
    while (el && el !== boundary && el !== document.body) {
      const oy = window.getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return el;
      el = el.parentElement;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as Element).closest("button, input, select, textarea, a, [role=button]")) return;
    if (pointerIdRef.current !== null) return;
    startYRef.current = e.clientY;
    startXRef.current = e.clientX;
    pointerIdRef.current = e.pointerId;
    draggingRef.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pointerIdRef.current !== e.pointerId || startYRef.current === null) return;

    const dy = e.clientY - startYRef.current;
    const dx = e.clientX - (startXRef.current ?? e.clientX);

    if (!draggingRef.current) {
      // Cancel on horizontal or upward movement
      if (Math.abs(dx) > Math.abs(dy) + 3 || dy < 0) {
        startYRef.current = null;
        pointerIdRef.current = null;
        return;
      }
      if (dy < DIRECTION_THRESHOLD) return; // wait for clear intent

      // Downward — cancel if scrollable content isn't at the top
      const sp = scrollParent(e.target as Element, e.currentTarget as Element);
      if (sp && sp.scrollTop > 0) {
        startYRef.current = null;
        pointerIdRef.current = null;
        return;
      }

      // Commit to dismiss
      draggingRef.current = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }

    if (dy > 0 && sheetRef.current) {
      dragYRef.current = dy;
      sheetRef.current.style.transition = "none";
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  }

  function onPointerUp() {
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    startYRef.current = null;
    startXRef.current = null;
    pointerIdRef.current = null;

    if (!wasDragging || !sheetRef.current) return;

    const currentDragY = dragYRef.current;
    dragYRef.current = 0;

    if (currentDragY > DISMISS_THRESHOLD) {
      sheetRef.current.style.transition = "transform 0.28s cubic-bezier(0.4,0,1,1)";
      sheetRef.current.style.transform = "translateY(100%)";
      setTimeout(() => onDismissRef.current(), 280);
    } else {
      sheetRef.current.style.transition = "transform 0.3s cubic-bezier(0.25,1,0.5,1)";
      sheetRef.current.style.transform = "translateY(0)";
      const el = sheetRef.current;
      setTimeout(() => { el.style.transition = ""; el.style.transform = ""; }, 300);
    }
  }

  // Spread onto the sheet container div (alongside ref={sheetRef})
  const sheetDragProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    style: { userSelect: "none" } as React.CSSProperties,
  };

  return { sheetRef, sheetDragProps };
}
