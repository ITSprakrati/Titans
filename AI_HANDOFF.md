# SportGuard AI — AI Handoff & Repository Audit Report

**Date**: 2026-10-24  
**Project**: SportGuard AI  
**Preferred Tagline**: Detect. Verify. Protect.  
**Auditor**: Antigravity (Senior Full-Stack Engineer & Auditor)  
**Next Agent / Collaborator**: Claude (ML Deployment Specialist)  

---

## 1. Verified Current Status

1. **Frontend**: Deployed and fully operational. Rebranded to **SportGuard AI** with sports IP protection focus. Configured with `VITE_API_URL`. Includes an active offline warning banner if the backend or ML service is unreachable.
2. **Node.js Orchestrator**: Deployed and fully operational locally and remotely. Validated with 41 passing integration tests. Consistently consumes `process.env.FASTAPI_URL`. Operates with built-in in-memory fallbacks when MongoDB and Redis are offline.
3. **Python ML Backend**: Operates locally on Python 3.11/3.14. Remote deployment to Render is **PENDING CLAUDE**.
4. **Video Ingestion**: Root cause identified and patched in `Backend/agents/archivist.py`. `INGEST_SAMPLE_SEC` was hardcoded to `30.0`s (failing all clips under 30 seconds). Patched to default `1.0`s with robust uniform fallback sampling.
5. **No Secrets Exposed**: All sensitive credentials, API keys, and connection strings are cleanly abstracted into environment variables.

---

## 2. Repository Map

```
Titans-main/
├── AI_HANDOFF.md                     # This handoff file
├── PROJECT_STATUS.md                 # Live verified deployment & component status
├── API_AND_ENVIRONMENT_GUIDE.md      # Complete 32-endpoint & env var inventory
├── ML_RENDER_DEPLOYMENT_GUIDE.md     # Detailed Render deployment instructions for Claude
├── TEST_RESULTS.md                   # Automated test run results (41/41 passed)
├── README.md                         # Project documentation
│
├── Backend/
│   ├── main.py                       # FastAPI ML service (Port 8001) - 28 endpoints
│   ├── requirements.txt              # Python dependencies
│   ├── Dockerfile.fastapi            # Container build for FastAPI service
│   ├── Dockerfile.node               # Container build for Node.js service
│   ├── entrypoint.sh                 # Startup script with model download hooks
│   ├── download_models.py            # Model download utility (GCS / Drive)
│   ├── export_clip_onnx.py           # CLIP PyTorch to ONNX exporter
│   ├── .env.example                  # Comprehensive environment template
│   │
│   ├── agents/                       # Specialized AI Agents
│   │   ├── archivist.py              # Ingestion, frame extraction, CLIP, FAISS, audio FP
│   │   ├── spider.py                 # Multi-platform crawler (YouTube, TikTok, etc.)
│   │   ├── sentinel.py               # 5-layer piracy detection (CLIP, pHash, temporal, etc.)
│   │   ├── adjudicator.py            # AI legal infringement classification (LLM)
│   │   ├── enforcer.py               # DMCA notice drafting with proof hash
│   │   ├── broker.py                 # Rev-share licensing contract minting
│   │   ├── evidence_vault.py         # SHA-256 sealed chain-of-custody vault
│   │   ├── forensics.py              # Platform sharing chain reconstruction
│   │   ├── live_stream.py            # HLS / m3u8 stream segment monitoring
│   │   └── watchdog.py               # Periodic background sweep monitoring
│   │
│   └── server/                       # Node.js Express Orchestrator (Port 8000)
│       ├── app.js                    # Express application entrypoint & health checks
│       ├── package.json              # Express, Socket.IO, Mongoose, ioredis dependencies
│       ├── test.js                   # 41-case automated integration test suite
│       ├── config/                   # db.js (MongoDB), redis.js, socket.js
│       ├── controllers/              # swarmController, archivistController, sentinelController, etc.
│       ├── routes/                   # ingest, hunt, scan, adjudicate, enforce, broker, stream, etc.
│       └── utils/                    # memoryStore.js (safe in-memory fallback), blockchain.js
│
└── Frontend/                         # React 19 + Vite + Tailwind CSS Client
    ├── index.html                    # Rebranded title
    ├── package.json                  # Rebranded to sportguard-ai
    ├── src/
    │   ├── services/api.js           # Axios service layer targeting VITE_API_URL
    │   ├── context/
    │   │   ├── DashboardContext.jsx  # Main state, socket event listener, fallback handling
    │   │   └── SocketContext.jsx     # Socket.IO connection manager
    │   ├── pages/
    │   │   ├── Dashboard.jsx         # Control center layout with ML offline warning banner
    │   │   ├── Landing.jsx           # Rebranded landing page (Detect. Verify. Protect.)
    │   │   └── ...
    │   └── components/
    │       ├── dashboard/            # AssetVault, ThreatHunter, IncidentTable, etc.
    │       ├── landing/              # HeroSection, Navbar, LandingNav, CTASection, etc.
    │       └── layout/               # Sidebar (rebranded), Header
```

