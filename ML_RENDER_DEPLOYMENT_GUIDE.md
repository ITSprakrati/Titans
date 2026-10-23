# SportGuard AI — Python ML Backend Render Deployment Guide (For Claude)

> [!IMPORTANT]
> This guide provides repository-specific deployment instructions, contracts, and resource requirements for deploying the SportGuard AI Python ML backend to Render. Antigravity has audited the codebase and prepared the Node.js integration; Claude is responsible for executing and verifying the Render Python deployment.

---

## 1. Python Entrypoint and Framework

- **Framework**: FastAPI (`fastapi==0.115.6`, `uvicorn==0.34.0`, `pydantic>=2.11.0`)
- **Main Entrypoint File**: `Backend/main.py`
- **Application Instance**: `app = FastAPI(title="VideoGuard AI ML API")`
- **Startup Command**:
  ```bash
  python -m uvicorn main:app --host 0.0.0.0 --port $PORT
  ```
- **Execution Script**: `Backend/entrypoint.sh` (handles model downloads on startup before invoking `python main.py`)
- **Container Build**: `Backend/Dockerfile.fastapi`

---

## 2. Health-Check Route

- **HTTP Method**: `GET`
- **Route**: `/`
- **Response Format**:
  ```json
  {
    "status": "ok",
    "service": "VideoGuard AI ML Engine",
    "version": "1.0.0"
  }
  ```
- **Status Code**: `200 OK`
- **Render Health Check Path**: Set to `/` in Render service settings.
- **Node.js Integration**: The Node.js server (`server/app.js`) checks `${FASTAPI_URL}/` inside its `/api/health` check and its 14-minute keepalive ping.

---

## 3. Actual Python Endpoints Called by Node.js

The Node.js orchestrator calls the following FastAPI endpoints:

| Node.js Caller | Method | FastAPI Route | Timeout Setting | Purpose |
|---|---|---|---|---|
| `controllers/archivistController.js` | POST | `/ingest` | 30 minutes (`30 * 60 * 1000`) | Asynchronous reference video download, frame extraction & FAISS embedding |
| `controllers/archivistController.js` | GET | `/ingest/status/{job_id}` | Polled every 2s-8s (max 35 min) | Status check for active ingestion job |
| `controllers/swarmController.js` | POST | `/hunt` | 5 minutes (`5 * 60_000`) | Phase 1: Spider multi-platform web crawler |
| `routes/hunt.js` | POST | `/hunt` | 5 minutes (`300_000`) | Standalone Spider hunt trigger |
| `controllers/sentinelController.js` | POST | `/scan` | 60 seconds (`60_000`) | Single suspect scan |
| `controllers/sentinelController.js` | POST | `/scan/batch` | 60 seconds (`60_000`) | Phase 2: Parallel thumbnail scan on threat nodes |
| `controllers/swarmController.js` | POST | `/scan/batch` | 5 minutes (`5 * 60_000`) | Phase 2: Parallel thumbnail scan in Swarm |
| `controllers/swarmController.js` | POST | `/scan/full` | 90 seconds (`90_000`) per suspect | Phase 2b: Full multi-frame download & deep scan (top 5 suspects) |
| `controllers/adjudicatorController.js` | POST | `/adjudicate` | 120 seconds (`120_000`) | Legal infringement adjudication via LLM |
| `controllers/swarmController.js` | POST | `/adjudicate` | 180 seconds (`180_000`) | Phase 3: Swarm adjudication |
| `controllers/adjudicatorController.js` | POST | `/adjudicate/batch` | 120 seconds (`120_000`) | Batch adjudication |
| `controllers/enforcerController.js` | POST | `/enforce` | 120 seconds (`120_000`) | DMCA takedown drafting with cryptographic proof |
| `controllers/swarmController.js` | POST | `/enforce` | 180 seconds (`180_000`) | Phase 4: Swarm DMCA drafting |
| `controllers/brokerController.js` | POST | `/broker` | 120 seconds (`120_000`) | Revenue-sharing contract generation |
| `controllers/swarmController.js` | POST | `/broker` | 180 seconds (`180_000`) | Phase 5: Swarm contract minting |
| `controllers/swarmController.js` | POST | `/evidence/{incident_id}/package_detection` | Non-blocking / fire-and-forget | Packaging detection artifacts into evidence vault |
| `routes/evidence.js` | GET | `/evidence/{incident_id}` | 60 seconds | Evidence bundle summary |
| `routes/evidence.js` | GET | `/evidence/{incident_id}/custody` | 60 seconds | Chain-of-custody verification |
| `routes/evidence.js` | POST | `/evidence/{incident_id}/export` | 60 seconds | ZIP bundle export |
| `routes/evidence.js` | POST | `/evidence/{incident_id}/sync` | 60 seconds | Backup artifacts to GCS |
| `routes/leak.js` | POST | `/leak/analyze` | 60 seconds | Forensics leak source reconstruction |
| `routes/leak.js` | POST | `/leak/batch` | 60 seconds | Batch leak analysis |
| `routes/stream.js` | POST | `/stream/start` | 30 seconds | Start background live stream monitor |
| `routes/stream.js` | DELETE | `/stream/{stream_id}` | 30 seconds | Stop live stream monitor |
| `routes/stream.js` | GET | `/stream/active` | 30 seconds | List active live stream monitors |
| `routes/stream.js` | GET | `/stream/{stream_id}/results` | 30 seconds | Retrieve live stream detection results |
| `routes/watchdog.js` | GET | `/watchdog/status` | 30 seconds | Watchdog status |
| `routes/watchdog.js` | POST | `/watchdog/trigger` | 30 seconds | Trigger immediate watchdog scan |
| `routes/watchdog.js` | GET | `/watchdog/history` | 30 seconds | Watchdog detection history |
| `routes/watchdog.js` | POST | `/watchdog/stop` | 30 seconds | Stop watchdog thread |
| `routes/watchdog.js` | POST | `/watchdog/start` | 30 seconds | Start watchdog thread |

