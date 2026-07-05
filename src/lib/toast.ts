"use client";

/**
 * App-wide toast bus. Call toast.success/error/info from any client code;
 * the <Toaster /> in the root layout renders them. Module-level emitter so
 * plain async handlers can toast without hook/context plumbing.
 */

export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type Listener = (t: ToastItem) => void;

const listeners = new Set<Listener>();
let nextId = 1;

function emit(kind: ToastKind, message: string) {
  const item: ToastItem = { id: nextId++, kind, message };
  listeners.forEach((l) => l(item));
  return item.id;
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
};

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
