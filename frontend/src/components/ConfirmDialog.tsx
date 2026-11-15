interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({ open, title, message, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-ink-dim">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg px-3.5 py-2 text-sm text-ink-dim hover:bg-panel-2" onClick={onCancel}>
            Keep it
          </button>
          <button
            className="rounded-lg bg-bad px-3.5 py-2 text-sm font-semibold text-canvas hover:bg-bad/90 disabled:opacity-60"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
