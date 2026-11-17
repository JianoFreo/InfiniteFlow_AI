import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  base: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
}

const INK = "190,203,232"; // cool, dim starlight: dark mode, not bright white
const SCALE = 2; // one canvas pixel = 2 screen pixels, so stars stay crisp, chunky specks

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Gaussian-ish random number in roughly -1..1 (sum of uniforms). */
const bell = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

interface SpaceBackgroundProps {
  /** 1..8. More means more shooting stars (the app passes how busy the queue is). */
  intensity: number;
}

/**
 * Fixed full-screen night sky behind the whole app: twinkling speckled stars, a faint Milky Way band of denser
 * dust, and shooting stars with speckled tails. Sits under all content and never takes pointer events.
 */
const SpaceBackground = ({ intensity }: SpaceBackgroundProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const level = useRef(intensity);
  level.current = intensity;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const reduced = reducedMotion();
    let w = 1;
    let h = 1;
    let stars: Star[] = [];
    const meteors: Meteor[] = [];
    let raf = 0;
    let last = 0;
    let spawn = 0.95; // a shooting star right away

    const makeStar = (onBand: boolean): Star => {
      let x: number;
      let y: number;
      if (onBand) {
        // a diagonal band of denser, dimmer dust, like the Milky Way
        const along = Math.random();
        const spread = bell() * h * 0.16;
        x = along * w;
        y = h * (0.85 - along * 0.7) + spread;
      } else {
        x = Math.random() * w;
        y = Math.random() * h;
      }
      return {
        x: Math.floor(Math.min(w - 1, Math.max(0, x))),
        y: Math.floor(Math.min(h - 1, Math.max(0, y))),
        size: !onBand && Math.random() < 0.1 ? 2 : 1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 2.4,
        base: onBand ? 0.1 + Math.random() * 0.3 : 0.22 + Math.random() * 0.5,
      };
    };

    const resize = () => {
      w = Math.max(1, Math.floor(window.innerWidth / SCALE));
      h = Math.max(1, Math.floor(window.innerHeight / SCALE));
      canvas.width = w;
      canvas.height = h;
      const area = w * h;
      stars = [
        ...Array.from({ length: Math.floor(area / 420) }, () => makeStar(false)),
        ...Array.from({ length: Math.floor(area / 260) }, () => makeStar(true)),
      ];
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      ctx.clearRect(0, 0, w, h);

      const t = now / 1000;
      for (const s of stars) {
        const a = s.base * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = `rgba(${INK},${a.toFixed(2)})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
        if (s.size === 2) {
          // the brightest stars get a little glint
          ctx.fillStyle = `rgba(${INK},${(a * 0.5).toFixed(2)})`;
          ctx.fillRect(s.x - 1, s.y, 1, 2);
          ctx.fillRect(s.x + 2, s.y, 1, 2);
          ctx.fillRect(s.x, s.y - 1, 2, 1);
          ctx.fillRect(s.x, s.y + 2, 2, 1);
        }
      }

      if (reduced) return;
      spawn += dt * (0.12 + level.current * 0.22);
      while (spawn >= 1) {
        spawn -= 1;
        const speed = 150 + Math.random() * 170;
        meteors.push({
          x: w * (0.3 + Math.random() * 0.8),
          y: -4 + Math.random() * h * 0.5,
          vx: -speed * 0.82,
          vy: speed * 0.5,
          len: 20 + Math.random() * 30,
          life: 1,
        });
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.life -= dt * 0.32;
        if (m.life <= 0 || m.x < -50 || m.y > h + 10) {
          meteors.splice(i, 1);
          continue;
        }
        const mag = Math.hypot(m.vx, m.vy);
        const dx = -m.vx / mag;
        const dy = -m.vy / mag;
        const fade = Math.min(1, m.life * 1.6);
        // speckled tail: dots thinning out and drifting away from the head
        for (let k = 0; k < m.len; k++) {
          if (Math.random() < 0.15 + k / m.len) continue;
          const a = (1 - k / m.len) * fade;
          const jx = (Math.random() - 0.5) * (1 + k * 0.08);
          const jy = (Math.random() - 0.5) * (1 + k * 0.08);
          ctx.fillStyle = `rgba(${INK},${a.toFixed(2)})`;
          ctx.fillRect(Math.round(m.x + dx * k + jx), Math.round(m.y + dy * k + jy), 1, 1);
        }
        ctx.fillStyle = `rgba(225,233,255,${(fade * 0.8).toFixed(2)})`;
        ctx.fillRect(Math.round(m.x), Math.round(m.y), 2, 2);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    if (reduced) frame(1000);
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
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export default SpaceBackground;
