import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * True once the client has hydrated, false during SSR and during
 * React's first client render pass. Needed anywhere a client value can
 * genuinely diverge from what the server rendered (e.g. next-themes'
 * resolved theme, which next-themes makes available synchronously on
 * the client via its own inline script but which the server has no way
 * to know) -- useSyncExternalStore's getServerSnapshot/getSnapshot
 * split is the React-sanctioned way to bridge that without a manual
 * `useEffect(() => setState(true), [])`, which this repo's lint config
 * (react-hooks/set-state-in-effect) rejects anyway.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
