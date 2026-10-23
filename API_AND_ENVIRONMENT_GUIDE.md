# SportGuard AI — API and Environment Guide

## 1. Executive Architecture Overview

SportGuard AI uses a three-tier architecture:

```
[React / Vite Frontend]
       │
       ▼ (REST + Socket.IO via VITE_API_URL)
[Node.js / Express Orchestrator] (Port 8000)
  ├── MongoDB (Persistent Incidents, Contracts, DMCA Records, Assets)
  ├── In-Memory Store Fallback (Graceful fallback if Mongo unavailable)
  ├── Redis / Upstash (Offence tracking, velocity, LLM adjudication cache)
  └── Socket.IO (Real-time pipeline telemetry to clients)
       │
       ▼ (REST via FASTAPI_URL)
[Python / FastAPI ML Engine] (Port 8001)
  ├── Archivist (Video download, frame extraction, CLIP ViT-B/32, FAISS vector vault, audio fingerprinting)
  ├── Spider (Multi-platform crawler)
  ├── Sentinel (5-layer piracy detection: CLIP, pHash, Temporal DNA, Audio FP, Forensics)
  ├── Adjudicator (Legal infringement classification via Gemini/Groq LLM)
  ├── Enforcer (DMCA notice generation)
  ├── Broker (Licensing & revenue-sharing contract minting)
  ├── Evidence Vault (SHA-256 integrity chains, custody logging, export)
  ├── Live Stream Monitor (HLS / m3u8 stream segment analysis)
  └── Watchdog (Continuous background monitoring thread)
```

---

## 2. API Inventory

### A. Node.js Express Orchestrator Routes (`/api`)

All endpoints below are prefixed with `/api` and exposed by the Node.js server.

