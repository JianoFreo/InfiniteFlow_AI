import { useEffect, useRef } from "react";
import { bayer, prefersReducedMotion } from "../../lib/dither";

/** Fixed full-screen animated dither "aura": flowing sine fields thresholded through a Bayer matrix. */
const DitherField = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const SCALE = 4;
    let w = 0;
    let h = 0;
    let img: ImageData;
    let raf = 0;
    let last = 0;

    const resize = () => {
      w = Math.ceil(window.innerWidth / SCALE);
      h = Math.ceil(window.innerHeight / SCALE);
      canvas.width = w;
      canvas.height = h;
      img = ctx.createImageData(w, h);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 42) return; // ~24 fps, like film
      last = now;
      const t = now / 1000;
      const s = window.scrollY / 400;
      const d = img.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v =
            Math.sin(x * 0.045 + t * 0.9 + s) +
            Math.sin(y * 0.06 - t * 0.7 - s * 0.6) +
            Math.sin((x + y) * 0.03 + t * 0.5) +
            Math.sin(Math.hypot(x - w / 2, y - h / 2) * 0.07 - t * 1.2 - s);
          const level = (v + 4) / 8; // 0..1
          const on = level * level > bayer(x, y) + 0.32;
          const o = (y * w + x) * 4;
          d[o] = d[o + 1] = d[o + 2] = 236;
          d[o + 3] = on ? 255 : 0;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    if (prefersReducedMotion()) frame(1000);
    else raf = requestAnimationFrame(frame);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-[0.07]"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export default DitherField;
