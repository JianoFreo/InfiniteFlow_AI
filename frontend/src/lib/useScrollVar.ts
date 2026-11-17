import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Writes scroll progress into a `--p` CSS variable (0..1) on the element, so CSS can drive
 * 3D rotations/parallax from scroll with zero React re-renders.
 *  - "sticky":   progress through a tall section that contains a sticky stage
 *  - "exit":     0 when the element's top is at the viewport top, 1 once it has scrolled out
 *  - "viewport": 0 when it enters from below, 1 when it leaves above
 */
export type ScrollMode = "sticky" | "exit" | "viewport";

export const useScrollVar = (ref: RefObject<HTMLElement | null>, mode: ScrollMode, onChange?: (p: number) => void) => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      let p = 0;
      if (mode === "sticky") p = rect.height - vh > 0 ? -rect.top / (rect.height - vh) : 0;
      else if (mode === "exit") p = -rect.top / rect.height;
      else p = (vh - rect.top) / (vh + rect.height);
      p = Math.min(1, Math.max(0, p));
      el.style.setProperty("--p", p.toFixed(4));
      onChange?.(p);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, mode]);
};
