import { Router } from "express";
import multer from "multer";
import { validateIngestRequest } from "../middleware/validate.js";
import wrapAsync from "../utils/wrapAsync.js";
import { ingestAsset, uploadAsset, getAssets, getAssetById, deleteAsset } from "../controllers/archivistController.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
});

router.post("/ingest", validateIngestRequest, wrapAsync(ingestAsset));
router.post("/ingest/upload", upload.single("video"), wrapAsync(uploadAsset));
router.get("/ingest", wrapAsync(getAssets));
router.get("/ingest/:id", wrapAsync(getAssetById));
router.delete("/ingest/:id", wrapAsync(deleteAsset));

export default router;
