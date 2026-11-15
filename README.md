# InfiniteFlow AI - Distributed Video Frame Interpolation

Upload a video, pick a factor (2x to 8x), and InfiniteFlow generates the in-between frames using optical flow.
The work is split into chunks and spread across as many engine replicas as you run, with live progress in the browser.

![alt text](image.png)
<img width="1208" height="620" alt="image" src="https://github.com/user-attachments/assets/198c65e8-cfb6-483f-897a-cabd98f1dc0d" />

## Stack

| Part | Tech | Role |
| --- | --- | --- |
| `frontend/` | Vite + React 19 + TypeScript, served by nginx | Upload, queue, job details, live progress |
| `backend/` | Express 5 + TypeScript | **BFF** (backend for frontend): the only API the browser talks to |
| `services/job-service/` | Spring Boot 4 / Java 17 | Owns jobs and chunks, plans work, tracks progress, triggers the merge |
| `services/media-service/` | Spring Boot 4 / Java 17 + FFmpeg | Stores, probes, streams, and merges video files |
| `services/interpolation-engine/` | Python + OpenCV + FFmpeg | Decodes a frame range, interpolates it (DIS optical flow or blend), encodes it |
| `infra/` | Docker Compose, PostgreSQL 16, RabbitMQ 4 | Runs the whole stack |

## System Overview

```mermaid
flowchart LR
    user(["Browser"])

    subgraph edge["Edge"]
        fe["frontend<br/>nginx :8080<br/>React app"]
    end

    subgraph bff_box["BFF"]
        bff["backend<br/>Express :5000"]
    end

    subgraph svc["Spring services"]
        job["job-service<br/>:8081"]
        media["media-service<br/>:8082"]
    end

    subgraph workers["Workers (scalable)"]
        eng1["interpolation-engine #1"]
        eng2["interpolation-engine #2"]
        engN["interpolation-engine #N"]
    end

    subgraph data["Data"]
        jobsdb[("jobs_db")]
        mediadb[("media_db")]
        vol[["/data volume<br/>uploads, chunks, outputs"]]
    end

    mq{{"RabbitMQ"}}

    user -- "HTTP + SSE" --> fe
    fe -- "/api proxy" --> bff
    bff -- "REST" --> job
    bff -- "REST (stream upload / download)" --> media
    job -- "REST (probe info, merge, cleanup)" --> media

    job --> jobsdb
    media --> mediadb
    media --> vol
    eng1 & eng2 & engN --> vol

    job -- "chunks / cancel" --> mq
    mq -- "chunk tasks" --> eng1 & eng2 & engN
    eng1 & eng2 & engN -- "progress / done / failed" --> mq
    mq -- "progress" --> job
    job -- "job.events" --> mq
    mq -- "job.events" --> bff
```

Key rules:

- The browser only ever reaches **nginx → BFF**. The Spring services and the engine are internal.
- **Database per service:** job-service owns `jobs_db`, media-service owns `media_db`. Neither reads the other's database.
- Video bytes live on a shared `/data` volume. Services pass **paths and IDs**, never file contents, over RabbitMQ.
- Engines are stateless. Add more with `--scale interpolation-engine=N`.

## End-to-End Flow

```mermaid
sequenceDiagram
    autonumber
    actor U as Browser
    participant N as nginx
    participant B as BFF
    participant M as media-service
    participant J as job-service
    participant Q as RabbitMQ
    participant E as Engine x N

    U->>N: POST /api/jobs?factor=4&mode=flow (multipart)
    N->>B: stream (no buffering)
    B->>B: validate factor/mode before upload
    B->>M: stream file to POST /media
    M->>M: save to /data, ffprobe (fps, frames, size, audio)
    M-->>B: MediaResponse {id, ...}
    B->>J: POST /jobs {sourceMediaId, factor, mode}
    J->>M: GET /media/{id}
    J->>J: plan frame-range chunks (CHUNK_SECONDS each)
    J->>J: save job + chunks (QUEUED)
    J->>Q: one ChunkTask per chunk → interp.chunks
    J->>Q: JobEvent → job.events
    J-->>B: JobResponse
    B-->>U: 201 Job created

    U->>B: GET /api/jobs/stream (SSE)

    par every idle replica takes one chunk (prefetch=1)
        Q->>E: ChunkTask
        E->>J: GET /jobs/{id} (still active?)
        E->>E: decode → interpolate → encode chunk_XXXXX.mp4
        E->>Q: PROGRESS ticks → interp.progress
        E->>Q: DONE {outputPath} → interp.progress
        E->>Q: ack chunk (only after DONE is published)
    end

    Q->>J: progress messages (single listener, in order)
    J->>J: update chunk + job progress (0-95%)
    J->>Q: JobEvent → job.events
    Q->>B: JobEvent
    B-->>U: SSE event (status, progress, chunks)

    Note over J: last chunk DONE → status MERGING
    J->>M: POST /media/merge {chunkPaths, sourceMediaId}
    M->>M: ffmpeg concat (no re-encode) + copy source audio
    M-->>J: output MediaResponse
    J->>J: COMPLETED, progress 100%
    J->>Q: JobEvent → job.events
    Q->>B: JobEvent
    B-->>U: SSE: completed

    U->>B: GET /api/jobs/{id}/download
    B->>J: GET /jobs/{id}
    B->>M: GET /media/{outputId}/content (Range passthrough)
    M-->>U: video stream (seekable, 206)
```

