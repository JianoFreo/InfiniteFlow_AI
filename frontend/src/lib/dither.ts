/** Builds an n×n Bayer threshold matrix (n = power of two), values in 0..1. */
const buildBayer = (n: number): Float32Array => {
  let m = [[0]];
  for (let size = 1; size < n; size *= 2) {
    const next: number[][] = [];
    for (let y = 0; y < size * 2; y++) {
      next.push([]);
      for (let x = 0; x < size * 2; x++) {
        const base = m[y % size][x % size] * 4;
        const quad = (y < size ? 0 : 2) + (x < size ? 0 : 1);
        next[y].push(base + [0, 2, 3, 1][quad]);
      }
    }
    m = next;
  }
  const flat = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) flat[y * n + x] = (m[y][x] + 0.5) / (n * n);
  return flat;
};

export const BAYER8 = buildBayer(8);
export const bayer = (x: number, y: number) => BAYER8[(y & 7) * 8 + (x & 7)];

export const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.replace(/./g, "$&$&") : value;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
