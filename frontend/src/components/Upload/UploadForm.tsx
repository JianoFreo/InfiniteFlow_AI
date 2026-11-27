import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { JobMode, PreprocessStep } from "../../interface/Job";
import { formatSeconds } from "../../interface/Usage";
import { useSettings } from "../../lib/settings";
import { useUsage } from "../../lib/usage";
import DropZone from "./UploadForm/DropZone";
import FactorSlider from "./UploadForm/FactorSlider";
import ModeToggle from "./UploadForm/ModeToggle";
import PreprocessOptions from "./UploadForm/PreprocessOptions";
import UploadProgress from "./UploadForm/UploadProgress";

export interface UploadProgressInfo {
  loaded: number;
  total: number;
}

interface UploadFormProps {
  onSubmit: (input: { file: File; factor: number; mode: JobMode; preprocess: PreprocessStep[] }, onProgress: (p: UploadProgressInfo) => void) => Promise<void>;
  /** Opens the plans dialog (when a limit blocks the upload). */
  onPlans: (reason?: string) => void;
}

const UploadForm = ({ onSubmit, onPlans }: UploadFormProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const { settings } = useSettings();
  const { usage } = useUsage();
  const [factor, setFactor] = useState(settings.defaultFactor);
  const [mode, setMode] = useState<JobMode>(settings.defaultMode);
  const [preprocess, setPreprocess] = useState<PreprocessStep[]>(settings.defaultPreprocess);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, bytesPerSecond: 0 });
  const startedAt = useRef(0);

  // Changing the defaults in Settings updates the form straight away
  useEffect(() => setFactor(settings.defaultFactor), [settings.defaultFactor]);
  useEffect(() => setMode(settings.defaultMode), [settings.defaultMode]);
  useEffect(() => setPreprocess(settings.defaultPreprocess), [settings.defaultPreprocess]);

  // The plan's limits. The server checks them too; this only saves a pointless upload.
  const limits = usage?.limits;
  const effectiveFactor = Math.min(factor, limits?.maxFactor ?? factor);
  const clipSeconds = durationMs == null ? null : Math.ceil(durationMs / 1000);
  const blocked: string | null = !usage
    ? null
    : usage.remainingSeconds <= 0
      ? "You've used today's video allowance."
      : clipSeconds != null && limits && clipSeconds > limits.maxClipSeconds
        ? `This clip is ${formatSeconds(clipSeconds)}. Your plan accepts clips up to ${formatSeconds(limits.maxClipSeconds)}.`
        : clipSeconds != null && clipSeconds > usage.remainingSeconds
          ? `This clip is ${formatSeconds(clipSeconds)}, but you have ${formatSeconds(usage.remainingSeconds)} left today.`
          : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || uploading) return;
    if (blocked) {
      onPlans(blocked);
      return;
    }
    setUploading(true);
    startedAt.current = performance.now();
    setProgress({ loaded: 0, total: file.size, bytesPerSecond: 0 });
    try {
      await onSubmit({ file, factor: effectiveFactor, mode, preprocess }, ({ loaded, total }) => {
        const seconds = (performance.now() - startedAt.current) / 1000;
        setProgress({ loaded, total, bytesPerSecond: seconds > 0 ? loaded / seconds : 0 });
      });
      setFile(null);
    } catch {
      // the shell already showed the error; keep the file selected so the user can retry
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6 rounded-xl border border-line bg-panel p-5 sm:p-6">
      <DropZone
        file={file}
        disabled={uploading}
        onFile={setFile}
        onDuration={setDurationMs}
        maxClipLabel={limits ? formatSeconds(limits.maxClipSeconds) : undefined}
      />
      <FactorSlider
        value={effectiveFactor}
        disabled={uploading}
        onChange={setFactor}
        allowedMax={limits?.maxFactor}
        onPlans={() => onPlans()}
      />
      <ModeToggle value={mode} disabled={uploading} onChange={setMode} />
      <PreprocessOptions value={preprocess} disabled={uploading} onChange={setPreprocess} />
      {uploading && <UploadProgress {...progress} />}
      {blocked && (file || usage?.remainingSeconds === 0) && (
        <p className="flex flex-wrap items-center justify-between gap-2 border border-warn/40 bg-warn/10 px-3 py-2 text-sm" role="alert">
          <span>{blocked}</span>
          <button type="button" onClick={() => onPlans(blocked)} className="text-ink underline underline-offset-2">
            See plans
          </button>
        </p>
      )}
      <button
        type="submit"
        disabled={!file || uploading || blocked != null}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-flow px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-flow-strong disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
      >
        {uploading ? "Uploading…" : `Create ${effectiveFactor}× video`}
      </button>
    </form>
  );
};

export default UploadForm;
