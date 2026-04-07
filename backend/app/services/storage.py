from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4


class LocalVideoStorage:
    def __init__(self, root_dir: str | Path = "storage") -> None:
        self.root_dir = Path(root_dir)
        self.upload_dir = self.root_dir / "uploads"
        self.processed_dir = self.root_dir / "processed"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def save_uploaded_video(self, file_obj: BinaryIO, original_name: str) -> str:
        path = self.upload_dir / self._build_name(original_name)
        with path.open("wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)
        return str(path)

    def save_processed_video(self, source_path: str | Path, job_id: str | None = None) -> str:
        source = Path(source_path)
        target = self.processed_dir / self._build_name(source.name, job_id=job_id)
        shutil.copy2(source, target)
        return str(target)

    def get_download_path(self, file_path: str | Path) -> str:
        return str(Path(file_path))

    def _build_name(self, original_name: str, job_id: str | None = None) -> str:
        suffix = Path(original_name).suffix or ".mp4"
        prefix = f"{job_id}_" if job_id else ""
        return f"{prefix}{uuid4().hex}{suffix}"
