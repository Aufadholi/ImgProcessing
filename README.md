# Image Processor

A full-stack web application that accepts image uploads, processes them in the background, and lets users download the result as a much smaller **WebP** file.

Built with **React + Vite** (frontend), **Express + TypeScript** (backend), **BullMQ + Redis** (job queue), and **Docker Compose** for single-command orchestration.

---

## What Does This App Do?

Imagine you have a large photo (e.g. a 5 MB PNG). This app will:

1. **Accept the upload** from your browser
2. **Queue the processing job** to a background worker (without blocking the server)
3. **Process the image** — resize to max 1280px, compress, and convert to WebP
4. **Show a before/after comparison** (drag slider) along with a **file size comparison** (e.g. 5 MB → 0.07 MB, 97% smaller)
5. **Provide a download button** to save the resulting WebP file

---

## System Architecture

```
Browser (React)
    │
    │  1. POST /api/images/upload  → server responds immediately with jobId
    ▼                                 (does NOT wait for processing to finish)
Express Server (backend)
    │  2. Save job info to Redis (status: "pending", originalSize)
    │  3. Enqueue job to BullMQ
    │
    │  4. GET /api/images/status/:id  ← browser polls every few seconds
    │  5. GET /api/images/download/:id
    │  6. GET /api/images/original/:id
    │
BullMQ Queue (stored in Redis)
    │
    ▼
Worker Process (separate container)
    │  7. Dequeue job from BullMQ
    │  8. Read file from uploads/ volume
    │  9. Process: resize → compress → convert to WebP (using sharp)
    │  10. Save result to processed/ volume
    │  11. Update job status in Redis → "completed" + processedSize
```

**Job lifecycle:** `pending` → `processing` → `completed` / `failed`

### Why 4 separate containers?

| Container  | Responsibility                                              |
|------------|-------------------------------------------------------------|
| `redis`    | Shared store for job state and the BullMQ queue             |
| `backend`  | Handles browser requests, reads/writes job state            |
| `worker`   | Dedicated image processing in the background                |
| `frontend` | Serves the React app via Nginx                              |

The server (`backend`) and the image processor (`worker`) are separated so the server stays fast and responsive — image processing can take several seconds and must never block the server.

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

This starts **4 services** in the correct dependency order:

| Service    | Description                                    | Port  |
|------------|------------------------------------------------|-------|
| `redis`    | Redis 7 — job queue & state store              | 6379  |
| `backend`  | Express API server                             | 3001  |
| `worker`   | BullMQ worker — processes images               | —     |
| `frontend` | React app served by Nginx                      | 5173  |

Open your browser at **http://localhost:5173**

---

## Full Workflow — Step by Step

### Step 1: User uploads an image

- The user selects or drags-and-drops an image (JPG / PNG / WebP, max 20 MB)
- The browser shows an **instant local preview** using `URL.createObjectURL` — the image appears before the upload even starts
- The user clicks **"Upload & Process"**

### Step 2: Server receives the upload

- The backend receives the file via `multipart/form-data`
- The Multer middleware validates file type and size
- The server creates a job entry in Redis:
  ```json
  {
    "jobId": "...",
    "status": "pending",
    "originalFile": "...",
    "originalSize": 2599282
  }
  ```
- The server immediately responds with `{ jobId }` — **without waiting** for processing to finish

### Step 3: Frontend starts polling

- Once the `jobId` is received, the frontend **polls the status** endpoint periodically
- The polling interval uses **exponential backoff**: 1s → 2s → 4s → 8s → 16s (max)
- Polling **stops automatically** when the status is `completed` or `failed`

### Step 4: Worker processes the image

Inside the separate `worker` container:

1. Dequeue the job from BullMQ
2. Update job status in Redis → `"processing"`
3. Read the file from `/app/uploads/`
4. Process using **sharp**:
   - Resize to max 1280×1280px (aspect ratio preserved, no upscaling for small images)
   - Compress at 80% quality
   - Convert to WebP format
5. Save the result to `/app/processed/<jobId>.webp`
6. Update job status in Redis → `"completed"` + store `processedSize`

### Step 5: Displaying the result

When polling detects `status: "completed"`, the full job data is **immediately snapshot into a `finalJob` state** before the UI transitions to the result screen. This prevents data from being lost due to React re-render timing.

The result screen shows:
- **Status badge** (Completed / Failed)
- **Image comparison slider** — drag to reveal original vs. WebP side by side
- **File size comparison**:
  ```
  Original: 2.48 MB  →  WebP: 0.07 MB  [-97%]
  ```
- **Download button** for the processed WebP file

---

## API Endpoints

