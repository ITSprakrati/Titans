# SportGuard AI — Team Handoff & Backend Maintenance Guide

> **SportGuard AI: Detect. Verify. Protect.**  
> An autonomous multi-agent AI system designed to protect live sports broadcasts, athletic event footage, and copyrighted content.  
> It continuously monitors video streams, generates visual and acoustic fingerprints, verifies infringements under copyright law, and coordinates automated DMCA enforcement.

---

## 1. Live Production Deployments

| Component | Service Name | Live URL | Platform / Specification |
|---|---|---|---|
| **FastAPI ML Engine** | `sportguard-ml` | `https://sportguard-ml.onrender.com` | Render Web Service (Docker / Lite Mode, Free 512 MB tier) |
| **Node.js Express API** | `sportguard-api` | `https://sportguard-api.onrender.com` | Render Web Service (Node.js runtime, Free tier) |
| **Frontend Web App** | `sportguard-web` | `https://sportguard-web.onrender.com` | Render Static Site (React + Vite build) |

> **Note on Free Tier Sleeping:** Render free tier instances sleep after 15 minutes of inactivity. Cold start requests can take 45–60 seconds. A built-in keepalive ping runs between the Node server and the ML engine every 10 minutes while the API is awake.

---

## 2. What Is Complete & Operational

1. **Python ML Lite Mode (Render 512 MB Compliant)**:
   - Quantized CLIP ViT-B/32 vision model to Int8 ONNX (`Backend/clip_vision_int8.onnx`, 85.15 MB, cosine similarity > 0.988 vs original FP32).
   - Eliminated PyTorch, torchvision, and HuggingFace transformers from the runtime path in `LITE_MODE=true`.
   - Pure NumPy/Pillow preprocessing (shortest-side resize, center crop, bicubic interpolation, CLIP normalization).
   - Memory consumption dropped from ~1,380 MB peak down to **239.8 MB peak**, well under Render's 512 MB ceiling.
2. **Unified Render Blueprint (`render.yaml`)**:
   - Single root-level configuration that deploys `sportguard-ml`, `sportguard-api`, and `sportguard-web` with zero configuration overhead.
3. **Pre-Loaded Demo Data Purged**:
   - Cleared stale cricket/football test records from `memory_store.json` and emptied initial FAISS index caches.
   - Added runtime data directories to `.gitignore` so local test data is never committed.
4. **Automated Test Suite**:
   - All 45 integration tests in `Backend/server/test.js` pass with 100% success rate across health, ingest, hunt, scan, adjudicate, enforce, broker, and swarm routes.
5. **Docker Build Context & Asset Inclusion**:
   - Resolved Docker build context exclusions by adding explicit `!clip_vision_int8.onnx` unignore in `Backend/.dockerignore`.
   - Added `sed -i 's/\r$//' /entrypoint.sh` to ensure Unix LF line endings across multi-platform checkouts.
6. **Fixed in this push**:
   - **UptimeRobot 405 Method Not Allowed**: Registered `HEAD` method support on `GET /` on `sportguard-ml` so uptime monitoring checks succeed.
   - **Friendly YouTube Error Messages**: Detected datacenter IP blocks and bot detection from YouTube to return actionable guidance (`YouTube blocked the server. Use a direct .mp4 link, or upload the file instead.`).
   - **Keepalive Interval & Timeout**: Tightened ping interval from 14 min to 10 min with 60s timeout to survive cold starts.

---

## 3. Known Issues, Errors, and Fix Instructions

### Issue A: MongoDB Shows `"unavailable"` in `/api/health`
- **Symptom**: `GET https://sportguard-api.onrender.com/api/health` returns `"mongo": "unavailable"`.
- **Exact Error**: `MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster` or `bad auth : authentication failed`.
- **Likely Cause**:
  1. Render IP Whitelist: MongoDB Atlas Network Access only whitelisted local/home IPs. Render web services have dynamic outbound IP addresses.
  2. Missing `MONGO_URI`: The environment variable was left unset in the Render service dashboard.
  3. Unescaped Password: If the database user password contains special characters (e.g. `@`, `:`, `#`, `%`, or `< >` placeholder brackets), the connection string fails to parse.
