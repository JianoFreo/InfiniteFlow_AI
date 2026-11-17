import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "../lib/utils";

export interface ToastMessage {
  id: number;
  tone: "ok" | "bad";
  text: string;
}

const Toast = ({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6" role="status">
      <div
        className={cn(
          "flex max-w-md items-start gap-3 rounded-xl border bg-panel-2 px-4 py-3 text-sm shadow-2xl",
          toast.tone === "ok" ? "border-ok/30" : "border-bad/40",
        )}
      >
        <p className="flex-1">{toast.text}</p>
        <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