| Method | Endpoint                         | Description                                            |
|--------|----------------------------------|--------------------------------------------------------|
| `GET`  | `/health`                        | Server health check                                    |
| `POST` | `/api/images/upload`             | Upload an image, returns `jobId`                       |
| `GET`  | `/api/images/status/:id`         | Poll job status by `jobId`                             |
| `GET`  | `/api/images/download/:id`       | Download the processed WebP image                      |
| `GET`  | `/api/images/original/:id`       | Serve the original uploaded image (for comparison UI)  |

**Upload request:** `multipart/form-data`, field name `image`, max 20 MB, formats: JPG / PNG / WebP.

**Example status response (completed job):**
```json
{
  "jobId": "4eb44926-5ccb-4dd6-b29c-8155278e164f",
  "status": "completed",
  "originalFile": "1781159862722-333196493.png",
  "processedFile": "4eb44926-5ccb-4dd6-b29c-8155278e164f.webp",
  "originalSize": 2599282,
  "processedSize": 69858
}
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable      | Default                                 | Description                                                             |
|---------------|-----------------------------------------|-------------------------------------------------------------------------|
| `PORT`        | `3001`                                  | Port the Express server listens on                                      |
| `REDIS_HOST`  | `redis` (Docker) / `localhost` (dev)    | Redis hostname — use `redis` inside the Docker Compose network          |
| `REDIS_PORT`  | `6379`                                  | Redis port                                                              |
| `CORS_ORIGIN` | `http://localhost:5173`              | Allowed CORS origin (must match the frontend URL)                       |

### Frontend (`frontend/.env`)

| Variable       | Default                  | Description                                                                                      |
|----------------|--------------------------|--------------------------------------------------------------------------------------------------|
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

## Running E2E Tests

End-to-end tests use **Playwright** (Chromium) and run against the live Docker stack.
All 3 tests pass in ~2 seconds once the stack is up.

### Prerequisites

The Docker stack must be running before you start the tests:

```bash
docker compose up -d
```

### Setup and run

```bash
cd e2e
npm install
npx playwright install chromium  # one-time: downloads the Chromium binary
npm test
```

> To watch the browser while tests run, open `e2e/playwright.config.ts` and set `headless: false`.

### What is tested

| Test | What it verifies |
|---|---|
| **Happy path** | Upload a real PNG → worker processes it → "Selesai" badge and Download button appear |
| **Format validation** | Uploading a `.txt` file shows the format error and disables the upload button |
| **Size validation** | Uploading a file > 20 MB shows the size error and disables the upload button |

### Notable implementation details

- **`{ force: true }` on click** — The upload button lives inside a `div` with `animation: floatCard infinite`. Playwright considers continuously moving elements "not stable" and refuses to click them. `force: true` bypasses this stability check.
- **Two-step assertion for the happy path** — The test first waits for *either* `selesai` or `gagal` to appear (fast termination on failure), then asserts it is specifically `selesai`. This avoids a silent 60-second timeout if the job fails.
- **PNG fixture from sharp** — The test PNG is embedded as a base64 string produced by the real `sharp` library (run inside the backend Docker container). Hand-crafted PNG hex is error-prone because every chunk requires an exact CRC-32 checksum; an invalid PNG causes the worker to fail the job instead of completing it.

---

## Image Processing Pipeline

The background worker processes images in this exact order using the **sharp** library:

1. **Resize** — to a maximum of 1280px on the longest side, preserving aspect ratio (`fit: "inside"`, no upscaling if the image is already smaller)
2. **Compress** — at 80% quality
3. **Convert** — to WebP format

Processed files are stored in `backend/processed/` and shared between the `backend` and `worker` containers via Docker named volumes.

---

## Architectural Decisions

### Why BullMQ + Redis (not an in-memory Map or database polling)?

The initial implementation stored job state in an in-memory JavaScript `Map`. This breaks the moment **the server and worker run as separate processes** (as they do in Docker), because each process has its own memory space — what the worker writes is invisible to the server.

Redis solves this: it is a **shared, external state store** accessible by any process or container that knows the Redis host. BullMQ adds a reliable queue on top of Redis with:
- **Automatic retries** if the worker crashes mid-job
- **Job visibility guarantees** (no job silently disappears)
- **Exponential backoff** support out of the box

### Why are the server and worker separated into different processes?

The Express server's job is to **respond fast**. Image processing (resize, compress, encode) is CPU-intensive and can take several seconds. If the server did the processing synchronously, every upload request would block the event loop and make the API unresponsive for all other users.

Separating the worker means:
- The server returns `{ jobId }` **immediately** (< 50ms) — the user is never left waiting
- A worker crash does not take down the API server
- In production, workers can be scaled independently (e.g. 4 workers, 1 server)