| Service | Method | Route | Purpose | Calling Component | Request Schema | Response Schema | Status Codes | Dependencies | Required Env Vars | Verification Status | Source File & Function |
|---|---|---|---|---|---|---|---|---|---|---|---|
| System | GET | `/api/health` | Multi-tier service health check | Frontend Header / Monitoring | None | `{ success, node: 'ok', mongo: bool, redis: bool, fastapi: bool }` | 200, 503 | MongoDB, Redis, FastAPI | `FASTAPI_URL`, `MONGO_URI`, `REDIS_URL` | Verified | `server/app.js` |
| Archivist | POST | `/api/ingest` | Kick off asynchronous reference video ingestion | Frontend `AssetVault.jsx` via `archivistService.ingest` | `{ official_video_url: string (URL), video_title?: string }` | `{ success: true, message: string, assetId: string, jobId: string }` | 200, 400, 500 | FastAPI `/ingest`, MongoDB/MemoryStore, Socket.IO | `FASTAPI_URL` | Verified | `server/controllers/archivistController.js` `ingestAsset` |
| Archivist | GET | `/api/ingest` | List all ingested vault assets | Frontend `AssetVault.jsx` via `archivistService.getAll` | None (query: none) | `{ success: true, data: Array<IngestedAsset> }` | 200 | MongoDB/MemoryStore | None | Verified | `server/controllers/archivistController.js` `getAssets` |
| Archivist | GET | `/api/ingest/:id` | Get specific asset metadata and status | Frontend polling / detail view | URL param: `id` | `{ success: true, data: IngestedAsset }` | 200, 404 | MongoDB/MemoryStore | None | Verified | `server/controllers/archivistController.js` `getAssetById` |
| Archivist | DELETE | `/api/ingest/:id` | Remove asset from vault and delete local media | Frontend `AssetVault.jsx` via `archivistService.delete` | URL param: `id` | `{ success: true, message: string, id: string }` | 200, 404 | MongoDB/MemoryStore, File system | None | Verified | `server/controllers/archivistController.js` `deleteAsset` |
| Spider / Hunt | POST | `/api/hunt` | Trigger Spider crawl across external platforms | Frontend `ThreatHunter.jsx` via `spiderService.hunt` | `{ official_video_url: string, official_title?: string }` | `{ success: true, jobId: string, message: string }` | 200, 400, 500 | FastAPI `/hunt`, MongoDB/MemoryStore, Socket.IO | `FASTAPI_URL` | Verified | `server/routes/hunt.js` inline handler |
| Spider / Hunt | GET | `/api/hunt/:jobId` | Poll hunt job status | Frontend `spiderService.getStatus` | URL param: `jobId` | `{ success: true, job: HuntJob }` | 200, 404 | MongoDB/MemoryStore | None | Verified | `server/routes/hunt.js` inline handler |
| Sentinel / Scan | POST | `/api/scan` | Single suspect scan via thumbnail/URL | Frontend `ThreatHunter.jsx` via `sentinelService.scan` | `{ thumbnail_url: string, account_handle?: string, platform?: string, title?: string, url?: string, country?: string, coordinates?: object, jobId?: string }` | `{ success: true, incidentId: string, match_confirmed: bool, confidence_score: number, severity: string, phash_match: bool, top_matches: Array, velocity: number }` | 200, 400, 500 | FastAPI `/scan`, Redis, MongoDB/MemoryStore, Socket.IO | `FASTAPI_URL`, `REDIS_URL` | Verified | `server/controllers/sentinelController.js` `scanSuspect` |
| Sentinel / Scan | POST | `/api/scan/batch` | Batch suspect scan on crawled threat nodes | Node Swarm Orchestrator | `{ threat_nodes: Array<Node>, jobId?: string }` | `{ success: true, total: number, piracy_count: number, fair_use_count: number, incidents: Array<string> }` | 200, 400, 500 | FastAPI `/scan/batch`, Redis, MongoDB/MemoryStore, Socket.IO | `FASTAPI_URL`, `REDIS_URL` | Verified | `server/controllers/sentinelController.js` `batchScan` |
| Sentinel / Scan | GET | `/api/incidents` | Query detected infringement incidents | Frontend `IncidentTable.jsx`, `DashboardContext.jsx` | Query: `jobId?`, `severity?`, `status?`, `page?`, `limit?` | `{ success: true, data: Array<Incident>, total: number, page: number }` | 200 | MongoDB/MemoryStore | None | Verified | `server/controllers/sentinelController.js` `getIncidents` |
| Sentinel / Scan | GET | `/api/incidents/:id` | Fetch specific incident | Frontend incident detail modal | URL param: `id` | `{ success: true, data: Incident }` | 200, 404 | MongoDB/MemoryStore | None | Verified | `server/controllers/sentinelController.js` `getIncidentById` |
| Sentinel / Scan | DELETE | `/api/incidents/:id` | Delete incident record | Frontend incident management | URL param: `id` | `{ success: true, message: string, id: string }` | 200, 404 | MongoDB/MemoryStore | None | Verified | `server/controllers/sentinelController.js` `deleteIncident` |
| Swarm | POST | `/api/swarm/run` | Launch full 5-stage autonomous swarm pipeline | Frontend `ThreatHunter.jsx` via `swarmService.run` | `{ official_video_url?: string, official_title?: string, asset_id?: string }` | `{ success: true, jobId: string, huntJobId: string, message: string }` | 200, 400, 500 | FastAPI `/hunt`, `/scan/batch`, `/scan/full`, `/adjudicate`, `/enforce`, `/broker`, Socket.IO | `FASTAPI_URL`, `REDIS_URL` | Verified | `server/controllers/swarmController.js` `runSwarm` |
| Adjudicator | POST | `/api/adjudicate` | Legal classification of an incident | Frontend `LegalPanel.jsx` / `swarmController` | `{ incident_id: string, sentinel_report: string, platform: string, account_handle: string, video_title: string, description?: string, country?: string, confidence_score?: number }` | `{ success: true, incident_id: string, verdict: object, from_cache: bool, next_agent: string }` | 200, 400, 500 | FastAPI `/adjudicate`, Redis (24h cache), MongoDB/MemoryStore | `FASTAPI_URL`, `REDIS_URL` | Verified | `server/controllers/adjudicatorController.js` `adjudicateIncident` |
| Adjudicator | POST | `/api/adjudicate/batch` | Batch legal classification | Node Swarm Orchestrator | `{ incidents: Array<AdjudicateItem>, jobId?: string }` | `{ success: true, total: number, enforcer_count: number, broker_count: number, results: Array }` | 200, 400, 500 | FastAPI `/adjudicate/batch`, Redis, MongoDB/MemoryStore | `FASTAPI_URL`, `REDIS_URL` | Verified | `server/controllers/adjudicatorController.js` `batchAdjudicate` |
| Adjudicator | GET | `/api/adjudicate/:id` | Retrieve verdict for an incident | Frontend `LegalPanel.jsx` | URL param: `id` | `{ success: true, classification: string, justification: string, status: string }` | 200, 404 | MongoDB/MemoryStore | None | Verified | `server/controllers/adjudicatorController.js` `getVerdict` |
| Enforcer | POST | `/api/enforce` | Generate cryptographic DMCA takedown draft | Frontend `EnforcementHub.jsx` / `swarmController` | `{ incident_id: string, target_account: string, platform: string, video_title: string, video_url?: string, confidence_score: number, classification?: string, justification?: string, integrity_hash?: string }` | `{ success: true, dmca_id: string, tier: string, offence_number: number, legal_contact: string, notice_text: string, integrity_hash: string, status: "drafted" }` | 200, 400, 500 | FastAPI `/enforce`, Redis (90d offences), MongoDB/MemoryStore | `FASTAPI_URL`, `REDIS_URL` | Verified | `server/controllers/enforcerController.js` `enforceIncident` |
| Enforcer | PATCH | `/api/enforce/:id/approve` | Human-in-the-loop: Approve & dispatch DMCA notice | Frontend `EnforcementHub.jsx` via `enforcerService.approve` | URL param: `id` | `{ success: true, message: string, dmca_id: string }` | 200, 400, 404 | MongoDB/MemoryStore, Socket.IO | None | Verified | `server/controllers/enforcerController.js` `approveDMCA` |
| Enforcer | PATCH | `/api/enforce/:id/reject` | Reject DMCA notice (false positive clearance) | Frontend `EnforcementHub.jsx` via `enforcerService.reject` | URL param: `id` | `{ success: true, message: string, dmca_id: string }` | 200, 404 | MongoDB/MemoryStore, Redis | `REDIS_URL` | Verified | `server/controllers/enforcerController.js` `rejectDMCA` |
| Enforcer | GET | `/api/enforce` | List DMCA records | Frontend `EnforcementHub.jsx` | Query: `status?`, `platform?`, `page?`, `limit?` | `{ success: true, data: Array<DMCARecord>, total: number, page: number }` | 200 | MongoDB/MemoryStore | None | Verified | `server/controllers/enforcerController.js` `getDMCARecords` |
| Enforcer | GET | `/api/enforce/:id` | Fetch specific DMCA notice | Frontend notice modal | URL param: `id` | `{ success: true, data: DMCARecord }` | 200, 404 | MongoDB/MemoryStore | None | Verified | `server/controllers/enforcerController.js` `getDMCAById` |
| Broker | POST | `/api/broker` | Mint fair-use revenue-sharing smart contract | Frontend `BrokerPanel.jsx` / `swarmController` | `{ incident_id: string, target_account: string, platform: string, video_title: string, video_url?: string, justification?: string, view_count?: number, risk_score?: number }` | `{ success: true, contract_id: string, tier: string, copyright_holder_share: number, creator_share: number, tx_hash: string, integrity_hash: string, estimated_monthly_revenue: number, contract_data: object, status: "minted" }` | 200, 400, 500 | FastAPI `/broker`, MongoDB/MemoryStore, Socket.IO | `FASTAPI_URL` | Verified | `server/controllers/brokerController.js` `brokerIncident` |
| Broker | PATCH | `/api/broker/:id/activate` | Human-in-the-loop: Deploy/activate contract | Frontend `BrokerPanel.jsx` via `brokerService.activate` | URL param: `id` | `{ success: true, message: string, contract_id: string }` | 200, 400, 404 | MongoDB/MemoryStore, Socket.IO | None | Verified | `server/controllers/brokerController.js` `activateContract` |
| Broker | PATCH | `/api/broker/:id/dispute` | Return contract to review | Frontend `BrokerPanel.jsx` | URL param: `id` | `{ success: true, message: string, contract_id: string }` | 200, 404 | MongoDB/MemoryStore | None | Verified | `server/controllers/brokerController.js` `disputeContract` |
| Broker | GET | `/api/broker` | List all revenue-sharing contracts | Frontend `BrokerPanel.jsx`, `DashboardContext.jsx` | Query: `status?`, `platform?`, `page?`, `limit?` | `{ success: true, data: Array<ContractRecord>, total: number, page: number }` | 200 | MongoDB/MemoryStore | None | Verified | `server/controllers/brokerController.js` `getContracts` |
| Evidence | GET | `/api/evidence/:incident_id` | Evidence bundle summary with custody logging | Frontend `evidenceService.getSummary` (proxied to FastAPI) | URL param: `incident_id`, Query: `actor?` | `{ success: true, incident_id: string, sha256_hash: string, artifacts: Array, custody_entries: number }` | 200, 500 | FastAPI `/evidence/:incident_id` | `FASTAPI_URL` | Verified | `server/routes/evidence.js` |
| Evidence | GET | `/api/evidence/:incident_id/custody` | Full custody chain with cryptographic verification | Frontend `evidenceService.getCustody` | URL param: `incident_id` | `{ success: true, chain: Array, integrity: { valid: bool, broken_links: Array } }` | 200, 500 | FastAPI `/evidence/:incident_id/custody` | `FASTAPI_URL` | Verified | `server/routes/evidence.js` |
| Evidence | POST | `/api/evidence/:incident_id/export` | Export tamper-proof ZIP evidence bundle | Frontend `evidenceService.exportBundle` | URL param: `incident_id` | `{ success: true, path: string }` | 200, 500 | FastAPI `/evidence/:incident_id/export` | `FASTAPI_URL` | Verified | `server/routes/evidence.js` |
| Leak | POST | `/api/leak/analyze` | Forensics leak source analysis on thumbnail | Frontend `leakService.analyze` (proxied to FastAPI) | `{ thumbnail_url: string, video_url?: string, incident_id?: string, account_handle?: string, platform?: string }` | `{ success: true, first_leak_platform: string, leak_chain: Array, leak_risk: string, confidence: number, leak_summary: string }` | 200, 500 | FastAPI `/leak/analyze` | `FASTAPI_URL` | Verified | `server/routes/leak.js` |
| Stream | POST | `/api/stream/start` | Start live stream piracy monitoring | Frontend `AssetVault.jsx` / `streamService.start` | `{ stream_url: string, stream_id?: string }` | `{ success: true, stream_id: string, message: string }` | 200, 500 | FastAPI `/stream/start`, Socket.IO polling | `FASTAPI_URL` | Verified | `server/routes/stream.js` |
| Stream | DELETE | `/api/stream/:stream_id` | Stop live stream monitoring | Frontend `streamService.stop` | URL param: `stream_id` | `{ success: true, message: string }` | 200, 500 | FastAPI `/stream/:stream_id` | `FASTAPI_URL` | Verified | `server/routes/stream.js` |
| Stream | GET | `/api/stream/active` | List active live stream monitors | Frontend `streamService.getActive` | None | `{ success: true, streams: Array }` | 200, 500 | FastAPI `/stream/active` | `FASTAPI_URL` | Verified | `server/routes/stream.js` |
| Watchdog | GET | `/api/watchdog/status` | Continuous background monitor status | Frontend `watchdogService.getStatus` | None | `{ success: true, running: bool, interval_min: number, last_scan: string, protected_assets: number }` | 200, 500 | FastAPI `/watchdog/status` | `FASTAPI_URL` | Verified | `server/routes/watchdog.js` |
| Watchdog | POST | `/api/watchdog/trigger` | Trigger immediate sweep scan | Frontend `watchdogService.trigger` | Query: `asset_title?`, `asset_url?` | `{ success: true, scanned_assets: number, new_threats: number }` | 200, 500 | FastAPI `/watchdog/trigger` | `FASTAPI_URL` | Verified | `server/routes/watchdog.js` |
| Watchdog | GET | `/api/watchdog/history` | Historical background scan alerts | Frontend `watchdogService.getHistory` | Query: `limit?` | `{ success: true, history: Array, total: number }` | 200, 500 | FastAPI `/watchdog/history` | `FASTAPI_URL` | Verified | `server/routes/watchdog.js` |

