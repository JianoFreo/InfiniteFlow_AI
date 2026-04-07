# InfiniteFlow AI - Lightweight Video Interpolation SaaS

Simple, production-ready baseline with low resource usage:

- Backend: FastAPI + SQLAlchemy
- Queue: Redis + RQ
- Database: PostgreSQL
- Worker: OpenCV + FFmpeg (no deep learning models)
- Frontend: Next.js App Router
- Infra: Docker Compose + Nginx

## Folder Structure

- `frontend/` - Upload UI and job status pages
- `backend/` - API, persistence, and queueing
- `worker/` - CPU interpolation pipeline
- `infra/` - Compose stack, Dockerfiles, Nginx

## Request Flow

1. User uploads video via frontend.
2. Backend saves file metadata and enqueues RQ job.
3. Worker processes the job, creates interpolated output, and updates DB status.
4. Frontend polls job state and exposes download link when done.

## Quick Start

From `infra/`:

```bash
docker compose up --build
```

Endpoints:

- App: http://localhost
- API docs: http://localhost/docs
- Health: http://localhost/api/v1/health

## Environment Defaults

- Postgres DB: `interp`
- Postgres user: `app`
- Postgres password: `app`
- Redis queue: `video`
- Shared file volume mounted at: `/data`

## Why This Is Lightweight

- No GPU dependency
- No model loading or inference overhead
- Frame blending interpolation keeps memory predictable
- Redis + RQ is simpler and cheaper to operate than larger distributed task stacks