In Docker Compose, this is reflected as two separate services (`backend` and `worker`) built from the same image but started with different commands:
- `backend` → `node dist/server.js`
- `worker` → `node dist/workers/imageWorker.js`

### Why named volumes instead of bind mounts?

The `uploads/` and `processed/` directories must be **shared between two containers** (`backend` writes uploads, `worker` reads them; `worker` writes processed files, `backend` serves them for download).

Docker **named volumes** (`uploads_data`, `processed_data`) are managed by Docker and exist independently of the container lifecycle:
- If a container restarts, the files are still there
- Both containers mount the same volume → same filesystem view
- No dependency on a specific host OS path (unlike bind mounts)

### Why use a `finalJob` state snapshot in the frontend?

When polling detects a `"completed"` job, the full job data (including `originalSize` and `processedSize`) is snapshot into a dedicated `finalJob` state before `appState` transitions to `"done"`. This matters because:

- When `appState` changes, the `useJobPolling` hook stops receiving a `jobId`
- Without the snapshot, React can reset the `job` state from the hook back to `null` during re-render
- `finalJob` guarantees that the file size comparison data is always available on the result screen, immune to re-render timing issues

---

## Features Implemented

| Feature | Implementation |
|---|---|
| ✅ Docker Compose — single command for full stack | `docker compose up --build` runs all 4 services |
| ✅ Graceful worker failure handling | `try/catch` in worker updates status to `"failed"` + stores `errorMessage` in Redis |
| ✅ Efficient polling — exponential backoff | Frontend polls at 1s → 2s → 4s → 8s → 16s (max). Stops when `completed` or `failed` |
| ✅ Safe state snapshot (`finalJob`) | Prevents `originalSize`/`processedSize` from being lost due to React re-render timing |
| ✅ Premium UI / Cosmic Theme | Glassmorphism interface with animated starfield background and CFactory brand colors |
| ✅ Interactive image comparison slider | Drag to reveal original vs. WebP after processing completes |
| ✅ File size comparison | Displays original size, WebP size, and percentage saved |
| ✅ Instant local preview | `URL.createObjectURL` for immediate image preview before upload |
| ✅ Playwright E2E tests | 3 tests: happy path, format validation, size validation — all passing |
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
│   │   │   └── imageControllers.ts # Handlers: upload, status, download, original
│   │   ├── middleware/
│   │   │   └── uploadMiddleware.ts # Multer config (type & size validation)
│   │   ├── queues/
│   │   │   └── imageQueue.ts       # BullMQ queue definition
│   │   ├── routes/
│   │   │   └── imageRoutes.ts      # Route declarations
│   │   ├── services/
│   │   │   ├── imageProcessor.ts   # sharp: resize → compress → WebP
│   │   │   └── jobService.ts       # Redis CRUD for job state
│   │   ├── types/
│   │   │   └── job.ts              # Job type (jobId, status, originalSize, processedSize, etc.)
│   │   └── workers/
│   │       └── imageWorker.ts      # BullMQ worker process
│   ├── .env.example
│   ├── Dockerfile
│   └── tsconfig.json               # strict: true
│
├── frontend/
│   ├── index.html                  # HTML entry point, title: "Image Processing"
│   ├── src/
│   │   ├── api.ts                  # Fetch wrappers for all API endpoints
│   │   ├── App.tsx                 # Main UI: upload → polling → result display
│   │   │                           # (uses finalJob snapshot for reliable result data)
│   │   ├── components/
│   │   │   ├── BackgroundCircles.tsx      # Animated concentric circles behind the card
│   │   │   └── ImageComparisonSlider.tsx  # Drag-to-reveal before/after slider
│   │   ├── hooks/
│   │   │   └── useJobPolling.ts    # Polling hook with exponential backoff
│   │   └── index.css               # Global CSS + starfield animation
│   ├── nginx.conf                  # SPA routing + gzip + asset caching
│   ├── .env.example
│   └── Dockerfile                  # Multi-stage: Node (build) → Nginx (serve)
│
├── e2e/
│   ├── tests/
│   │   ├── fixtures/               # Auto-generated test assets (gitignored)
│   │   │   ├── test.png            # Valid 100×100 PNG (base64 from sharp)
│   │   │   └── large.png           # 21 MB dummy file for size validation
│   │   └── upload.spec.ts          # 3 Playwright tests: happy path, format, size
│   ├── playwright.config.ts        # baseURL: localhost:5173, timeout: 60s, Chromium
│   ├── tsconfig.json               # TypeScript config for e2e workspace
│   └── package.json                # @playwright/test + @types/node
│
├── docker-compose.yaml             # 4 services: redis, backend, worker, frontend
├── .gitignore
└── README.md
```
