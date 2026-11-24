export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const randRange = (lo, hi) => lo + Math.random() * (hi - lo);

/** Distance from a point to a segment, plus the closest point on it. */
export function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  const t = len2 ? clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1) : 0;
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return { d: Math.hypot(px - cx, py - cy), cx, cy };
}
