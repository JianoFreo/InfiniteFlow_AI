import { useEffect, useRef } from "react";
import { bayer, hexToRgb, prefersReducedMotion } from "../../lib/dither";

interface DitherImageProps {
  src: string;
  /** Resolution of the dither grid (pixels across). Lower = chunkier. */
  cells?: number;
  fg?: string;
  bg?: string;
  contrast?: number;
  brightness?: number;
  /** Animate like a printer head laying the image down row by row. */
  print?: boolean;
  /** Re-run the print animation when this changes. */
  printKey?: unknown;
  className?: string;
}

/** Renders any image as an ordered-dither (Bayer 8×8) 2-colour bitmap on a canvas. */
const DitherImage = ({
  src,
  cells = 200,
  fg = "#ece9e2",
  bg = "#050505",
  contrast = 1.25,
  brightness = 0,
  print = false,
  printKey,
  className,
}: DitherImageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let cancelled = false;
    const img = new Image();
    img.src = src;

    img.onload = () => {
      if (cancelled) return;
      const w = cells;
      const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
      canvas.width = w;
      canvas.height = h;

      const scratch = document.createElement("canvas");
      scratch.width = w;
      scratch.height = h;
      const sctx = scratch.getContext("2d", { willReadFrequently: true })!;
      sctx.drawImage(img, 0, 0, w, h);
      const px = sctx.getImageData(0, 0, w, h).data;

      const gray = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const l = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
        gray[i] = Math.min(1, Math.max(0, (l - 0.5) * contrast + 0.5 + brightness));
      }

      const ctx = canvas.getContext("2d")!;
      const out = ctx.createImageData(w, h);
      const [fr, fg2, fb] = hexToRgb(fg);
      const [br, bg2, bb] = hexToRgb(bg);

      const draw = (rows: number) => {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            const printed = y < rows;
            const on = printed && gray[y * w + x] > bayer(x, y);
            const scan = !printed && y < rows + 2;
            const [r, g, b] = scan ? [255, 255, 255] : on ? [fr, fg2, fb] : [br, bg2, bb];
            out.data[o] = r;
            out.data[o + 1] = g;
            out.data[o + 2] = b;
            out.data[o + 3] = 255;
          }
        }
        ctx.putImageData(out, 0, 0);
      };

      if (!print || prefersReducedMotion()) {
        draw(h);
        return;
      }
      const start = performance.now();
      const duration = 2600;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        draw(Math.floor((1 - (1 - t) ** 2) * h));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src, cells, fg, bg, contrast, brightness, print, printKey]);

  return <canvas ref={canvasRef} className={className} style={{ imageRendering: "pixelated", width: "100%", height: "auto", display: "block" }} />;
};

export default DitherImage;
