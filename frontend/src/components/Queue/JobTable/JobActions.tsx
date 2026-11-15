import { Ban, Download, Eye, Trash2 } from "lucide-react";
import type { Job } from "../../../interface/Job";
import { isActive } from "../../../interface/Job";
import { apiUrl } from "../../../lib/axios";

interface JobActionsProps {
  job: Job;
  busy: boolean;
  onOpen: (id: number) => void;
  onCancel: (id: number) => void;
  onDelete: (job: Job) => void;
}

const iconButton =
  "grid size-8 place-items-center rounded-lg text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-40";

const JobActions = ({ job, busy, onOpen, onCancel, onDelete }: JobActionsProps) => (
  <div className="flex items-center justify-end gap-1">
    <button className={iconButton} onClick={() => onOpen(job.id)} title="Details" aria-label="Details">
      <Eye className="size-4" />
    </button>
    {job.output.downloadUrl && (
      <a className={iconButton} href={apiUrl(`${job.output.downloadUrl}?attachment=1`)} title="Download" aria-label="Download">
        <Download className="size-4" />
      </a>
    )}
    {isActive(job) && (
      <button className={`${iconButton} hover:text-warn`} onClick={() => onCancel(job.id)} disabled={busy} title="Cancel" aria-label="Cancel">
        <Ban className="size-4" />
      </button>
    )}
    <button className={`${iconButton} hover:text-bad`} onClick={() => onDelete(job)} disabled={busy} title="Delete" aria-label="Delete">
      <Trash2 className="size-4" />
    </button>
  </div>
);

export default JobActions;