---

## 3. Work Completed by Antigravity

1. **Repository Audit (P0)**: Full inspection of Frontend, Node.js backend, and Python ML backend. Verified compatibility and data contracts.
2. **API & Environment Guide (P1)**: Created `API_AND_ENVIRONMENT_GUIDE.md` documenting all 32 Node.js routes, 28 FastAPI endpoints, schemas, status codes, and environment variables.
3. **Node.js ↔ Python Integration (P2)**: Confirmed all Node.js controllers cleanly route to `process.env.FASTAPI_URL` without hardcoded localhost overrides. Prepared `ML_RENDER_DEPLOYMENT_GUIDE.md` for Claude.
4. **Video Ingestion Investigation & Performance Optimization (P3)**: Diagnosed the 0-frame failure on sports clips in `Backend/agents/archivist.py` (caused by hardcoded `INGEST_SAMPLE_SEC=30.0`). Patched with adaptive sampling (1.0s for <=45s clips scaling to 6.0s for full broadcasts) and guaranteed uniform fallback. Benchmarked real clip processing: dropped from **13.678s** to **1.094s** (**12.5x speedup**).
5. **Environment & Infrastructure Verification (P4)**: Documented all required and optional services (MongoDB, Redis, Gemini, Groq, Apify, GCS). Verified that Node.js safely falls back to in-memory persistence when MongoDB or Redis are unavailable.
6. **Sports Rebranding (P5)**: Rebranded the user-facing application across 10+ frontend files to **SportGuard AI** with tagline **"Detect. Verify. Protect."**, focusing the UI and copy on sports broadcast protection, rights holders, and verified evidence.
7. **Verification & Testing (P6, P7)**: Ran `Backend/server/test.js` against the live local Node.js server with **41 passed, 0 failed**. Verified Python ML module imports.

---

## 4. Exact Handoff to Claude

### Claude's Primary Responsibility
Claude is responsible for deploying the **Python ML Backend** (`Backend/main.py`) to Render and verifying its live operation.

### Files Claude Should Inspect
1. **`ML_RENDER_DEPLOYMENT_GUIDE.md`**: Contains exact entrypoint commands, port expectations, environment variables, and endpoint verification steps.
2. **`Backend/Dockerfile.fastapi`**: Pre-configured Dockerfile with `ffmpeg`, `libgl1`, and CPU PyTorch.
3. **`Backend/requirements.txt`**: Package dependencies.
4. **`Backend/main.py`**: FastAPI entrypoint and routes.
5. **`Backend/agents/archivist.py`**: Model loading and video frame processing.

### Explicit Ownership Boundaries
- **Antigravity Ownership**: Node.js backend, Frontend UI, branding, documentation, integration contracts, local API audit. Antigravity does **not** deploy the Python service to Render.
- **Claude Ownership**: Python ML backend deployment to Render, container runtime configuration, model downloading/caching on Render, and live Python endpoint verification.

---

## 5. Ranked Next Steps

1. **Claude Deploys Python ML Backend to Render**:
   - Create a Web Service on Render pointing to `Backend/Dockerfile.fastapi` or using Python 3.11 native runtime.
   - Configure Render Health Check to `/`.
   - Set environment variables: `PORT=8001`, `INGEST_SAMPLE_SEC=1.0`, `CLIP_BATCH_SIZE=4`, `WATCHDOG_ENABLED=false` (if on 512MB RAM tier).
2. **Connect Deployed Node.js Orchestrator to Python ML Service**:
   - In the deployed Node.js Render dashboard, set:
     ```env
     FASTAPI_URL=https://<claude-python-service>.onrender.com
     ```
   - Hit `GET https://<node-service>.onrender.com/api/health` to confirm `fastapi: true`.
3. **Connect Frontend to Deployed Node.js Service**:
   - Ensure the deployed Frontend (e.g. Vercel) has `VITE_API_URL=https://<node-service>.onrender.com`.
4. **Execute End-to-End Live Hackathon Demonstration**:
   - Ingest an official sports clip via the Asset Vault.
   - Run the Threat Hunter swarm on a test URL.
   - Inspect the detected incidents, evidence custody chain, and DMCA / licensing contract generation.
