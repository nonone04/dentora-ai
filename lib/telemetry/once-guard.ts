/**
 * Guarantees a callback runs at most once per guard instance. Used by
 * components/telemetry/feature-usage-beacon.tsx (one instance per mount,
 * held in a ref) so a re-render -- including React's dev-mode
 * double-invoke of effects -- can't double-fire a "Feature Used" event.
 */
export function createOnceGuard() {
  let fired = false;
  return {
    fireOnce(callback: () => void) {
      if (fired) return;
      fired = true;
      callback();
    },
  };
}
