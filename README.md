# CFactory Image Processor

A full-stack web application that accepts image uploads, delegates processing to a background worker, and allows users to download the result once the job is complete.

Built with **React + Vite + Tailwind CSS** (frontend), **Express + TypeScript** (backend), **BullMQ + Redis** (job queue), and **Docker Compose** for single-command orchestration.

---

## Architecture Overview

```
Browser (React)
    │
    │  POST /api/images/upload
    ▼
Express Server (backend)
    │  creates job in Redis
    │  enqueues job to BullMQ
    │  returns { jobId } immediately ← does NOT wait for processing
    │
    │  GET /api/images/status/:id
    │  GET /api/images/download/:id
    │
BullMQ Queue (Redis)
    │
    ▼
Worker Process (separate container)
    │  dequeues job
    │  resizes → compresses → converts to WebP (via sharp)
    │  updates job status in Redis
```

**Job lifecycle:** `pending` → `processing` → `completed` / `failed`

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Clone the repository

```bash
git clone https://github.com/Aufadholi/ImgProcessing.git
cd ImgProcessing
```

### 2. Create environment files

**Backend:**
```bash
cp backend/.env.example backend/.env
```

**Frontend:**
```bash
cp frontend/.env.example frontend/.env
```

> For local development (without Docker), change `REDIS_HOST=localhost` in `backend/.env`.

### 3. Run with Docker Compose

```bash
docker compose up --build
```

This starts **4 services** in the correct order:

| Service    | Description                          | Port  |
|------------|--------------------------------------|-------|
| `redis`    | Redis 7 — job queue & state store    | 6379  |
| `backend`  | Express API server                   | 3001  |
| `worker`   | BullMQ worker — processes images     | —     |
| `frontend` | React app served by Nginx            | 5173  |

Open your browser at **http://localhost:5173**

---

## API Endpoints

| Method | Endpoint                         | Description                      |
|--------|----------------------------------|----------------------------------|
| `GET`  | `/health`                        | Health check                     |
| `POST` | `/api/images/upload`             | Upload image, returns `jobId`    |
| `GET`  | `/api/images/status/:id`         | Poll job status by `jobId`       |
| `GET`  | `/api/images/download/:id`       | Download processed WebP image    |
| `GET`  | `/api/images/original/:id`       | Serve original uploaded image (for comparison UI) |

**Upload request:** `multipart/form-data`, field name `image`, max 20MB, formats: JPG / PNG / WebP.

**Status response example:**
```json
{
  "jobId": "8de5167e-7738-4468-afe0-61276eec2f8b",
  "status": "completed",
  "originalFile": "1749601234-523847123.png",
  "processedFile": "8de5167e-7738-4468-afe0-61276eec2f8b.webp"
}
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable      | Default                   | Description                                              |
|---------------|---------------------------|----------------------------------------------------------|
| `PORT`        | `3001`                    | Port the Express server listens on                       |
| `REDIS_HOST`  | `redis` (Docker) / `localhost` (local dev) | Redis hostname — use `redis` inside Docker Compose network |
| `REDIS_PORT`  | `6379`                    | Redis port                                               |
| `CORS_ORIGIN` | `http://localhost:5173`   | Allowed CORS origin (must match frontend URL)            |

### Frontend (`frontend/.env`)

| Variable       | Default                  | Description                                                                 |
|----------------|--------------------------|-----------------------------------------------------------------------------|
| `VITE_API_URL` | `http://localhost:3001`  | Backend base URL. Always points to `localhost` — accessed from the browser, not from inside Docker |

---

## Local Development (without Docker)

Requires Redis running locally (`redis-server` or via Docker: `docker run -p 6379:6379 redis:7-alpine`).

```bash
# Terminal 1 — Backend server
cd backend
npm install
npm run dev

# Terminal 2 — Background worker
cd backend
npm run worker

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev
```

---

## Image Processing Pipeline

The background worker processes images in this exact order:

1. **Resize** — to a maximum of 1280px on the longest side, preserving aspect ratio (`fit: "inside"`, no upscaling)
2. **Compress** — to 80% quality
3. **Convert** — to WebP format

Processed files are stored in `backend/processed/` and shared between the `backend` and `worker` containers via a Docker named volume.

---

## Architectural Decisions

### Why BullMQ + Redis (not in-memory Map or database polling)?

The initial implementation stored job state in an in-memory `Map`. This breaks the moment **server and worker run in separate processes** (as they do in Docker), because each process has its own memory — there is no way for the server to read what the worker wrote.