---

### B. Python / FastAPI ML Engine Routes (Port 8001)

All endpoints below are exposed directly by `Backend/main.py` on port 8001.

| Method | Route | Request Body Model | Response Contract | Purpose | Calling Component |
|---|---|---|---|---|---|
| GET | `/` | None | `{"status": "ok", "service": "VideoGuard AI ML Engine", "version": "1.0.0"}` | Root Health Check | Node `/api/health`, Keepalive ping, Render health check |
| POST | `/ingest` | `IngestRequest`: `{ official_video_url: str, job_id: str, video_title: str }` | `{"success": true, "job_id": str, "status": "downloading", "message": str}` | Async video download, scene detection, CLIP embedding, FAISS indexing | Node `archivistController.js` |
| GET | `/ingest/status/{job_id}` | None (URL path param) | `{"success": true, "job_id": str, "status": "downloading"\|"processing"\|"complete"\|"failed", "title": str, "frame_count": int, "vault_size": int, "tx_hash": str, "message": str}` | Ingest status polling endpoint | Node `archivistController.js` |
| POST | `/hunt` | `HuntRequest`: `{ official_video_url: str, official_title: str }` | `{"success": true, "data": {"threat_nodes": list, "country_threat_counts": dict, "platforms_searched": list}}` | Multi-platform web crawl | Node `swarmController.js`, `routes/hunt.js` |
| POST | `/scan` | `ScanRequest`: `{ thumbnail_url: str, url: str, account_handle: str, platform: str, title: str, country: str }` | `{"success": true, "match_confirmed": bool, "confidence_score": float, "clip_confidence": float, "phash_match": bool, "top_matches": list, "severity": str}` | 5-layer thumbnail/video scan | Node `sentinelController.js` |
| POST | `/scan/batch` | `BatchScanRequest`: `{ threat_nodes: list, jobId: str }` | `{"results": [{"node": dict, "scan": dict}]}` | Parallel thumbnail-only scan (8 workers) | Node `sentinelController.js`, `swarmController.js` |
| POST | `/scan/full` | `FullScanRequest`: `{ url: str, thumbnail_url: str, platform: str, account_handle: str }` | `{"success": true, "confidence_score": float, "clip_confidence": float, "frames_scanned": int, ...}` | In-depth video download & multi-frame scan | Node `swarmController.js` (Phase 2b) |
| POST | `/adjudicate` | `AdjudicateRequest`: `{ sentinel_report: str, platform: str, account_handle: str, video_title: str, description: str, confidence_score: float }` | `{"success": true, "verdict": {"classification": "SEVERE PIRACY"\|"FAIR USE / FAN CONTENT", "justification": str, "routing": "Enforcer"\|"Broker", "risk_score": int}}` | LLM copyright ruling | Node `adjudicatorController.js`, `swarmController.js` |
| POST | `/adjudicate/batch` | `BatchAdjudicateRequest`: `{ incidents: list }` | `{"results": [{"incident_id": str, "verdict": dict}]}` | Batch LLM adjudication | Node `adjudicatorController.js` |
| POST | `/enforce` | `EnforceRequest`: `{ target_account: str, platform: str, video_title: str, confidence_score: float, classification: str, justification: str, integrity_hash: str, offence_number: int }` | `{"success": true, "notice_text": str, "tier": str, "legal_contact": str}` | DMCA notice drafting with proof hash | Node `enforcerController.js`, `swarmController.js` |
| POST | `/broker` | `BrokerRequest`: `{ target_account: str, platform: str, video_title: str, justification: str, view_count: int, risk_score: int }` | `{"success": true, "copyright_holder_share": int, "creator_share": int, "tx_hash": str, "tier": str, "estimated_monthly_revenue": float, "contract_data": dict}` | Revenue-share contract computation | Node `brokerController.js`, `swarmController.js` |
| GET | `/evidence/{incident_id}` | Query: `actor` | `{"success": true, ...}` | Evidence vault access & custody entry | Node `routes/evidence.js` |
| GET | `/evidence/{incident_id}/custody` | None | `{"success": true, "chain": list, "integrity": dict}` | Evidence custody audit trail | Node `routes/evidence.js` |
| POST | `/evidence/{incident_id}/package_detection` | `PackageDetectionRequest`: `{ scan_result: dict, thumbnail_url: str, audio_result: dict, forensics: dict, text_result: dict }` | `{"success": true}` | Store detection artifacts in vault | Node `swarmController.js` |
| POST | `/evidence/{incident_id}/export` | None | `{"success": true, "path": str}` | Export zip evidence bundle | Node `routes/evidence.js` |
| POST | `/evidence/{incident_id}/sync` | None | `{"success": true, ...}` | Sync vault artifacts to GCS | Node `routes/evidence.js` |
| POST | `/leak/analyze` | `LeakAnalysisRequest`: `{ thumbnail_url: str, video_url: str, incident_id: str, account_handle: str, platform: str }` | `{"success": true, "first_leak_platform": str, "leak_chain": list, "leak_risk": str, "confidence": float, ...}` | Reconstruct platform leak distribution chain | Node `routes/leak.js`, `swarmController.js` |
| POST | `/leak/batch` | `BatchScanRequest`: `{ threat_nodes: list }` | `{"results": list}` | Batch leak analysis | Node `routes/leak.js` |
| POST | `/stream/start` | `StreamStartRequest`: `{ stream_url: str, stream_id: str }` | `{"success": true, "stream_id": str, "message": str}` | Start live stream monitor threads | Node `routes/stream.js` |
| DELETE | `/stream/{stream_id}` | None | `{"success": true, "message": str}` | Stop live stream monitor | Node `routes/stream.js` |
| GET | `/stream/active` | None | `{"success": true, "streams": list}` | Active stream list | Node `routes/stream.js` |
| GET | `/stream/{stream_id}/results` | None | `{"success": true, "results": list, "detections": int}` | Stream detection segments | Node `routes/stream.js` |
| GET | `/watchdog/status` | None | `{"success": true, ...}` | Watchdog health & schedule | Node `routes/watchdog.js` |
| POST | `/watchdog/trigger` | Query: `asset_title`, `asset_url` | `{"success": true, ...}` | Trigger immediate background scan | Node `routes/watchdog.js` |
| GET | `/watchdog/history` | Query: `limit` | `{"success": true, "history": list, "total": int}` | Background scan detection history | Node `routes/watchdog.js` |
| POST | `/watchdog/stop` | None | `{"success": true, "message": "Watchdog stopped"}` | Stop watchdog | Node `routes/watchdog.js` |
| POST | `/watchdog/start` | None | `{"success": true, "message": "Watchdog started"}` | Start watchdog | Node `routes/watchdog.js` |

