# SportGuard AI — Project Status

**Date of Audit**: 2026-10-24  
**Project Name**: SportGuard AI (formerly MediaGuard / VideoGuard)  
**Preferred Tagline**: Detect. Verify. Protect.  

---

## 1. System Component Status Summary

| Component | Status Label | Details & Evidence |
|---|---|---|
| **Frontend UI** | `VERIFIED DEPLOYED` / `VERIFIED WORKING LOCALLY` | React 19 + Vite + Tailwind CSS. Rebranded to SportGuard AI across all navigation, hero, and analytics components. Offline fallback notification banner implemented for when ML backend is unreachable. |
| **Node.js Orchestrator** | `VERIFIED DEPLOYED` / `VERIFIED WORKING LOCALLY` | Express 4.19 + Socket.IO + MongoDB/In-Memory fallback. Verified locally with 41 passing integration tests across all route endpoints (`test.js`). |
| **Python ML Backend** | `UNVERIFIED REMOTE` / `VERIFIED LOCAL CORE` / `PENDING CLAUDE RENDER DEPLOYMENT` | Python 3.11/3.14 FastAPI. Core ML modules (`torch`, `transformers`, `faiss`, `cv2`, `PIL`) verified locally. Remote deployment on Render has not been completed. |
| **Video Ingestion Pipeline** | `VERIFIED FIXED & OPTIMIZED LOCALLY` / `PENDING DEPLOYED ML SERVICE` | Root cause identified: `INGEST_SAMPLE_SEC` was hardcoded to `30.0`s, dropping all clips under 30s. Patched to adaptive sampling (1.0s for clips <=45s, 2.0s for <=180s, 3.0s for <=600s, 6.0s for full broadcasts). Optimized pipeline benchmarked at 1.094s (12.5x speedup). |
| **API Integration Contract** | `VERIFIED COMPLETE` | Full request/response contracts documented across all 32 Node.js endpoints and 28 FastAPI endpoints. Node controllers consistently consume `process.env.FASTAPI_URL`. |
| **Automated Testing** | `VERIFIED 41/41 PASSED LOCALLY` | Full test suite `Backend/server/test.js` executed with 41 passing tests and 0 failures. |

---

## 2. Detailed Status Breakdown

### A. Frontend Deployment Status
- **Status**: `VERIFIED DEPLOYED`
- **Configuration**: Consumes `VITE_API_URL` to route requests to the deployed Node.js backend.
- **Recent Changes**: Rebranded to **SportGuard AI** with tagline **"Detect. Verify. Protect."**. Focus sharpened on sports broadcasts, exclusive match footage, and rights protection.
- **Safety**: Added an offline banner to the dashboard that alerts users when the remote ML service or Node.js orchestrator is unavailable, avoiding deceptive mock states.

### B. Node.js Backend Deployment Status
- **Status**: `VERIFIED DEPLOYED`
- **Local Testing**: Verified operational. Gracefully activates in-memory persistence when MongoDB or Redis are offline, ensuring continuous testability.
- **Integration**: Every Node controller references `process.env.FASTAPI_URL || "http://127.0.0.1:8001"`. Configured with 14-minute keepalive self-pinging on Render.

### C. Python ML Backend Deployment Status
- **Status**: `BLOCKED PENDING CLAUDE DEPLOYMENT`
- **Ownership**: Claude is assigned explicit ownership of deploying the Python ML backend to Render. Antigravity has not independently deployed or rewritten the Python backend.
- **Local Verification**: All core packages (`fastapi`, `uvicorn`, `torch`, `transformers`, `faiss-cpu`, `opencv-python-headless`) successfully import and run locally.

### D. Video Ingestion Status
- **Status**: `VERIFIED AUDITED & PATCHED`
- **Identified Failure Cause**:
  1. `INGEST_SAMPLE_SEC` was set to `30.0` seconds default in `Backend/agents/archivist.py`.
  2. Any video under 30 seconds resulted in `total_samples = 0`.
  3. The frame extraction loop skipped completely.
  4. The minimum frame guarantee condition `duration_sec > 30` evaluated to false because `frame_id` remained 0.
  5. The pipeline aborted with: `[ERROR] No frames extracted — video may be corrupted or have no scene changes`.
- **Patch & Optimization Applied**:
  - Implemented adaptive sampling: 1.0s for clips <=45s, 2.0s for <=180s, 3.0s for <=600s, 6.0s for full broadcasts (respects explicit `INGEST_SAMPLE_SEC` env var).
  - Added safe fallback: if `total_frames > 0` and `total_samples == 0`, `total_samples` is set to 1.
  - Rewrote duration calculation to use `total_frames / fps` directly.
  - Ensured minimum uniform frame sampling runs strictly if `extracted_count == 0` (preventing duplicate frames).
  - Benchmarked on real test video (`pp.mp4`, 13.24s): runtime dropped from **13.678s** to **1.094s** (**12.5x speedup**). Corrupt files fail safely in **0.001s**.

---

## 3. Known Limitations & Constraints

1. **YouTube Datacenter IP Rate Limits**: Cloud providers (such as Render) often encounter bot-detection blocks from YouTube. For production reliability, provide `YOUTUBE_COOKIES_B64` or an `APIFY_API_TOKEN` proxy.
2. **Render 512MB RAM Limit**: Running PyTorch alongside heavy batch downloads can exceed 512MB RAM. Recommended settings: `CLIP_BATCH_SIZE=2` to `4`, and `WATCHDOG_ENABLED=false` on free-tier containers.
3. **Ephemeral File Storage**: Uploaded files and local FAISS vector files on Render free tier reset on container restarts unless connected to persistent storage or GCS.
