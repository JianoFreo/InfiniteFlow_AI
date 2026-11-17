import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { JobMode, PreprocessStep } from "../../interface/Job";
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
}

const UploadForm = ({ onSubmit }: UploadFormProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [factor, setFactor] = useState(4);
  const [mode, setMode] = useState<JobMode>("flow");
  const [preprocess, setPreprocess] = useState<PreprocessStep[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, bytesPerSecond: 0 });
  const startedAt = useRef(0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    startedAt.current = performance.now();
    setProgress({ loaded: 0, total: file.size, bytesPerSecond: 0 });
    try {
      await onSubmit({ file, factor, mode, preprocess }, ({ loaded, total }) => {
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
      <DropZone file={file} disabled={uploading} onFile={setFile} />
      <FactorSlider value={factor} disabled={uploading} onChange={setFactor} />
      <ModeToggle value={mode} disabled={uploading} onChange={setMode} />
      <PreprocessOptions value={preprocess} disabled={uploading} onChange={setPreprocess} />
      {uploading && <UploadProgress {...progress} />}
      <button
        type="submit"
        disabled={!file || uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-flow px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-flow-strong disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
      >
        {uploading ? "Uploading…" : `Create ${factor}× video`}
      </button>
    </form>
  );
};

export default UploadForm;
