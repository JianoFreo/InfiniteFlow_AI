from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class JobCreateResponse(BaseModel):
    id: UUID
    status: str


class JobResponse(BaseModel):
    id: UUID
    status: str
    interpolation_factor: int
    progress: int
    error_message: str | None = None
    created_at: datetime
    output_ready: bool
    output_url: str | None = None

    class Config:
        from_attributes = True


class JobOptions(BaseModel):
    interpolation_factor: int = Field(default=2, ge=2, le=4)