- **Exact Fix Steps**:
  1. Go to [MongoDB Atlas](https://cloud.mongodb.com/) -> **Security** -> **Network Access**.
  2. Click **+ Add IP Address** -> Select **Allow Access from Anywhere** (`0.0.0.0/0`) -> Click **Confirm**.
  3. Ensure cluster is not paused (Atlas free tiers pause after prolonged inactivity).
  4. In Render Dashboard -> select **`sportguard-api`** -> **Environment** -> verify `MONGO_URI` is set to the full URI string (ensure `<password>` brackets are replaced with actual password, and special characters are URL-encoded).

---

### Issue B: Redis Shows `"unavailable"` in `/api/health`
- **Symptom**: `GET /api/health` returns `"redis": "unavailable"`.
- **Likely Cause**: No Redis instance is running locally or configured in production.
- **Impact & Fix**:
  - **Safe to ignore:** The application features an automatic in-memory fallback. All queuing, rate limiting, and incident stores function without Redis.
  - To enable Redis caching and velocity tracking: provision a free database on [Upstash Redis](https://upstash.com/), copy the Redis connection URL, and add `REDIS_URL` to `sportguard-api` environment variables.

---

### Issue C: YouTube Downloads Blocked ("Sign in to confirm you're not a bot")
- **Symptom**: Video ingestion on YouTube URLs fails with bot detection or HTTP 429.
- **Exact Error**: `Sign in to confirm you're not a bot. This helps protect our community.`
- **Likely Cause**: YouTube aggressively blocks known cloud datacenter IP subnets (Render, AWS, DigitalOcean).
- **Exact Fix Steps / Alternatives**:
  - **Option 1 (Recommended for Demos)**: Use direct `.mp4` URLs. Ingest works immediately and reliably with direct file links from:
    - GitHub Raw: `https://raw.githubusercontent.com/.../video.mp4`
    - Dropbox: `https://www.dropbox.com/s/.../video.mp4?dl=1`
    - Google Drive: Shared link with "Anyone with the link can view".
    - Box / OneDrive direct download links.
  - **Option 2 (Cookie Authentication)**: Export YouTube cookies using a browser extension (Netscape format `cookies.txt`), encode to base64 (`base64 -w 0 cookies.txt`), and set `YOUTUBE_COOKIES_B64` in Render for `sportguard-ml`.
  - **Option 3 (Residential Proxy / Apify)**: Set `APIFY_API_TOKEN` in Render for `sportguard-ml`. The engine will route requests through residential proxies automatically.

---

### Issue D: UptimeRobot / Health Checker 405 Method Not Allowed
- **Symptom**: Uptime monitors report `sportguard-ml` as down with status code `405 Method Not Allowed`.
- **Exact Error**: `HTTP/1.1 405 Method Not Allowed (allow: GET)`.
- **Cause**: Uptime monitoring services (UptimeRobot, BetterStack) send `HEAD` requests by default. FastAPI `@app.get("/")` previously rejected `HEAD`.
- **Resolution**:
  - Added `@app.api_route("/", methods=["GET", "HEAD"])` in `Backend/main.py`.
  - Alternatively, configure UptimeRobot to monitor `https://sportguard-api.onrender.com/api/health` using standard `GET`.

---

### Issue E: Ephemeral Storage (FAISS Vault Resets on Restart)
- **Symptom**: Ingested videos and indexed vectors disappear after the ML container restarts or redeploys.
- **Cause**: Render free tier containers use an ephemeral filesystem. Any file written to `Backend/vault/` is discarded when the container spins down.
- **Fix Steps**:
  1. Upgrade `sportguard-ml` on Render to attach a persistent disk (mounted at `/app/vault`).
  2. Or configure cloud synchronization in `archivist.py` to persist `faiss_vault.index`, `vault_metadata.json`, and `temporal_signatures.json` to Google Cloud Storage or AWS S3 on each ingest.

---

### Issue F: OCR & Deep Forensics Model Disabled in Lite Mode
- **Symptom**: Text watermark extraction and the deep spatial noise forensics model (`best.pth`) return empty or heuristic results.
- **Cause**: `easyocr` and PyTorch `best.pth` require > 1.2 GB RAM, exceeding Render's 512 MB free tier.
- **Fix Steps**:
  - Lite mode uses heuristic forensic analysis (JPEG quantization artifacts + frame DCT analysis), which requires 0 MB extra RAM.
  - If deep forensics or EasyOCR are mandatory, upgrade the Render instance to **Starter (2 GB RAM)** or higher and set `LITE_MODE=false`.

---

## 4. Priority Roadmap for the Team

1. **Priority 1 (Critical)**: Ensure `MONGO_URI` is populated in Render (`sportguard-api` settings) and MongoDB Atlas Network Access has `0.0.0.0/0` whitelisted.
2. **Priority 2 (High)**: Add persistent storage (Render Persistent Disk or S3/GCS sync) for `Backend/vault/` so ingested sports fingerprints survive restarts.
3. **Priority 3 (Medium)**: For YouTube stream ingestion on cloud IPs, acquire and set `YOUTUBE_COOKIES_B64` or an `APIFY_API_TOKEN` on `sportguard-ml`.
4. **Priority 4 (Low)**: Add an Upstash Redis instance (`REDIS_URL`) to enable distributed rate limiting and velocity tracking.

---

## 5. Environment Variables Specification

> **IMPORTANT:** Never commit real secrets to the repository. Configure these only in local `.env` files or Render Dashboard.

| Variable Name | Service | Required? | Purpose / Source |
|---|---|---|---|
| `PORT` | `sportguard-ml`, `sportguard-api` | Required | Port to bind (Render provides dynamically, defaults: 8001 ML, 8000 API) |
| `LITE_MODE` | `sportguard-ml` | Required | Set to `true` for 512MB RAM tier (disables PyTorch, uses Int8 ONNX) |
| `INGEST_SAMPLE_SEC` | `sportguard-ml` | Required | Frame sampling interval (set to `1.0` for high accuracy) |
| `CLIP_BATCH_SIZE` | `sportguard-ml` | Required | Batch size for ONNX embedding inference (set to `2` on free tier) |
| `WATCHDOG_ENABLED` | `sportguard-ml` | Optional | Set to `false` to prevent background CPU contention during demos |
| `GROQ_API_KEY` | `sportguard-ml` | Required | High-speed LLM copyright adjudication (from [console.groq.com](https://console.groq.com)) |
| `GEMINI_API_KEY` | `sportguard-ml` | Optional | Secondary fair-use analysis model (from [aistudio.google.com](https://aistudio.google.com)) |
| `YOUTUBE_COOKIES_B64` | `sportguard-ml` | Optional | Base64-encoded `cookies.txt` to bypass YouTube datacenter IP blocking |
| `APIFY_API_TOKEN` | `sportguard-ml` | Optional | Apify token for residential proxy scraping fallback |
| `NODE_ENV` | `sportguard-api` | Required | Set to `production` on Render, `development` locally |
| `FASTAPI_URL` | `sportguard-api` | Required | Internal or public URL of ML service (`https://sportguard-ml.onrender.com`) |
| `CLIENT_URL` | `sportguard-api` | Required | Frontend URL for CORS and WebSockets (`https://sportguard-web.onrender.com`) |
| `MONGO_URI` | `sportguard-api` | Required | MongoDB Atlas connection URI string |
| `REDIS_URL` | `sportguard-api` | Optional | Redis connection URL for caching (e.g. Upstash) |
| `VITE_API_URL` | `sportguard-web` | Required | URL of the Node API server (`https://sportguard-api.onrender.com`) |

---

## 6. How to Run Locally

### Terminal 1: Python ML Engine (Port 8001)
```bash
cd Backend
# Ensure virtual environment is activated
.\.venv\Scripts\activate   # On Windows
# source .venv/bin/activate  # On Linux / macOS
$env:LITE_MODE="true"      # PowerShell ($env) or export LITE_MODE=true (bash)
python main.py
```
*Health check:* `curl http://127.0.0.1:8001/` -> `{"status":"ok",...}`

### Terminal 2: Node.js Orchestrator (Port 8000)
```bash
cd Backend/server
npm install
npm run dev    # or node app.js
```
*Health check:* `curl http://127.0.0.1:8000/api/health` -> `{"fastapi":"ok",...}`

### Terminal 3: React Frontend (Port 5173)
```bash
cd Frontend
npm install
npm run dev
```
*Access UI:* Open `http://localhost:5173` in your browser.

---

## 7. How to Deploy to Production

1. **Automated Continuous Deployment**:
   - Pushing any commit to `main` triggers automated rebuilds on Render:
     ```bash
     git add -A
     git commit -m "your descriptive commit message"
     git push origin main
     ```
2. **Blueprint Sync (Render Dashboard)**:
   - If modifying `render.yaml`, open [Render Dashboard](https://dashboard.render.com/) -> select Blueprint (`Titans`) -> click **Manual Sync** -> **Apply**.

---

## 8. Verification & QA Checklist for the Team

- [ ] **ML Health**: `curl -s https://sportguard-ml.onrender.com/` returns `status: "ok"`.
- [ ] **ML HEAD Check**: `curl -sI https://sportguard-ml.onrender.com/` returns `HTTP/1.1 200 OK`.
- [ ] **Node Health**: `curl -s https://sportguard-api.onrender.com/api/health` returns `fastapi: "ok"` and `mongo: "ok"`.
- [ ] **Direct Ingest**: POST a public `.mp4` link to `/ingest` and verify `/ingest/status/{job_id}` reaches `status: "complete"`.
- [ ] **Scan Matching**: POST a thumbnail or frame from the ingested video to `/scan` and verify `match_confirmed: true` with CLIP similarity > 0.70.
- [ ] **LLM Adjudication**: POST an incident to `/adjudicate` and verify a legal verdict is returned from Groq/Gemini with statutory citations.
- [ ] **Web UI**: Open `https://sportguard-web.onrender.com` in browser, verify live socket connection indicator turns green, and asset cards render properly in Asset Vault.
