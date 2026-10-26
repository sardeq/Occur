/**
 * Greedy circle packing for the home screen.
 *
 * Bubbles are placed biggest-first; each next bubble tries positions tangent
 * to every bubble already placed and takes the free spot closest to the
 * anchor (a point a little above the middle of the screen). The result is an
 * organic cluster where the things you do most sit in the middle, and new or
 * rarely used categories drift to the edge. Pure + deterministic, so the
 * layout only changes when the inputs do.
 */

export type PackItem = { id: string; r: number };
export type Placed = { id: string; x: number; y: number; r: number };

const STEPS = 36;

export function pack(
  items: PackItem[],
  width: number,
  viewportHeight: number,
  opts: { gap?: number; pad?: number; anchorY?: number } = {},
): { placed: Placed[]; height: number } {
  const gap = opts.gap ?? 10;
  const pad = opts.pad ?? 16;
  if (!items.length || width <= 0) return { placed: [], height: 0 };

  const cx = width / 2;
  const anchorY = opts.anchorY ?? viewportHeight * 0.42;
  const placed: Placed[] = [];

  const fits = (x: number, y: number, r: number) => {
    if (x - r < pad || x + r > width - pad || y - r < pad) return false;
    for (const p of placed) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < p.r + r + gap - 0.5) return false;
    }
    return true;
  };

  for (const it of items) {
    if (!placed.length) {
      placed.push({ id: it.id, x: cx, y: Math.max(anchorY, it.r + pad), r: it.r });
      continue;
    }
    let best: { x: number; y: number; score: number } | null = null;
    for (const p of placed) {
      const dist = p.r + it.r + gap;
      for (let k = 0; k < STEPS; k++) {
        const a = (k / STEPS) * Math.PI * 2;
        const x = p.x + Math.cos(a) * dist;
        const y = p.y + Math.sin(a) * dist;
        if (!fits(x, y, it.r)) continue;
        // slightly favour horizontal spread so the cluster fills the width
        const score = Math.hypot((x - cx) * 0.75, y - anchorY);
        if (!best || score < best.score) best = { x, y, score };
      }
    }
    if (!best) {
      // no tangent spot (very narrow screen) — drop below everything
      const bottom = Math.max(...placed.map((p) => p.y + p.r));
      best = { x: cx, y: bottom + gap + it.r, score: 0 };
    }
    placed.push({ id: it.id, x: best.x, y: best.y, r: it.r });
  }

  // normalise: content starts at `pad`; centre vertically when it fits
  const minY = Math.min(...placed.map((p) => p.y - p.r));
  const maxY = Math.max(...placed.map((p) => p.y + p.r));
  const contentH = maxY - minY;
  const offset = contentH + pad * 2 < viewportHeight ? (viewportHeight - contentH) / 2 - minY : pad - minY;
  for (const p of placed) p.y += offset;
  return { placed, height: Math.max(viewportHeight, contentH + pad * 2) };
}

/** Radius for a bubble from its usage weight, relative to the busiest one. */
export function radiusFor(weight: number, maxWeight: number, width: number, count: number): number {
  const crowd = count > 7 ? Math.max(0.62, Math.sqrt(7 / count)) : 1;
  const rMax = width * 0.215 * crowd;
  const rMin = width * 0.125 * crowd;
  if (maxWeight <= 0) return (rMax + rMin) / 2;
  return rMin + (rMax - rMin) * Math.sqrt(Math.min(1, weight / maxWeight));
}