Redis solves this: it is a **shared, external state store** accessible by any process or container that knows the Redis host. BullMQ adds a reliable queue on top of Redis with:
- **Automatic retries** if the worker crashes mid-job
- **Job deduplication** and visibility guarantees
- **Exponential backoff** support out of the box

Alternative approaches like polling a SQL/NoSQL database would also work, but BullMQ + Redis is purpose-built for this pattern (queue + ephemeral state) and adds no schema overhead.

### Why are server and worker separated into different processes?

The Express server's job is to **respond fast**. Image processing (resize, compress, encode) is CPU-intensive and can take several seconds. If the server did the processing synchronously, every upload request would block the event loop and make the API unresponsive for all other users.

Separating the worker into its own process means:
- The server returns `{ jobId }` **immediately** (< 50ms) — the user is not left waiting
- The worker runs in isolation — a crash in the worker does not take down the API server
- In production, you can scale workers independently (run 4 workers, 1 server)

In Docker Compose, this is reflected as two separate services (`backend` and `worker`) built from the same image but started with different commands:
- `backend` → `node dist/server.js`
- `worker` → `node dist/workers/imageWorker.js`

### Why named volumes instead of bind mounts?

The `uploads/` and `processed/` directories must be **shared between two containers** (`backend` writes uploads, `worker` reads them; `worker` writes processed files, `backend` serves them for download).

Docker **named volumes** (`uploads_data`, `processed_data`) are managed by Docker and guaranteed to exist independently of the container lifecycle:
- If a container restarts, the files are still there
- Both containers mount the same volume → same filesystem view
- No path dependency on the host OS (unlike bind mounts which require an absolute host path)

---

## Bonus Features Implemented

| Feature | Implementation |
|---|---|
| ✅ Docker Compose — single command for full stack | `docker compose up --build` runs all 4 services |
| ✅ Graceful worker failure handling | `try/catch` in worker updates status to `failed` + stores `errorMessage` in Redis; BullMQ `worker.on("failed")` logs the error; job is re-thrown so BullMQ marks it failed |
| ✅ Efficient polling — exponential backoff | Frontend polls at 1s → 2s → 4s → 8s → 16s (max). Stops immediately when status is `completed` or `failed` |
| ✅ Premium UI / UX | Cosmic-themed glassmorphism interface with animated radar background using CFactory brand colors (Purple/Yellow/Red) |
| ✅ Interactive Image Comparison | Drag-to-reveal before/after slider once processing completes (original vs WebP) |
| ✅ Instant Local Preview | `URL.createObjectURL` for immediate image preview before upload |
| ✅ Architectural decisions documented | See section above |

---

## Project Structure

```
img-processing-web/
├── backend/
│   ├── src/
│   │   ├── app.ts                  # Express app setup, CORS, routes
│   │   ├── server.ts               # HTTP server entry point
│   │   ├── config/
│   │   │   └── redis.ts            # Redis connection config (env-aware)
│   │   ├── controllers/
│   │   │   └── imageControllers.ts # Upload, status, download handlers
│   │   ├── middleware/
│   │   │   └── uploadMiddleware.ts # Multer config (type/size validation)
│   │   ├── queues/
│   │   │   └── imageQueue.ts       # BullMQ queue definition
│   │   ├── routes/
│   │   │   └── imageRoutes.ts      # Route declarations
│   │   ├── services/
│   │   │   ├── imageProcessor.ts   # sharp: resize → compress → WebP
│   │   │   └── jobService.ts       # Redis CRUD for job state
│   │   ├── types/
│   │   │   └── job.ts              # Job type definition
│   │   └── workers/
│   │       └── imageWorker.ts      # BullMQ worker process
│   ├── .env.example
│   ├── Dockerfile
│   └── tsconfig.json               # strict: true
│
├── frontend/
│   ├── src/
│   │   ├── api.ts                  # fetch wrappers for all endpoints
│   │   ├── App.tsx                 # Main UI (upload → poll → download)
│   │   ├── components/             # UI Components (Slider, Background)
│   │   │   ├── BackgroundCircles.tsx
│   │   │   └── ImageComparisonSlider.tsx
│   │   ├── hooks/
│   │   │   └── useJobPolling.ts    # Exponential backoff polling hook
│   │   └── index.css               # Tailwind directives
│   ├── nginx.conf                  # SPA routing + gzip + asset caching
│   ├── .env.example
│   └── Dockerfile                  # Multi-stage: Node (build) → Nginx (serve)
│
├── docker-compose.yaml             # 4 services: redis, backend, worker, frontend
├── .gitignore
└── README.md
```
