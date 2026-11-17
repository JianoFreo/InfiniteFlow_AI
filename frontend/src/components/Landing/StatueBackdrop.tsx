import { cn } from "../../lib/utils";
import DitherImage from "../Dither/DitherImage";

interface StatueBackdropProps {
  src: string;
  side?: "left" | "right";
  className?: string;
}

/**
 * Pure decoration: a faint, edge-faded dithered statue that turns in 3D with the parent's `--p`
 * scroll variable. It sits behind content and never takes pointer events.
 */
const StatueBackdrop = ({ src, side = "right", className }: StatueBackdropProps) => (
  <div
    aria-hidden
    className={cn(
      "backdrop-statue pointer-events-none absolute top-1/2 aspect-[4/5] w-[min(70vw,640px)] opacity-[0.32] mix-blend-lighten",
      side === "right" ? "-right-[12%]" : "-left-[12%]",
      className,
    )}
  >
    <DitherImage src={src} cells={170} cover />
  </div>
);

export default StatueBackdrop;
