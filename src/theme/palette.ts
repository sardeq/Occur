/**
 * Bubble colours. Each one is a three-stop radial gradient — a lit highlight,
 * the body colour and a deeper rim — so bubbles read as soft physical objects
 * on the paper background rather than flat circles.
 */
export type Swatch = {
  key: string;
  name: string;
  light: string;
  base: string;
  deep: string;
  /** text colour on top of the bubble */
  ink: string;
};

export const PALETTE: Swatch[] = [
  { key: 'apricot', name: 'Apricot', light: '#FFE6B0', base: '#FFB84F', deep: '#F0892A', ink: '#2A1A06' },
  { key: 'coral', name: 'Coral', light: '#FFD5C8', base: '#FF8F73', deep: '#E55C45', ink: '#2B0F09' },
  { key: 'rose', name: 'Rose', light: '#FFDCEA', base: '#F59CC2', deep: '#D5628F', ink: '#2B0B19' },
  { key: 'lilac', name: 'Lilac', light: '#EDE4FF', base: '#B9A3FF', deep: '#8466EE', ink: '#160B33' },
  { key: 'sky', name: 'Sky', light: '#DAF1FF', base: '#8BCBFF', deep: '#4B95E6', ink: '#06192B' },
  { key: 'mint', name: 'Mint', light: '#D8F8E9', base: '#80DDB6', deep: '#36AF84', ink: '#062319' },
  { key: 'lime', name: 'Lime', light: '#F1F9C9', base: '#C9EA6E', deep: '#93BE2E', ink: '#1B2306' },
  { key: 'sand', name: 'Sand', light: '#F6EDDE', base: '#DCC6A3', deep: '#B39370', ink: '#21180B' },
  { key: 'slate', name: 'Ink', light: '#77716A', base: '#34302B', deep: '#151311', ink: '#F7F1E7' },
];

const BY_KEY = new Map(PALETTE.map((s) => [s.key, s]));

export function swatch(key: string | undefined | null): Swatch {
  return (key && BY_KEY.get(key)) || PALETTE[0];
}

/** Hex → rgba with alpha */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Next colour for a new category: the least used one. */
export function nextColor(used: string[]): string {
  const counts = new Map(PALETTE.map((s) => [s.key, 0]));
  used.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
  return [...counts.entries()].filter(([k]) => k !== 'slate').sort((a, b) => a[1] - b[1])[0][0];
}