## RabbitMQ Topology

```mermaid
flowchart LR
    job["job-service"]
    bff["BFF"]
    e["engine replicas"]

    chunks[["interp.chunks<br/>durable work queue"]]
    dlx(["interp.dlx<br/>direct exchange"])
    dlq[["interp.chunks.dlq"]]
    progress[["interp.progress<br/>durable queue"]]
    cancel(["interp.cancel<br/>fanout"])
    events(["job.events<br/>fanout"])

    job -- "ChunkTask (persistent)" --> chunks
    chunks -- "one chunk per replica" --> e
    chunks -. "rejected twice" .-> dlx --> dlq

    e -- "PROGRESS / DONE / FAILED" --> progress
    progress -- "concurrency = 1" --> job

    job -- "{jobId}" --> cancel
    cancel -- "own exclusive queue per replica" --> e

    job -- "JobEvent" --> events
    events -- "own exclusive queue" --> bff
```

| Name | Type | From → To | Purpose |
| --- | --- | --- | --- |
| `interp.chunks` | queue | job-service → engines | One message per chunk. Work-queue: each chunk goes to exactly one replica. |
| `interp.chunks.dlq` | queue (via `interp.dlx`) | — | Chunks that failed twice. |
| `interp.progress` | queue | engines → job-service | Progress ticks, `DONE`, `FAILED`. |
| `interp.cancel` | fanout | job-service → every engine | Stop all chunks of a job within one frame pair. |
| `job.events` | fanout | job-service → BFF | Job changes relayed to browsers over SSE. |

## Inside the Engine

```mermaid
flowchart TB
    msg["ChunkTask<br/>startFrame, frameCount, factor, mode"] --> check{"job still active?<br/>not cancelled?"}
    check -- no --> skip["ack and skip"]
    check -- yes --> read["ffmpeg decode pipe<br/>frameCount + 1 frames<br/>(borrows next chunk's first frame)"]
    read --> pair["for each frame pair (A, B)"]
    pair --> cut{"scene cut?<br/>mean diff > threshold"}
    cut -- yes --> dup["repeat A, no warping"]
    cut -- no --> mode{"mode"}
    mode -- flow --> flow["DIS optical flow on downscaled copy<br/>(FLOW_MAX_SIDE), scale flow up,<br/>warp A and B to time t, blend"]
    mode -- blend --> blend["linear cross-fade A→B"]
    dup --> write
    flow --> write
    blend --> write
    write["ffmpeg encode pipe<br/>libx264, same preset/CRF for every chunk"] --> stop{"cancelled?"}
    stop -- yes --> cancelled["stop, ack"]
    stop -- no --> more{"more pairs?"}
    more -- yes --> pair
    more -- no --> done["publish DONE {outputPath}<br/>then ack"]
```

Chunks overlap by one frame so their boundaries are seamless: concatenating every chunk gives exactly
`(N - 1) × factor + 1` frames, the same as processing the whole video in one go (checked in `tests/test_pipeline.py`).

## Job Lifecycle

```mermaid
stateDiagram-v2
    [*] --> QUEUED: job created, chunks published
    QUEUED --> PROCESSING: first progress report
    PROCESSING --> MERGING: all chunks DONE (95%)
    MERGING --> COMPLETED: media-service merge OK (100%)

    QUEUED --> CANCELLED: user cancel
    PROCESSING --> CANCELLED: user cancel
    MERGING --> CANCELLED: user cancel

    PROCESSING --> FAILED: chunk failed twice
    MERGING --> FAILED: merge error

    COMPLETED --> [*]
    CANCELLED --> [*]
    FAILED --> [*]
```