---

## 3. Environment Variables Reference

| Variable Name | Purpose | Required / Optional | Consumed By | Where Configured | How to Obtain / Default | Public / Private | Failure Behavior if Absent |
|---|---|---|---|---|---|---|---|
| `PORT` | Python FastAPI port | Optional (Default: `8001`) | Python `Backend/main.py` | Render Service Settings / Shell | Set automatically by Render | Private (Internal) | Defaults to `8001` |
| `NODE_PORT` or `PORT` | Node.js Express port | Optional (Default: `8000`) | Node.js `Backend/server/app.js` | Render Service Settings / Shell | Set automatically by Render | Private (Internal) | Defaults to `8000` |
| `FASTAPI_URL` | Address of remote Python ML service | **Required for Deployed Mode** | Node.js (all controllers & routes) | Render Environment Variables for Node Service | URL of deployed FastAPI service (e.g. `https://sportguard-ml.onrender.com`) | Private (Backend to Backend) | Defaults to `http://127.0.0.1:8001` (causes connection errors in deployed cloud environment) |
| `CLIENT_URL` | Allowed frontend origin for CORS | Optional | Node.js `app.js` & `socket.js` | Render Environment Variables for Node Service | Frontend deployment URL (e.g. `https://sportguard.vercel.app`) | Private | Defaults to allowing common localhost ports and open origin |
| `VITE_API_URL` | Node.js backend base URL | **Required for Frontend Deployment** | React Frontend (`api.js`, `SocketContext.jsx`) | Vercel / Render Frontend Settings | URL of deployed Node.js server (e.g. `https://sportguard-api.onrender.com`) | **Public** (bundled in JS client) | Defaults to `http://localhost:8000` (causes offline demo mode on deployed frontend) |
| `MONGO_URI` | MongoDB connection string | Optional (Recommended) | Node.js `config/db.js` | Render Environment Variables for Node Service | MongoDB Atlas connection string | Private (Secret) | Server logs warning and seamlessly switches to in-memory store |
| `REDIS_URL` | Redis / Upstash connection string | Optional | Node.js `config/redis.js` | Render Environment Variables for Node Service | Upstash Redis connection string (`rediss://...`) | Private (Secret) | Server logs warning and disables Redis caching/velocity escalation |
| `GEMINI_API_KEY` | Google Gemini API key for Adjudicator | Optional | Python `agents/adjudicator.py` | Render Environment Variables for Python Service | Google AI Studio | Private (Secret) | Falls back to Groq API; if neither present, uses deterministic rule-based adjudication |
| `GROQ_API_KEY` | Groq API key for Adjudicator | Optional | Python `agents/adjudicator.py` | Render Environment Variables for Python Service | Groq Console | Private (Secret) | Falls back to Gemini; if neither present, uses deterministic rule-based adjudication |
| `INGEST_SAMPLE_SEC` | Frame seek-sampling interval in seconds | Optional (Default: `1.0`) | Python `agents/archivist.py` | Render Environment Variables for Python Service | Number (e.g. `1.0`) | Private | Defaults to `1.0` (samples 1 frame every second for scene analysis) |
| `CLIP_BATCH_SIZE` | Batch size for CLIP inference | Optional (Default: `4` for ONNX, `16` for PyTorch) | Python `agents/archivist.py` | Render Environment Variables for Python Service | Integer (`1`-`16`) | Private | Uses safe defaults to fit within 512MB RAM |
| `CLIP_ONNX_PATH` | Path to pre-exported ONNX CLIP model | Optional | Python `agents/archivist.py` | Render Environment Variables for Python Service | File path (e.g. `./clip_vision.onnx`) | Private | If absent, falls back to PyTorch float16 model |
| `WATCHDOG_ENABLED` | Toggle background continuous monitoring thread | Optional (Default: `true`) | Python `agents/watchdog.py` | Render Environment Variables for Python Service | `true` or `false` | Private | Defaults to `true` |
| `WATCHDOG_INTERVAL_MIN` | Interval between watchdog sweeps | Optional (Default: `360`) | Python `agents/watchdog.py` | Render Environment Variables for Python Service | Integer (minutes) | Private | Defaults to 6 hours |
| `YOUTUBE_COOKIES_B64` | Base64-encoded Netscape cookie file for yt-dlp | Optional | Python `main.py` | Render Environment Variables for Python Service | Export cookies from browser as Netscape format, base64 encode | Private (Secret) | Unauthenticated yt-dlp; may encounter bot-detection blocks on cloud IPs |
| `APIFY_API_TOKEN` | Apify token for managed YouTube extraction | Optional | Python `main.py` | Render Environment Variables for Python Service | Apify Console | Private (Secret) | Falls back to yt-dlp with Chrome TLS impersonation |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket for evidence backups | Optional | Python `agents/evidence_vault.py` | Render Environment Variables for Python Service | Google Cloud Storage bucket name | Private | GCS sync is skipped; evidence remains stored on local disk |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON path for GCS | Optional | Python `agents/evidence_vault.py` | Render Environment Variables for Python Service | Local file path | Private (Secret) | GCS sync disabled |
