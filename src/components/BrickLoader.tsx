import React from "react";

/**
 * Container: 200×200 circle
 * Clip window: 144×80px, centered (top/bottom: 60px, left/right: 28px)
 * BRICK_H derived from clip: (80 - GAP_Y) / 2 = 36px — rows never clip
 * BRICK_W: 52, GAP_X: 8 — ~2 full bricks visible across 144px window
 */

const BRICK_W = 50;
const BRICK_H = 28;
const GAP_X   = 8;
const GAP_Y   = 8;
const N       = 8;
const STEP    = BRICK_W + GAP_X; // 58

function BrickRow({ startOffset = 0 }: { startOffset?: number }) {
  return (
    <div style={{ transform: `translateX(${startOffset}px)`, height: BRICK_H }}>
      <div
        style={{
          display: "flex",
          animation: "scroll-bricks 4s linear infinite",
          willChange: "transform",
        }}
      >
        {Array.from({ length: N * 2 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: BRICK_W,
              height: BRICK_H,
              borderRadius: 7,
              background: "rgba(255,255,255,0.95)",
              flexShrink: 0,
              marginRight: GAP_X,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function BrickLoader() {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="bg-primary"
        style={{
          width: 200,
          height: 200,
          borderRadius: 100,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 40,
            right: 40,
            top: 68,
            bottom: 68,
            overflow: "hidden",
            borderRadius: 7,
            display: "flex",
            flexDirection: "column",
            gap: GAP_Y,
          }}
        >
          <BrickRow startOffset={0} />
          <BrickRow startOffset={-STEP / 2} />
        </div>
      </div>
    </div>
  );
}