---

## 4. Request and Response Schemas

### `/ingest`
- **Request Body**:
  ```json
  {
    "official_video_url": "https://example.com/match.mp4",
    "job_id": "uuid-string",
    "video_title": "Sports Match QF"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "job_id": "uuid-string",
    "status": "downloading",
    "message": "Ingest started. Poll /ingest/status/{job_id} for progress."
  }
  ```

### `/ingest/status/{job_id}`
- **Response (when complete)**:
  ```json
  {
    "success": true,
    "job_id": "uuid-string",
    "status": "complete",
    "title": "Sports Match QF",
    "local_path": "/app/assets/official/uuid.mp4",
    "frame_count": 42,
    "vault_size": 42,
    "tx_hash": "0x...",
    "message": "[SUCCESS] Scene-aware ingest complete..."
  }
  ```

### `/scan`
- **Request Body**:
  ```json
  {
    "thumbnail_url": "https://i.ytimg.com/vi/xyz/maxresdefault.jpg",
    "account_handle": "suspect_user",
    "platform": "YouTube",
    "title": "Match Highlights",
    "url": "https://youtube.com/watch?v=xyz",
    "country": "US"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "match_confirmed": true,
    "confidence_score": 92.5,
    "clip_confidence": 94.0,
    "clip_similarity": 0.88,
    "phash_match": true,
    "severity": "CRITICAL",
    "top_matches": [
      {
        "vault_index": 12,
        "similarity": 0.88,
        "source_video": "match.mp4",
        "timestamp_sec": 14.0
      }
    ]
  }
  ```

---

## 5. Dependency and Runtime Files

- **Python Version**: Python 3.11 (Render standard) or Python 3.10+
- **Requirements**: `Backend/requirements.txt`
  - Critical packages: `fastapi==0.115.6`, `uvicorn==0.34.0`, `torch` (CPU), `transformers==4.47.1`, `faiss-cpu==1.15.1`, `opencv-python-headless==4.10.0.84`, `yt-dlp==2024.12.23`, `imageio-ffmpeg==0.5.1`
- **System Packages (Linux / Docker)**:
  - `ffmpeg` (required by yt-dlp & audio fingerprinting)
  - `libgl1`, `libglib2.0-0` (required by OpenCV headless)
  - `curl`

---

## 6. Model Requirements and Memory Management

### Render 512MB RAM Constraints
1. **CLIP ViT-B/32**:
   - PyTorch FP16: ~175MB RAM.
   - ONNX Runtime (`clip_vision.onnx`): ~60ms inference, significantly lower peak memory.
   - Script to pre-export ONNX: `Backend/export_clip_onnx.py`.
2. **Forensics SND Model (`best.pth`)**:
   - Model size: ~1.12GB.
   - Handled via `Backend/download_models.py` or `Backend/entrypoint.sh`.
   - Downloaded from Google Drive or GCS. If unavailable, `agents/forensics.py` has a heuristic fallback.

---

## 7. Required Environment Variables for Python ML Service

