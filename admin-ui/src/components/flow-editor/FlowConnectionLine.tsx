interface FlowConnectionLineProps {
  /** x coordinate of the source node centre */
  x1: number;
  /** y coordinate of the source node bottom edge */
  y1: number;
  /** x coordinate of the destination node centre */
  x2: number;
  /** y coordinate of the destination node top edge */
  y2: number;
  /** Whether this is a fallback connection (dashed red) or a normal one (solid indigo) */
  isFallback?: boolean;
}

/**
 * A single SVG arrow connecting two flow step nodes.
 * The parent SVG element must be positioned absolutely over the canvas.
 */
export default function FlowConnectionLine({
  x1,
  y1,
  x2,
  y2,
  isFallback = false,
}: FlowConnectionLineProps) {
  const midY = (y1 + y2) / 2;

  // Cubic bezier: exit straight down then curve to enter the next node from above
  const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

  const color = isFallback ? '#ef4444' : '#6366f1';
  const dashArray = isFallback ? '6 4' : undefined;
  const markerId = isFallback ? 'arrowFallback' : 'arrowNormal';

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashArray}
        markerEnd={`url(#${markerId})`}
      />
    </>
  );
}
