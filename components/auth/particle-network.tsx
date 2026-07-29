/**
 * Ambient "AI network" overlay for the auth left panel -- a handful of
 * connected nodes rendered as a static inline SVG (so no client JS/canvas
 * is needed) with each node's opacity gently pulsed via Tailwind's
 * built-in `animate-pulse` (already `prefers-reduced-motion`-aware through
 * `motion-safe:`). Purely decorative: `pointer-events-none` + `aria-hidden`.
 */
const NODES: Array<{ x: number; y: number; r: number; delay: string }> = [
  { x: 40, y: 60, r: 2.5, delay: "0s" },
  { x: 160, y: 30, r: 2, delay: "0.6s" },
  { x: 260, y: 90, r: 3, delay: "1.1s" },
  { x: 90, y: 160, r: 2, delay: "1.6s" },
  { x: 210, y: 190, r: 2.5, delay: "0.3s" },
  { x: 320, y: 150, r: 2, delay: "0.9s" },
  { x: 60, y: 260, r: 2, delay: "1.4s" },
  { x: 190, y: 300, r: 3, delay: "0.2s" },
  { x: 300, y: 260, r: 2, delay: "1.8s" },
];

const LINKS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [0, 3],
  [1, 4],
  [2, 5],
  [3, 4],
  [4, 5],
  [3, 6],
  [4, 7],
  [5, 8],
  [6, 7],
  [7, 8],
];

export function ParticleNetwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 340"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <g stroke="white" strokeOpacity="0.14" strokeWidth="1">
        {LINKS.map(([a, b], index) => {
          const from = NODES[a];
          const to = NODES[b];
          return <line key={index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
        })}
      </g>
      <g fill="white">
        {NODES.map((node, index) => (
          <circle
            key={index}
            cx={node.x}
            cy={node.y}
            r={node.r}
            className="motion-safe:animate-pulse"
            style={{ animationDelay: node.delay, animationDuration: "3.2s" }}
          />
        ))}
      </g>
    </svg>
  );
}
