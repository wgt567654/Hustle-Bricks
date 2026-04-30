import { useEffect, useRef } from "react";
import type React from "react";

const DISMISS_THRESHOLD = 120;
const DIRECTION_THRESHOLD = 8;

export function useSwipeToDismiss(onDismiss: () => void, isOpen: boolean) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragYRef = useRef(0);
  const touchActiveRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  function findScrollParent(el: Element | null, boundary: Element): Element | null {
    while (el && el !== boundary && el !== document.body) {
      const oy = window.getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return el;
      el = el.parentElement;
    }
    return null;
  }

  function finishDrag(el: HTMLDivElement) {
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    const currentDragY = dragYRef.current;
    dragYRef.current = 0;
    if (!wasDragging) return;
    if (currentDragY > DISMISS_THRESHOLD) {
      el.style.transition = "transform 0.28s cubic-bezier(0.4,0,1,1)";
      el.style.transform = "translateY(100%)";
      setTimeout(() => onDismissRef.current(), 280);
    } else {
      el.style.transition = "transform 0.3s cubic-bezier(0.25,1,0.5,1)";
      el.style.transform = "translateY(0)";
      const ref = el;
      setTimeout(() => { ref.style.transition = ""; ref.style.transform = ""; }, 300);
    }
  }

  // Prime GPU layer and reset state on each open
  useEffect(() => {
    const el = sheetRef.current;
    if (!isOpen || !el) return;
    el.style.willChange = "transform";
    el.style.backfaceVisibility = "hidden";
    el.style.transform = "";
    el.style.transition = "";
    draggingRef.current = false;
    dragYRef.current = 0;
    touchActiveRef.current = false;
  }, [isOpen]);

  // Body scroll lock + touch-based drag (works in scrollable content on iOS)
  useEffect(() => {
    const el = sheetRef.current;
    if (!isOpen || !el) return;
    const sheet: HTMLDivElement = el;

    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    let startY = 0;
    let startX = 0;
    let active = false;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const target = e.target as Element;
      if (target.closest("button, input, select, textarea, a, [role=button]")) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      active = true;
      touchActiveRef.current = true;
      draggingRef.current = false;
      dragYRef.current = 0;
    }

    function onTouchMove(e: TouchEvent) {
      if (!active || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dy = touch.clientY - startY;
      const dx = touch.clientX - startX;

      // Already committed — move the sheet and block everything else
      if (draggingRef.current) {
        e.preventDefault();
        if (dy > 0) {
          dragYRef.current = dy;
          sheet.style.transition = "none";
          sheet.style.transform = `translateY(${dy}px)`;
        }
        return;
      }

      // Cancel on horizontal or upward movement
      if (Math.abs(dx) > Math.abs(dy) + 3 || dy < 0) {
        active = false;
        return;
      }

      // Not enough vertical movement yet — block PTR on non-scrollable areas
      if (dy < DIRECTION_THRESHOLD) {
        const sp = findScrollParent(e.target as Element, sheet);
        if (!sp) e.preventDefault();
        return;
      }

      // Clear downward intent — cancel if scrollable content isn't at top
      const sp = findScrollParent(e.target as Element, sheet);
      if (sp && sp.scrollTop > 0) {
        active = false;
        return;
      }

      // Commit to dismiss — prevent browser scroll from here on
      draggingRef.current = true;
      e.preventDefault();
      if (dy > 0) {
        dragYRef.current = dy;
        sheet.style.transition = "none";
        sheet.style.transform = `translateY(${dy}px)`;
      }
    }

    function onTouchEnd() {
      active = false;
      touchActiveRef.current = false;
      finishDrag(sheet);
    }

    sheet.addEventListener("touchstart", onTouchStart, { passive: true });
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    sheet.addEventListener("touchend", onTouchEnd);
    sheet.addEventListener("touchcancel", onTouchEnd);

    return () => {
      sheet.removeEventListener("touchstart", onTouchStart);
      sheet.removeEventListener("touchmove", onTouchMove);
      sheet.removeEventListener("touchend", onTouchEnd);
      sheet.removeEventListener("touchcancel", onTouchEnd);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Pointer events for desktop mouse drag (touch devices use the touch handlers above)
  function onPointerDown(e: React.PointerEvent) {
    if (touchActiveRef.current) return;
    if (e.pointerType === "touch") return;
    if ((e.target as Element).closest("button, input, select, textarea, a, [role=button]")) return;
    const startY = e.clientY;
    const startX = e.clientX;
    let committed = false;

    function onMove(ev: PointerEvent) {
      const dy = ev.clientY - startY;
      const dx = ev.clientX - startX;
      if (!committed) {
        if (Math.abs(dx) > Math.abs(dy) + 3 || dy < 0) { cleanup(); return; }
        if (dy < DIRECTION_THRESHOLD) return;
        const sp = findScrollParent(ev.target as Element, sheetRef.current!);
        if (sp && sp.scrollTop > 0) { cleanup(); return; }
        committed = true;
        draggingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      if (dy > 0 && sheetRef.current) {
        dragYRef.current = dy;
        sheetRef.current.style.transition = "none";
        sheetRef.current.style.transform = `translateY(${dy}px)`;
      }
    }

    function onUp() { cleanup(); if (sheetRef.current) finishDrag(sheetRef.current); }

    function cleanup() {
      (e.currentTarget as HTMLElement)?.removeEventListener("pointermove", onMove);
      (e.currentTarget as HTMLElement)?.removeEventListener("pointerup", onUp);
      (e.currentTarget as HTMLElement)?.removeEventListener("pointercancel", onUp);
    }

    (e.currentTarget as HTMLElement).addEventListener("pointermove", onMove);
    (e.currentTarget as HTMLElement).addEventListener("pointerup", onUp);
    (e.currentTarget as HTMLElement).addEventListener("pointercancel", onUp);
  }

  const sheetDragProps = {
    onPointerDown,
    style: { userSelect: "none" } as React.CSSProperties,
  };

  return { sheetRef, sheetDragProps };
}
