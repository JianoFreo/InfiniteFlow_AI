import { FramesDemo, Hero, Marquee, Steps } from "../components/Landing/Landing";
import Reveal from "../components/Landing/Reveal";
import PipelineExplainer from "../components/Upload/PipelineExplainer";
import UploadForm from "../components/Upload/UploadForm";
import type { UploadProgressInfo } from "../components/Upload/UploadForm";
import type { JobMode } from "../interface/Job";

interface UploadPageProps {
  onUpload: (input: { file: File; factor: number; mode: JobMode }, onProgress: (p: UploadProgressInfo) => void) => Promise<void>;
}

const UploadPage = ({ onUpload }: UploadPageProps) => (
  <>
    <Hero />
    <Marquee />
    <section id="upload" className="mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6">
      <Reveal as="h2" className="mb-10 font-display text-6xl uppercase leading-none sm:text-8xl">
        Drop a video.
        <br />
        <span className="text-transparent [-webkit-text-stroke:1.5px_var(--color-ink)]">Let it flow.</span>
      </Reveal>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Reveal>
          <UploadForm onSubmit={onUpload} />
        </Reveal>
        <Reveal delay={120}>
          <PipelineExplainer />
        </Reveal>
      </div>
    </section>
    <FramesDemo />
    <Marquee reverse />
    <Steps />
    <p className="relative z-10 px-5 pb-10 text-center font-mono text-[10px] uppercase tracking-widest text-ink-faint sm:px-10">
      3D head scan: Lee Perry-Smith, CC BY 3.0 (infinite-realities.com)
    </p>
  </>
);

export default UploadPage;