Each chunk has its own small lifecycle: `PENDING → PROCESSING → COMPLETED` (or `FAILED`).
The job details page shows the chunk grid and which engine replica took each chunk.

## Reliability

- **Crash-safe chunks:** an engine acks a chunk only after its `DONE` report is published. If a replica dies mid-chunk, RabbitMQ redelivers it to another replica.
- **One retry:** a failing chunk is requeued once; the second failure reports `FAILED`, goes to the DLQ, and fails the job.
- **Ordered progress:** job-service consumes `interp.progress` with a single listener, so "was that the last chunk?" can't race. Duplicate or late messages are ignored.
- **Optimistic locking:** cancel and progress updates retry if they collide on the same job row.
- **Cleanup:** cancel/fail/delete remove the job's work directory; if job creation fails, the BFF deletes the uploaded file.
- **Lossy where it's safe:** progress ticks and `job.events` are non-persistent; the UI refetches if one is lost.

## Public API (BFF)

All routes are under `/api` and served through nginx on port 8080.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Status of BFF, job-service, media-service and RabbitMQ (503 if any is down) |
| `POST` | `/api/jobs?factor=2..8&mode=flow\|blend` | Upload a video (`multipart/form-data`, field `file`) and create a job |
| `GET` | `/api/jobs?limit=50&activeOnly=false` | List recent jobs |
| `GET` | `/api/jobs/stream` | Server-Sent Events stream of job changes |
| `GET` | `/api/jobs/{job_id}` | Job details with per-chunk progress |
| `GET` | `/api/jobs/{job_id}/download` | Stream the output video (supports `Range`; add `?attachment=1` to download) |
| `PATCH` | `/api/jobs/{job_id}/cancel` | Cancel a queued/processing/merging job |
| `DELETE` | `/api/jobs/{job_id}` | Delete a job and its files |

Internal service APIs (not reachable from the browser):

- **job-service** `:8081` — `POST /jobs`, `GET /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/chunks`, `POST /jobs/{id}/cancel`, `DELETE /jobs/{id}`
- **media-service** `:8082` — `POST /media`, `GET /media/{id}`, `GET /media/{id}/content`, `POST /media/merge`, `DELETE /media/{id}`, `DELETE /media/workdirs/{jobId}`

## Quick Start

From the project root:

```bash
docker compose -f infra/docker-compose.yml up --build
```

Run more engine replicas to process more chunks in parallel:

```bash
docker compose -f infra/docker-compose.yml up -d --scale interpolation-engine=4
```

| URL | What |
| --- | --- |
| http://localhost:8080 | App |
| http://localhost:5000/api/health | BFF health |
| http://localhost:15672 | RabbitMQ management (guest / guest) |

### Frontend dev server

With the stack running, the BFF is exposed on `:5000`, so you can run the frontend with hot reload:

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Configuration

| Service | Variable | Default | Meaning |
| --- | --- | --- | --- |
| job-service | `CHUNK_SECONDS` | `2` | Seconds of source video per chunk |
| job-service, media-service | `DB_URL` | see compose | JDBC URL for its own database |
| job-service, media-service | `FILE_ROOT` | `/data` | Shared storage root |
| engine | `FLOW_PRESET` | `medium` | DIS preset: `ultrafast`, `fast`, `medium` |
| engine | `FLOW_MAX_SIDE` | `640` | Longest side used for flow estimation |
| engine | `SCENE_CUT_THRESHOLD` | `40` | Mean frame difference treated as a cut |
| engine | `X264_PRESET` / `X264_CRF` | `veryfast` / `18` | Chunk encoder settings (must match across chunks) |
| engine | `PROGRESS_INTERVAL` | `0.5` | Seconds between progress reports |
| BFF | `CORS_ORIGIN` | `http://localhost:8080,http://localhost:5173` | Allowed origins |

Postgres runs one instance with two databases, `jobs_db` and `media_db` (user `app` / password `app`), created by `infra/postgres/init-databases.sql`.

## Why It's Fast and Lightweight

- **CPU only:** no GPU, no model weights, no inference runtime.
- **Parallel by chunk:** throughput scales roughly with the number of engine replicas.
- **Flow on a small copy:** motion is estimated at ≤640 px and scaled up; the warp still uses full-resolution pixels.
- **Streaming everywhere:** uploads stream nginx → BFF → media-service; frames stream through ffmpeg pipes; downloads stream with Range support.
- **No re-encode on merge:** chunks are joined with ffmpeg's concat demuxer.
