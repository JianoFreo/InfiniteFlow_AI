import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
}

/** Fades/blurs/slides its children in the first time they scroll into view. */
const Reveal = ({ children, as: Tag = "div", delay = 0, className }: RevealProps) => {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={cn("reveal", shown && "in", className)} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
};

export default Reveal;