| Variable | Required? | Recommended Render Setting | Purpose |
|---|---|---|---|
| `PORT` | Auto by Render | `8001` or let Render set `$PORT` | FastAPI listening port |
| `GEMINI_API_KEY` | Optional | Set valid Google AI Studio key | Used by `Adjudicator` for legal rulings |
| `GROQ_API_KEY` | Optional | Set valid Groq key | Fallback LLM provider for legal rulings |
| `INGEST_SAMPLE_SEC` | Recommended | `1.0` | Frame seek-sampling interval (1s ensures short sports clips are captured) |
| `CLIP_BATCH_SIZE` | Recommended | `4` | Prevents RAM spikes during batch frame embedding |
| `WATCHDOG_ENABLED` | Optional | `false` on 512MB Render (or `true` if >=1GB) | Disable background polling thread to save CPU/RAM |
| `YOUTUBE_COOKIES_B64` | Optional | Base64-encoded Netscape cookie file | Bypasses YouTube bot detection on cloud datacenter IPs |
| `APIFY_API_TOKEN` | Optional | Apify API token | Alternative proxy downloader for YouTube if IP is blocked |

---

## 8. Storage and File Dependencies

- **Local Storage**:
  - `Backend/vault/`: Stores `faiss_vault.index`, `vault_metadata.json`, and `temporal_signatures.json`.
  - `Backend/assets/official/`: Stores downloaded reference video clips during ingestion.
  - OS temp directory (`mediaguard_jobs/`): Persistent JSON job store for async status tracking.
- **Render Ephemeral Disk Note**: On Render free tier, disk is ephemeral; files in `vault/` reset on restart unless attached to a persistent disk or synchronized to GCS (`GCS_BUCKET_NAME`).

---

## 9. Required Node.js Integration Settings

Once Claude deploys the Python ML backend to Render:
1. In the **Node.js Render service**:
   Add or update the environment variable:
   ```env
   FASTAPI_URL=https://<claude-python-service-name>.onrender.com
   ```
2. Verify Node.js connection:
   Trigger `GET https://<node-service>.onrender.com/api/health`
   Expected response:
   ```json
   {
     "success": true,
     "node": "ok",
     "fastapi": true
   }
   ```

---

## 10. Verification Tests Post-Deployment

After deployment, Claude should run these curl commands against the deployed Python URL:

1. **Health Check**:
   ```bash
   curl -X GET "https://<python-service>.onrender.com/"
   # Expected: {"status": "ok", "service": "VideoGuard AI ML Engine", ...}
   ```
2. **Ingest Verification (Short Sample Clip)**:
   ```bash
   curl -X POST "https://<python-service>.onrender.com/ingest" \
     -H "Content-Type: application/json" \
     -d '{"official_video_url":"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4","job_id":"test-deploy-001","video_title":"Test Deploy Clip"}'
   # Expected: {"success": true, "job_id": "test-deploy-001", "status": "downloading"}
   ```
3. **Poll Ingest Status**:
   ```bash
   curl -X GET "https://<python-service>.onrender.com/ingest/status/test-deploy-001"
   # Wait ~15s, poll until status is "complete" with frame_count > 0
   ```
4. **Scan Verification**:
   ```bash
   curl -X POST "https://<python-service>.onrender.com/scan" \
     -H "Content-Type: application/json" \
     -d '{"thumbnail_url":"https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg","title":"Suspect Clip"}'
   # Expected: {"success": true, "confidence_score": ...}
   ```

---

## 11. Troubleshooting Common Deployment Failure Modes

| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| **Render Exit 137 (OOM)** | PyTorch CLIP or ONNX model exceeding 512MB RAM | Set `CLIP_BATCH_SIZE=2`, `WATCHDOG_ENABLED=false`, ensure `torch` loads in float16 or pre-warm ONNX |
| **Health Check Timeout (502 / 504 on startup)** | Heavy model downloading or importing synchronously during startup | Verify lazy model loading; ensure `_prewarm_clip` runs in background daemon thread |
| **yt-dlp 429 / Sign in to confirm** | Cloud IP blocked by YouTube bot protection | Provide `YOUTUBE_COOKIES_B64` or set `APIFY_API_TOKEN` |
| **OpenCV `libGL.so.1` missing error** | Missing graphics libraries in minimal container | Ensure `opencv-python-headless` is used (already in `requirements.txt`) or install `libgl1` |
| **Ingest fails with 0 frames** | Ingest interval too large for short clip | Ensure `INGEST_SAMPLE_SEC=1.0` (already patched in `archivist.py`) |
