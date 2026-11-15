import { FileVideo, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn, formatBytes, formatDuration } from "../../../lib/utils";

interface DropZoneProps {
  file: File | null;
  disabled: boolean;
  onFile: (file: File | null) => void;
}

const DropZone = ({ file, disabled, onFile }: DropZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ durationMs: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setMeta(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked) onFile(picked);
  };

  if (file && preview) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
        <video
          src={preview}
          className="aspect-video w-full bg-black object-contain"
          muted
          controls
          playsInline
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setMeta({ durationMs: video.duration * 1000, width: video.videoWidth, height: video.videoHeight });
          }}
        />
        <div className="flex items-center gap-3 p-3">
          <FileVideo className="size-5 shrink-0 text-flow" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-ink-faint">
              {formatBytes(file.size)}
              {meta && ` · ${meta.width}×${meta.height} · ${formatDuration(meta.durationMs)}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40"
            onClick={() => onFile(null)}
            disabled={disabled}
            aria-label="Remove file"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        pick(event.dataTransfer.files);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
        dragging ? "border-flow bg-flow/8" : "border-line-strong hover:border-flow/60 hover:bg-panel-2/50",
      )}
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-flow/12 text-flow">
        <UploadCloud className="size-7" />
      </span>
      <div>
        <p className="font-medium">Drop a video here, or click to browse</p>
        <p className="mt-1 text-sm text-ink-faint">MP4, MOV, MKV, WebM · up to 4 GB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          pick(event.target.files);
          event.target.value = "";
        }}
      />
    </button>
  );
};

export default DropZone;
