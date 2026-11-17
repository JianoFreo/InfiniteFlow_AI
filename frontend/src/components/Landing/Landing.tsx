import { ArrowDown } from "lucide-react";
import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useScrollVar } from "../../lib/useScrollVar";
import DitherImage from "../Dither/DitherImage";
import Reveal from "./Reveal";

const STATUE = "/statue.png";
const WORDS = ["IN-BETWEEN FRAMES", "OPTICAL FLOW", "24 → 240 FPS", "HAND-WRITTEN NUMPY", "NO PRETRAINED MODELS", "∞ FLOW"];

const Marquee = ({ reverse }: { reverse?: boolean }) => (
  <div className="overflow-hidden border-y border-line-strong py-4">
    <div className={`marquee ${reverse ? "marquee-reverse" : ""}`}>
      {[0, 1].map((k) => (
        <div key={k} className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={k === 1}>
          {WORDS.map((w) => (
            <span key={w + k} className="font-display text-3xl uppercase tracking-tight text-ink sm:text-5xl">
              {w} <span className="text-ink-faint">✦</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  useScrollVar(ref, "exit");

  return (
    <section ref={ref} className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="hero-stage relative w-[min(78vw,460px)]">
        <div className="hero-statue relative">
          <DitherImage src={STATUE} cells={170} print className="block" />
          <div className="hero-ghost absolute inset-0">
            <DitherImage src={STATUE} cells={170} fg="#050505" bg="#ece9e2" print />
          </div>
        </div>
      </div>

      <h1 className="hero-word hero-word-a font-display" aria-label="Infinite Flow">
        INFINITE
      </h1>
      <h1 className="hero-word hero-word-b font-display" aria-hidden>
        FLOW
      </h1>

      <div className="absolute bottom-8 left-5 max-w-[16rem] font-mono text-[11px] uppercase leading-relaxed tracking-widest text-ink-dim sm:left-8">
        <p className="text-ink">Frame interpolation</p>
        <p>Optical flow, written by hand.</p>
        <p>Upload a video. Get it back smoother.</p>
      </div>
      <a
        href="#upload"
        className="absolute bottom-8 right-5 flex items-center gap-2 border border-ink px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-canvas sm:right-8"
      >
        Start flowing <ArrowDown className="size-4 animate-bounce" />
      </a>
    </section>
  );
};

const RING = 6;

const StatueRing = () => {
  const ref = useRef<HTMLElement>(null);
  const [fps, setFps] = useState(24);
  useScrollVar(ref, "sticky", (p) => setFps(Math.round(24 + p * 216)));

  return (
    <section ref={ref} className="relative h-[480vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden">
        <p className="absolute left-5 top-8 font-mono text-[11px] uppercase tracking-widest text-ink-dim sm:left-8">
          01 / Between the frames
        </p>
        <p className="font-display text-[26vw] leading-none text-transparent [-webkit-text-stroke:1px_var(--color-ink-faint)] sm:text-[18vw]">
          {fps}
          <span className="text-[0.25em]"> FPS</span>
        </p>

        <div className="ring-scene absolute inset-0 grid place-items-center">
          <div className="ring">
            {Array.from({ length: RING }, (_, i) => (
              <div key={i} className="ring-item" style={{ "--i": i } as CSSProperties}>
                <DitherImage
                  src={STATUE}
                  cells={110}
                  fg={i % 2 ? "#050505" : "#ece9e2"}
                  bg={i % 2 ? "#ece9e2" : "#050505"}
                />
              </div>
            ))}
          </div>
        </div>

        <p className="absolute bottom-8 right-5 max-w-xs text-right font-mono text-[11px] uppercase leading-relaxed tracking-widest text-ink-dim sm:right-8">
          Keep scrolling. Every turn is a frame that never existed in your footage.
        </p>
      </div>
    </section>
  );
};

const STEPS = [
  ["01", "Upload", "Your clip is streamed in and probed for fps, size and audio."],
  ["02", "Chunk", "It is cut into short chunks so many workers can chew in parallel."],
  ["03", "Flow", "Optical flow is estimated by hand-written NumPy, then new frames are warped into the gaps."],
  ["04", "Merge", "Chunks are stitched back without re-encoding, your audio returns."],
];

const Steps = () => (
  <section className="mx-auto max-w-6xl px-5 py-32 sm:px-8">
    <Reveal as="p" className="mb-10 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
      02 / How it flows
    </Reveal>
    <div>
      {STEPS.map(([n, title, text], i) => (
        <Reveal key={n} delay={i * 80} className="step group grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 border-t border-line-strong py-8 sm:grid-cols-[7rem_1fr_1fr]">
          <span className="font-mono text-sm text-ink-faint">{n}</span>
          <h3 className="step-title font-display text-5xl uppercase leading-none sm:text-7xl">{title}</h3>
          <p className="col-span-2 max-w-sm text-sm leading-relaxed text-ink-dim sm:col-span-1">{text}</p>
        </Reveal>
      ))}
    </div>
  </section>
);

/** Full-bleed landing sequence shown above the upload form. */
const Landing = () => (
  <>
    <Hero />
    <Marquee />
    <StatueRing />
    <Marquee reverse />
    <Steps />
  </>
);

export default Landing;
