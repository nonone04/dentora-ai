"use client";

import { useSyncExternalStore } from "react";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

function subscribe(callback: () => void) {
  const mediaQueryList = window.matchMedia(COARSE_POINTER_QUERY);
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * True on touch/coarse-pointer devices -- shared by ParallaxLayer and
 * TiltFrame so neither ever attaches a pointermove listener (not just
 * suppresses the resulting animation) on a device where that would risk
 * interfering with touch-scrolling. Uses useSyncExternalStore (not a
 * useEffect+setState pair) since this is exactly what it's for: reading
 * external browser state safely across server/client, with a stable
 * SSR-safe default of `false`.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
